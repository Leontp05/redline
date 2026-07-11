import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Get the authenticated session on the server (NextAuth v5).
 * Returns null if the user is not signed in.
 */
export async function getAuthSession() {
  return auth()
}

/**
 * Get the authenticated user's id. Returns null if not authenticated.
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth()
  return (session?.user as { id?: string } | undefined)?.id ?? null
}

/**
 * Get the authenticated user's id + admin status.
 * Returns null if not authenticated.
 */
export async function requireUser(): Promise<{
  id: string
  isAdmin: boolean
} | null> {
  const session = await auth()
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined
  if (!user?.id) return null
  return { id: user.id, isAdmin: user.isAdmin ?? false }
}
