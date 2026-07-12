import crypto from 'crypto'
import { db } from './db'

/**
 * API key generation + authentication for the public REST API.
 *
 * Keys are formatted as: rl_live_<32 random hex chars>
 * Only the SHA-256 hash is stored in the DB — the raw key is shown once
 * at creation time and never again.
 *
 * Usage in API routes:
 *   const userId = await requireApiUserId(req)
 *   if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 */

const KEY_PREFIX = 'rl_live_'

/**
 * Generate a new API key. Returns the raw key (shown to the user once)
 * and stores only the hash + prefix in the DB.
 */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ key: string; id: string; keyPrefix: string }> {
  const rawKey = KEY_PREFIX + crypto.randomBytes(16).toString('hex')
  const keyHash = hashKey(rawKey)
  const keyPrefix = rawKey.slice(0, 12) // "rl_live_abc1"

  const apiKey = await db.apiKey.create({
    data: {
      userId,
      name: name.trim() || 'Unnamed',
      keyHash,
      keyPrefix,
    },
  })

  return { key: rawKey, id: apiKey.id, keyPrefix }
}

/**
 * Hash an API key for storage. SHA-256 — one-way, can't be reversed.
 */
function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Authenticate a request via API key.
 *
 * Checks the `Authorization: Bearer rl_live_xxx` header.
 * Returns the userId if valid, null otherwise.
 *
 * Also updates `lastUsedAt` on the API key for auditing.
 */
export async function requireApiUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) return null

  const rawKey = match[1].trim()
  if (!rawKey.startsWith(KEY_PREFIX)) return null

  const keyHash = hashKey(rawKey)
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true },
  })

  if (!apiKey) return null

  // Update lastUsedAt (fire-and-forget, don't block the request)
  db.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {
      // Ignore — lastUsedAt is best-effort
    })

  return apiKey.userId
}
