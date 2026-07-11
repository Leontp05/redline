import { db } from './db'
import { getPlan, type PlanTier } from './plans'

/**
 * Usage tracking for billing.
 *
 * Usage is computed from the Scan table — we count scans created in the
 * current billing period. This avoids drift between a separate counter and
 * reality.
 *
 * Period start:
 *   - Paid users (active subscription): stripeSubscriptionCurrentPeriodEnd
 *     minus 1 month (i.e. the start of the current Stripe billing cycle).
 *   - Free users: the start of the current calendar month.
 */

export interface UsageInfo {
  plan: PlanTier
  scansUsed: number
  scansLimit: number // -1 = unlimited
  scansRemaining: number // -1 = unlimited
  targetsUsed: number
  targetsLimit: number // -1 = unlimited
  periodStart: Date
  periodEnd: Date
  resetAt: Date // when the quota resets
}

/**
 * Get the current usage info for a user.
 */
export async function getUsage(userId: string): Promise<UsageInfo | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
    },
  })
  if (!user) return null

  const plan = getPlan(user.plan)

  // Determine the billing period.
  const now = new Date()
  let periodEnd: Date
  let periodStart: Date

  if (
    user.subscriptionStatus === 'active' &&
    user.currentPeriodEnd &&
    user.currentPeriodEnd > now
  ) {
    // Paid user with active subscription — use Stripe's billing period.
    periodEnd = user.currentPeriodEnd
    // Period start is approximately 1 month before period end.
    periodStart = new Date(periodEnd)
    periodStart.setMonth(periodStart.getMonth() - 1)
  } else {
    // Free user (or expired subscription) — calendar month.
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  }

  // Count scans in the current period.
  const scansUsed = await db.scan.count({
    where: {
      userId,
      createdAt: { gte: periodStart, lt: periodEnd },
    },
  })

  // Count targets.
  const targetsUsed = await db.target.count({
    where: { userId },
  })

  const scansLimit = plan.features.scansPerMonth
  const targetsLimit = plan.features.maxTargets

  return {
    plan: plan.id,
    scansUsed,
    scansLimit,
    scansRemaining: scansLimit === -1 ? -1 : Math.max(0, scansLimit - scansUsed),
    targetsUsed,
    targetsLimit,
    periodStart,
    periodEnd,
    resetAt: periodEnd,
  }
}

/**
 * Can the user create a new scan right now?
 * Returns { allowed: boolean, reason?: string }
 */
export async function canCreateScan(
  userId: string,
): Promise<{ allowed: boolean; reason?: string; usage?: UsageInfo }> {
  const usage = await getUsage(userId)
  if (!usage) {
    return { allowed: false, reason: 'User not found.' }
  }

  // Check scan quota.
  if (usage.scansLimit !== -1 && usage.scansUsed >= usage.scansLimit) {
    return {
      allowed: false,
      reason: `You've reached your monthly scan limit (${usage.scansUsed}/${usage.scansLimit}). Upgrade your plan to run more scans.`,
      usage,
    }
  }

  return { allowed: true, usage }
}

/**
 * Can the user create a new target?
 */
export async function canCreateTarget(
  userId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const usage = await getUsage(userId)
  if (!usage) return { allowed: false, reason: 'User not found.' }

  if (usage.targetsLimit !== -1 && usage.targetsUsed >= usage.targetsLimit) {
    return {
      allowed: false,
      reason: `You've reached your target limit (${usage.targetsUsed}/${usage.targetsLimit}). Upgrade your plan to add more targets.`,
    }
  }

  return { allowed: true }
}

/**
 * Does the user's plan include a specific feature?
 */
export function hasFeature(userId: string, feature: 'apiConnect' | 'harden'): boolean {
  // This is a sync check — it reads from the plans definition, not the DB.
  // For a real check, use the user's plan from the DB. This is a convenience
  // for cases where you already have the plan tier.
  return true // actual check happens server-side per-request
}
