import { db } from './db'
import { getPlan } from './plans'

/**
 * Rate limiting for scan creation.
 *
 * Uses the Scan table itself as the rate-limit counter — we check the most
 * recent scan's createdAt and reject if it's too recent. This is a simple
 * per-user sliding window without needing Redis.
 *
 * For production at scale, swap this for Upstash Redis + a sliding-window
 * algorithm. The interface (checkRateLimit) stays the same.
 */

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number // 0 if allowed, else seconds until the user can retry
  reason?: string
}

/**
 * Check if the user can create a scan right now, based on their plan's
 * rate limit (min seconds between scans).
 */
export async function checkScanRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, isAdmin: true },
  })
  if (!user) {
    return { allowed: false, retryAfterSeconds: 0, reason: 'User not found.' }
  }

  // Admins bypass rate limiting.
  if (user.isAdmin) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const plan = getPlan(user.plan)
  const minInterval = plan.rateLimitSeconds

  // Find the user's most recent scan.
  const lastScan = await db.scan.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })

  if (!lastScan) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const elapsed = (Date.now() - lastScan.createdAt.getTime()) / 1000
  if (elapsed >= minInterval) {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const retryAfter = Math.ceil(minInterval - elapsed)
  return {
    allowed: false,
    retryAfterSeconds: retryAfter,
    reason: `Rate limit: your ${plan.name} plan allows 1 scan every ${minInterval}s. Try again in ${retryAfter}s.`,
  }
}
