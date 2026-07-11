import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/targets/[id]
 * Returns a single target + its scans (newest first).
 * Scoped to the authenticated user — cannot read another user's target.
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
    const target = await db.target.findFirst({
      where: { id, userId },
      include: {
        scans: {
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { results: true } } },
        },
      },
    })
    if (!target) {
      return NextResponse.json({ error: 'Target not found.' }, { status: 404 })
    }
    return NextResponse.json({ target })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/targets/[id]
 * Cascade-deletes the target and all its scans + results.
 * Scoped to the authenticated user.
 */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await ctx.params
    const existing = await db.target.findFirst({ where: { id, userId } })
    if (!existing) {
      return NextResponse.json({ error: 'Target not found.' }, { status: 404 })
    }

    await db.target.delete({ where: { id } })

    await logAudit(userId, 'target.delete', `target:${id}`, req)

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
