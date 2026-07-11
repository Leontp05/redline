import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/session'
import { getUsage } from '@/lib/usage'
import { isStripeConfigured } from '@/lib/plans'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/billing/usage
 *
 * Returns the authenticated user's current usage + plan info.
 *
 * Response shape:
 *   {
 *     plan: 'free' | 'pro' | 'team',
 *     scansUsed, scansLimit, scansRemaining,
 *     targetsUsed, targetsLimit,
 *     periodStart, periodEnd, resetAt,
 *     stripeConfigured: boolean,
 *     subscriptionStatus: string | null
 *   }
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const usage = await getUsage(userId)
    if (!usage) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const user = await await import('@/lib/db').then(({ db }) =>
      db.user.findUnique({
        where: { id: userId },
        select: { subscriptionStatus: true, isAdmin: true },
      }),
    )

    return NextResponse.json({
      ...usage,
      stripeConfigured: isStripeConfigured(),
      subscriptionStatus: user?.subscriptionStatus ?? null,
      isAdmin: user?.isAdmin ?? false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
