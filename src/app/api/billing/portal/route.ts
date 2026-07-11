import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/session'
import { createPortalSession } from '@/lib/stripe'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session for managing subscriptions.
 * Returns the URL to redirect to. Returns 503 if Stripe is not configured
 * or 400 if the user has no Stripe customer ID.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }
    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found. Upgrade first.' },
        { status: 400 },
      )
    }

    const result = await createPortalSession(user.stripeCustomerId)
    if (!result) {
      return NextResponse.json(
        { error: 'Stripe is not configured.' },
        { status: 503 },
      )
    }

    return NextResponse.json({ url: result.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
