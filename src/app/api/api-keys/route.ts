import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { createApiKey } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/api-keys
 * List the authenticated user's API keys (without the actual key value).
 */
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await db.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  })

  return NextResponse.json({ keys })
}

/**
 * POST /api/api-keys
 * Body: { name: string }
 * Creates a new API key. Returns the raw key ONCE — store it securely.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!name) {
    return NextResponse.json({ error: 'name is required.' }, { status: 400 })
  }

  const result = await createApiKey(userId, name)
  await logAudit(userId, 'apikey.create', `apikey:${result.id}`, req, { name })

  return NextResponse.json({
    id: result.id,
    key: result.key,
    keyPrefix: result.keyPrefix,
    name,
    message: 'Save this key securely — you won\'t be able to see it again.',
  }, { status: 201 })
}

/**
 * DELETE /api/api-keys
 * Body: { id: string }
 * Revoke an API key.
 */
export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''

  if (!id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 })
  }

  const key = await db.apiKey.findFirst({ where: { id, userId } })
  if (!key) {
    return NextResponse.json({ error: 'API key not found.' }, { status: 404 })
  }

  await db.apiKey.delete({ where: { id } })
  await logAudit(userId, 'apikey.revoke', `apikey:${id}`, req)

  return NextResponse.json({ ok: true })
}
