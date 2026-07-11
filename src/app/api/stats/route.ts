import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { withCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/stats
 * Dashboard aggregate stats, scoped to the authenticated user.
 * Cached for 30 seconds to avoid expensive COUNT queries on every dashboard load.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await withCache(CACHE_KEYS.stats(userId), CACHE_TTL.stats, async () => {
      const [targetsCount, scansCount, completedScans, recentScans] =
        await Promise.all([
          db.target.count({ where: { userId } }),
          db.scan.count({ where: { userId } }),
          db.scan.findMany({
            where: { userId, status: 'complete', overallScore: { not: null } },
            select: { overallScore: true },
          }),
          db.scan.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              target: { select: { id: true, name: true } },
              _count: { select: { results: true } },
            },
          }),
        ])

      const avgScore =
        completedScans.length === 0
          ? 0
          : Math.round(
              completedScans.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) /
                completedScans.length,
            )

      // Hardening improvements: count hardened scans whose overallScore beats
      // the parent target's most recent prior scan.
      const hardenedScans = await db.scan.findMany({
        where: { userId, note: { startsWith: 'Hardened' } },
        include: {
          target: {
            select: {
              parentId: true,
              scans: {
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, overallScore: true, createdAt: true },
              },
            },
          },
        },
      })

      let hardeningImprovements = 0
      for (const hs of hardenedScans) {
        if (hs.overallScore === null) continue
        const parentTargetId = hs.target.parentId
        if (!parentTargetId) continue
        const parentScans = await db.scan.findMany({
          where: {
            userId,
            targetId: parentTargetId,
            status: 'complete',
            overallScore: { not: null },
            createdAt: { lt: hs.createdAt },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        })
        if (parentScans.length === 0) continue
        const before = parentScans[0].overallScore ?? 0
        if (hs.overallScore > before) {
          hardeningImprovements += 1
        }
      }

      const recentScansOut = recentScans.map((s) => ({
        id: s.id,
        targetId: s.targetId,
        createdAt: s.createdAt,
        status: s.status,
        overallScore: s.overallScore,
        categoryScores: s.categoryScores ? JSON.parse(s.categoryScores) : null,
        note: s.note,
        target: s.target,
        resultCount: s._count.results,
      }))

      return {
        targetsCount,
        scansCount,
        avgScore,
        hardeningImprovements,
        recentScans: recentScansOut,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error('stats.fetch_failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
