import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/auth/me
 * Returns the current user's session info (for the frontend auth state).
 */
export async function GET() {
  const session = await getAuthSession()
  if (!session?.user) {
    return NextResponse.json({ user: null })
  }
  return NextResponse.json({
    user: {
      id: (session.user as { id?: string }).id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
  })
}
