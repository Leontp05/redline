import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/scans/[id]
 * Returns a single scan with target, results (each with attackType), and
 * categoryScores parsed from JSON. Scoped to the authenticated user.
 *
 * This endpoint is polled by the frontend while a scan is 'running' — it
 * returns partial results as they're persisted by the background orchestrator.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params
    const scan = await db.scan.findFirst({
      where: { id, userId },
      include: {
        target: true,
        results: {
          include: { attackType: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found.' }, { status: 404 })
    }
    const out = {
      ...scan,
      categoryScores: scan.categoryScores
        ? JSON.parse(scan.categoryScores)
        : null,
      results: scan.results.map((r) => ({
        ...r,
        conversation: r.conversation ? JSON.parse(r.conversation) : null,
      })),
    }
    return NextResponse.json({ scan: out })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
