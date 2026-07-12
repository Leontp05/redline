import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { runScan, type ScanTarget } from '@/lib/orchestrator'
import { requireUserId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { decrypt } from '@/lib/crypto'
import { canCreateScan } from '@/lib/usage'
import { checkScanRateLimit } from '@/lib/rate-limit'
import { cache_store, CACHE_KEYS } from '@/lib/cache'
import { logger } from '@/lib/logger'
import { notifyScanComplete } from '@/lib/email'
import { fireWebhooks } from '@/lib/webhook-send'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/scans
 * Returns the authenticated user's 50 most recent scans with target name +
 * overallScore + result count.
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scans = await db.scan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        target: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
    })
    const flat = scans.map((s) => ({
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
    return NextResponse.json({ scans: flat })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/scans
 * Body: { targetId: string, attackTypeIds?: string[] }
 *
 * ASYNC pattern (production-safe):
 *   1. Validate auth + ownership of the target.
 *   2. Create a Scan row with status='running'.
 *   3. Return the scan row immediately (HTTP 201).
 *   4. Use `after()` to run the scan in the background (after the response
 *      is sent). On Vercel, this runs within the same function invocation
 *      (subject to the plan's function timeout). On Railway/VPS or `next dev`,
 *      it runs in-process with no timeout.
 *   5. The frontend polls GET /api/scans/[id] until status='complete'.
 *
 * Response shape (immediate):
 *   { scan: { id, targetId, status: 'running', ... } }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check scan quota (plan limit).
    const scanCheck = await canCreateScan(userId)
    if (!scanCheck.allowed) {
      return NextResponse.json(
        { error: scanCheck.reason, code: 'QUOTA_EXCEEDED' },
        { status: 402 },
      )
    }

    // Check rate limit (min seconds between scans).
    const rateCheck = await checkScanRateLimit(userId)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason, code: 'RATE_LIMITED', retryAfter: rateCheck.retryAfterSeconds },
        { status: 429 },
      )
    }

    const body = (await req.json()) as {
      targetId?: unknown
      attackTypeIds?: unknown
    }
    const targetId = typeof body.targetId === 'string' ? body.targetId : ''
    if (!targetId) {
      return NextResponse.json(
        { error: 'targetId is required.' },
        { status: 400 },
      )
    }

    // Scope to the authenticated user — cannot scan another user's target.
    const target = await db.target.findFirst({
      where: { id: targetId, userId },
    })
    if (!target) {
      return NextResponse.json({ error: 'Target not found.' }, { status: 404 })
    }

    // Resolve attack types — default to all.
    let attackTypeIds: string[] | null = null
    if (
      Array.isArray(body.attackTypeIds) &&
      body.attackTypeIds.every((x) => typeof x === 'string')
    ) {
      attackTypeIds = body.attackTypeIds as string[]
    }

    const attackTypes =
      attackTypeIds && attackTypeIds.length > 0
        ? await db.attackType.findMany({ where: { id: { in: attackTypeIds } } })
        : await db.attackType.findMany()

    if (attackTypes.length === 0) {
      return NextResponse.json(
        { error: 'No attack types available. Seed via GET /api/attacks first.' },
        { status: 400 },
      )
    }

    // Create the Scan row in 'running' state.
    const scan = await db.scan.create({
      data: {
        userId,
        targetId: target.id,
        status: 'running',
      },
    })

    await logAudit(userId, 'scan.create', `scan:${scan.id}`, req, {
      targetId: target.id,
      attackCount: attackTypes.length,
    })

    // Snapshot the target data the background job needs (avoid re-querying
    // after the response is sent — the DB row could theoretically change).
    // For API-connect mode, decrypt the headers so the background job can use them.
    const targetSnapshot: ScanTarget = {
      id: target.id,
      systemPrompt: target.systemPrompt,
      context: target.context,
      mode: target.mode,
      apiConfig:
        target.mode === 'api' && target.apiEndpoint
          ? {
              endpoint: target.apiEndpoint,
              headersJson: decrypt(target.apiHeaders),
              model: target.apiModel,
            }
          : null,
    }
    const attackTypeSnapshot = attackTypes.map((at) => ({
      id: at.id,
      key: at.key,
      name: at.name,
      category: at.category,
      severityWeight: at.severityWeight,
      description: at.description,
      results: [],
    }))

    // Run the scan AFTER the response is sent. `after()` schedules this to
    // run in the background without blocking the HTTP response.
    after(async () => {
      const scanLog = logger.child({ scanId: scan.id, targetId: target.id, userId })
      scanLog.info('scan.started', {
        mode: target.mode,
        attackCount: attackTypes.length,
      })
      const startTime = Date.now()
      try {
        await runScan(scan.id, targetSnapshot, attackTypeSnapshot, db)
        const duration = Date.now() - startTime
        scanLog.info('scan.completed', { durationMs: duration })
        await logAudit(userId, 'scan.complete', `scan:${scan.id}`, null, {
          status: 'complete',
          durationMs: duration,
        })
        // Invalidate caches so the dashboard shows fresh data.
        cache_store.del(CACHE_KEYS.stats(userId))
        cache_store.del(CACHE_KEYS.usage(userId))
        cache_store.del(CACHE_KEYS.scan(scan.id))

        // Send email notification if the user has an email + email is configured.
        try {
          const user = await db.user.findUnique({
            where: { id: userId },
            select: { email: true },
          })
          if (user?.email) {
            const completedScan = await db.scan.findUnique({
              where: { id: scan.id },
              include: { _count: { select: { results: true } } },
            })
            if (completedScan) {
              const vulnerableCount = await db.result.count({
                where: { scanId: scan.id, success: true },
              })
              await notifyScanComplete({
                email: user.email,
                targetName: target.name,
                scanId: scan.id,
                overallScore: completedScan.overallScore,
                vulnerableCount,
                totalCount: completedScan._count.results,
                appUrl: process.env.NEXTAUTH_URL || 'https://redline-orcin.vercel.app',
              })
            }
          }
        } catch (emailErr) {
          // Email failure should never affect the scan result.
          scanLog.warn('scan.email_failed', {
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          })
        }

        // Fire webhooks (notify external systems — Slack, Discord, CI/CD, etc.)
        try {
          const vulnerableCount = await db.result.count({
            where: { scanId: scan.id, success: true },
          })
          const totalResults = await db.result.count({ where: { scanId: scan.id } })
          const completedScan = await db.scan.findUnique({
            where: { id: scan.id },
            select: { overallScore: true },
          })
          await fireWebhooks(userId, 'scan.complete', {
            scanId: scan.id,
            targetId: target.id,
            targetName: target.name,
            overallScore: completedScan?.overallScore ?? null,
            vulnerableCount,
            totalCount: totalResults,
          })
        } catch (webhookErr) {
          scanLog.warn('scan.webhook_failed', {
            error: webhookErr instanceof Error ? webhookErr.message : String(webhookErr),
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        scanLog.error('scan.failed', { error: msg, durationMs: Date.now() - startTime })
        await logAudit(userId, 'scan.failed', `scan:${scan.id}`, null, {
          error: msg,
        })
        cache_store.del(CACHE_KEYS.stats(userId))
        cache_store.del(CACHE_KEYS.usage(userId))
      }
    })

    // Return immediately with the running scan.
    return NextResponse.json(
      {
        scan: {
          id: scan.id,
          targetId: scan.targetId,
          createdAt: scan.createdAt,
          status: scan.status,
          overallScore: null,
          categoryScores: null,
          note: scan.note,
          target: { id: target.id, name: target.name },
          results: [],
        },
      },
      { status: 201 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
