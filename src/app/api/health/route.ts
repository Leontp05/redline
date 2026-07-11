import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cache_store } from '@/lib/cache'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Track server start time for uptime calculation.
const startedAt = Date.now()

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring (uptime checks, Kubernetes liveness
 * probes, Vercel cron health, etc.).
 *
 * Returns:
 *   - status: "ok" | "degraded" | "down"
 *   - uptime: seconds since server start
 *   - database: "connected" | "error" (ping result)
 *   - cache: { size, hits, misses, hitRate }
 *   - version: from package.json (via env)
 *   - timestamp: ISO string
 *
 * This endpoint is public (no auth) — it doesn't expose sensitive data.
 * Use it for uptime monitoring (e.g. UptimeRobot, BetterStack).
 */
export async function GET() {
  const checks: PromiseSettledResult<unknown>[] = await Promise.allSettled([
    // Database ping
    db.$queryRaw`SELECT 1`,
  ])

  const dbResult = checks[0]
  const dbStatus = dbResult.status === 'fulfilled' ? 'connected' : 'error'

  const overall =
    dbStatus === 'connected' ? 'ok' : 'degraded'

  if (dbStatus === 'error') {
    logger.error('health.check_failed', {
      dbError:
        dbResult.status === 'rejected' ? String(dbResult.reason) : 'unknown',
    })
  }

  return NextResponse.json({
    status: overall,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    database: dbStatus,
    cache: cache_store.stats(),
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
  })
}
