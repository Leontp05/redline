import { auth } from '@/lib/auth'

/**
 * Get the authenticated session on the server (NextAuth v5).
 * Returns null if the user is not signed in.
 */
export async function getAuthSession() {
  return auth()
}

/**
 * Get the authenticated user's id.
 * Returns null if not authenticated.
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth()
  return (session?.user as { id?: string } | undefined)?.id ?? null
}
