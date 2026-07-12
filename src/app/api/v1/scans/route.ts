import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { requireApiUserId } from '@/lib/api-auth'
import { canCreateScan } from '@/lib/usage'
import { checkScanRateLimit } from '@/lib/rate-limit'
import { runScan, type ScanTarget } from '@/lib/orchestrator'
import { logAudit } from '@/lib/audit'
import { cache_store, CACHE_KEYS } from '@/lib/cache'
import { fireWebhooks } from '@/lib/webhook-send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/v1/scans
 * List recent scans for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const userId = await requireApiUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const scans = await db.scan.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      target: { select: { id: true, name: true } },
      _count: { select: { results: true } },
    },
  })

  return NextResponse.json({
    scans: scans.map((s) => ({
      id: s.id,
      targetId: s.targetId,
      targetName: s.target.name,
      status: s.status,
      overallScore: s.overallScore,
      categoryScores: s.categoryScores ? JSON.parse(s.categoryScores) : null,
      note: s.note,
      resultCount: s._count.results,
      createdAt: s.createdAt,
    })),
  })
}

/**
 * POST /api/v1/scans
 * Create + start a scan (async — returns immediately with status "running").
 * Body: { targetId, attackTypeIds? }
 *
 * The caller polls GET /api/v1/scans/:id until status is "complete" or "failed".
 */
export async function POST(req: NextRequest) {
  const userId = await requireApiUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // Check quota + rate limit
  const scanCheck = await canCreateScan(userId)
  if (!scanCheck.allowed) {
    return NextResponse.json({ error: scanCheck.reason, code: 'QUOTA_EXCEEDED' }, { status: 402 })
  }

  const rateCheck = await checkScanRateLimit(userId)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: rateCheck.reason, code: 'RATE_LIMITED', retryAfter: rateCheck.retryAfterSeconds }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const targetId = typeof body.targetId === 'string' ? body.targetId : ''
  if (!targetId) {
    return NextResponse.json({ error: 'targetId is required.' }, { status: 400 })
  }

  const target = await db.target.findFirst({ where: { id: targetId, userId } })
  if (!target) {
    return NextResponse.json({ error: 'Target not found.' }, { status: 404 })
  }

  const attackTypes = await db.attackType.findMany()
  if (attackTypes.length === 0) {
    return NextResponse.json({ error: 'No attack types available.' }, { status: 400 })
  }

  const scan = await db.scan.create({
    data: { userId, targetId: target.id, status: 'running' },
  })

  await logAudit(userId, 'scan.create', `scan:${scan.id}`, req, { targetId: target.id, source: 'api' })

  const targetSnapshot: ScanTarget = {
    id: target.id,
    systemPrompt: target.systemPrompt,
    context: target.context,
    mode: target.mode,
  }

  after(async () => {
    try {
      await runScan(scan.id, targetSnapshot, attackTypes, db)
      cache_store.del(CACHE_KEYS.stats(userId))
      cache_store.del(CACHE_KEYS.usage(userId))

      // Fire webhooks
      const vulnerableCount = await db.result.count({ where: { scanId: scan.id, success: true } })
      const totalResults = await db.result.count({ where: { scanId: scan.id } })
      const completedScan = await db.scan.findUnique({ where: { id: scan.id }, select: { overallScore: true } })
      await fireWebhooks(userId, 'scan.complete', {
        scanId: scan.id,
        targetId: target.id,
        targetName: target.name,
        overallScore: completedScan?.overallScore ?? null,
        vulnerableCount,
        totalCount: totalResults,
      })
    } catch (err) {
      console.error(`[api/v1] scan ${scan.id} failed:`, err)
      await fireWebhooks(userId, 'scan.failed', {
        scanId: scan.id,
        targetId: target.id,
        targetName: target.name,
        overallScore: null,
        vulnerableCount: 0,
        totalCount: 0,
      })
    }
  })

  return NextResponse.json({
    scan: {
      id: scan.id,
      targetId: scan.targetId,
      status: scan.status,
      createdAt: scan.createdAt,
    },
  }, { status: 201 })
}
