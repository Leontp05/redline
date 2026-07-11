import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/session'
import { createCheckoutSession } from '@/lib/stripe'
import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/billing/checkout
 * Body: { plan: 'pro' | 'team' }
 *
 * Creates a Stripe Checkout Session and returns the URL to redirect to.
 * Returns 503 if Stripe is not configured.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as { plan?: unknown }
    const plan = body.plan === 'team' ? 'team' : body.plan === 'pro' ? 'pro' : null
    if (!plan) {
      return NextResponse.json(
        { error: 'plan must be "pro" or "team".' },
        { status: 400 },
      )
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const result = await createCheckoutSession(
      userId,
      user.email,
      plan,
      user.stripeCustomerId,
    )

    if (!result) {
      return NextResponse.json(
        {
          error:
            'Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_* env vars to enable paid plans.',
        },
        { status: 503 },
      )
    }

    await logAudit(userId, 'billing.checkout', `plan:${plan}`, req)

    return NextResponse.json({ url: result.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
