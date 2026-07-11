import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { db } from '@/lib/db'
import { createHardenTarget } from '@/lib/harden'
import { runScan, type ScanTarget } from '@/lib/orchestrator'
import { requireUserId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { decrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/harden
 * Body: { scanId: string }
 *
 * ASYNC pattern (production-safe):
 *   1. Validate auth + ownership of the scan.
 *   2. Create the hardened target + a 'running' scan row (this includes the
 *      LLM rewrite of the system prompt — ~10-20s).
 *   3. Return immediately with { hardenedTargetId, hardenedScanId,
 *      originalScanId }.
 *   4. Use `after()` to run the re-test scan in the background.
 *   5. The frontend polls GET /api/scans/[hardenedScanId] until complete,
 *      then loads the original scan separately for the before/after view.
 *
 * Response shape (immediate):
 *   { hardenedTargetId, hardenedScanId, originalScanId }
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as { scanId?: unknown }
    const scanId = typeof body.scanId === 'string' ? body.scanId : ''
    if (!scanId) {
      return NextResponse.json(
        { error: 'scanId is required.' },
        { status: 400 },
      )
    }

    // createHardenTarget does the LLM rewrite (~10-20s) + creates the rows.
    // We keep this synchronous because the rewrite is fast and the client
    // needs the IDs to start polling.
    const { hardenedTargetId, hardenedScanId } = await createHardenTarget(
      scanId,
      userId,
      db,
    )

    await logAudit(userId, 'harden.run', `scan:${hardenedScanId}`, req, {
      originalScanId: scanId,
      hardenedTargetId,
    })

    // Snapshot the target + attack types for the background job.
    const hardenedTarget = await db.target.findUnique({
      where: { id: hardenedTargetId },
    })
    if (!hardenedTarget) {
      return NextResponse.json(
        { error: 'Hardened target vanished.' },
        { status: 500 },
      )
    }
    const allAttackTypes = await db.attackType.findMany()
    const targetSnapshot: ScanTarget = {
      id: hardenedTarget.id,
      systemPrompt: hardenedTarget.systemPrompt,
      context: hardenedTarget.context,
      mode: hardenedTarget.mode,
      apiConfig:
        hardenedTarget.mode === 'api' && hardenedTarget.apiEndpoint
          ? {
              endpoint: hardenedTarget.apiEndpoint,
              headersJson: decrypt(hardenedTarget.apiHeaders),
              model: hardenedTarget.apiModel,
            }
          : null,
    }
    const attackTypeSnapshot = allAttackTypes.map((at) => ({
      id: at.id,
      key: at.key,
      name: at.name,
      category: at.category,
      severityWeight: at.severityWeight,
      description: at.description,
      results: [],
    }))

    // Run the re-test scan AFTER the response is sent.
    after(async () => {
      try {
        await runScan(hardenedScanId, targetSnapshot, attackTypeSnapshot, db)
        await logAudit(userId, 'harden.complete', `scan:${hardenedScanId}`, null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[harden] background scan ${hardenedScanId} failed:`, msg)
        await logAudit(userId, 'harden.failed', `scan:${hardenedScanId}`, null, {
          error: msg,
        })
      }
    })

    return NextResponse.json(
      {
        hardenedTargetId,
        hardenedScanId,
        originalScanId: scanId,
      },
      { status: 201 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
