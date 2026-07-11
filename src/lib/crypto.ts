import crypto from 'crypto'

/**
 * AES-256-GCM encryption for sensitive data at rest (API keys, auth headers).
 *
 * Why GCM: authenticated encryption — detects tampering, not just decryption.
 * Why envelope: each ciphertext gets a unique IV (12 bytes) + auth tag (16 bytes).
 *
 * Ciphertext format: base64(iv || tag || ciphertext)
 *   - 12 bytes IV
 *   - 16 bytes auth tag
 *   - N bytes ciphertext
 *
 * The key comes from ENCRYPT_KEY env var (32 bytes base64). NEVER hardcode it.
 */

const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

function getKey(): Buffer {
  const raw = process.env.ENCRYPT_KEY
  if (!raw) {
    throw new Error(
      'ENCRYPT_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env.',
    )
  }
  // The key can be base64 or hex; base64 is what `openssl rand -base64 32` produces.
  let key: Buffer
  try {
    key = Buffer.from(raw, 'base64')
  } catch {
    key = Buffer.from(raw, 'hex')
  }
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPT_KEY must decode to 32 bytes (got ${key.length}). Use \`openssl rand -base64 32\`.`,
    )
  }
  return key
}

/**
 * Encrypt a plaintext string. Returns base64(iv || tag || ciphertext).
 * Returns null if the input is null/empty (so we don't store junk).
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === '') return null
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

/**
 * Decrypt a ciphertext produced by encrypt(). Returns the plaintext string.
 * Returns null if the input is null/empty. Throws if the key is wrong or the
 * ciphertext was tampered with (GCM auth tag verification fails).
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null || ciphertext === '') return null
  const key = getKey()
  const data = Buffer.from(ciphertext, 'base64')
  if (data.length < IV_LEN + TAG_LEN) {
    throw new Error('Ciphertext too short — corrupted or wrong format.')
  }
  const iv = data.subarray(0, IV_LEN)
  const tag = data.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const enc = data.subarray(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString('utf8')
}

/**
 * Mask a secret for display — shows only the last 4 chars.
 * e.g. "sk-abc123...wxyz" → "••••••••wxyz"
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return ''
  if (secret.length <= 4) return '••••'
  return '•'.repeat(Math.min(secret.length - 4, 20)) + secret.slice(-4)
}
