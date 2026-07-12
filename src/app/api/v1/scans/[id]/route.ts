import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireApiUserId } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/v1/scans/:id
 * Get a single scan with results (for polling).
 * Auth: Authorization: Bearer rl_live_xxx
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await requireApiUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await ctx.params
  const scan = await db.scan.findFirst({
    where: { id, userId },
    include: {
      target: { select: { id: true, name: true, version: true } },
      results: {
        include: { attackType: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 })
  }

  return NextResponse.json({
    scan: {
      id: scan.id,
      targetId: scan.targetId,
      target: scan.target,
      status: scan.status,
      overallScore: scan.overallScore,
      categoryScores: scan.categoryScores ? JSON.parse(scan.categoryScores) : null,
      note: scan.note,
      createdAt: scan.createdAt,
      results: scan.results.map((r) => ({
        id: r.id,
        attackType: r.attackType.name,
        attackCategory: r.attackType.category,
        technique: r.technique,
        payload: r.payload,
        response: r.response,
        success: r.success,
        evidence: r.evidence,
      })),
    },
  })
}
