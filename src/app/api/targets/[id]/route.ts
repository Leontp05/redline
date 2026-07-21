import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { encrypt } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/targets/[id]
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
 * PATCH /api/targets/[id]
 * Update an existing target's fields. Only the owner can edit.
 */
export async function PATCH(
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

    // Don't allow editing hardened targets (they're immutable snapshots)
    if (existing.parentId) {
      return NextResponse.json(
        { error: 'Hardened targets cannot be edited. Edit the original target instead.' },
        { status: 400 },
      )
    }

    const body = (await req.json()) as {
      name?: unknown
      systemPrompt?: unknown
      context?: unknown
      apiEndpoint?: unknown
      apiHeaders?: unknown
      apiModel?: unknown
    }

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim().slice(0, 120)
    }
    if (typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) {
      data.systemPrompt = body.systemPrompt.trim().slice(0, 10000)
    }
    if (typeof body.context === 'string') {
      data.context = body.context.trim() || null
    }
    if (typeof body.apiEndpoint === 'string') {
      data.apiEndpoint = body.apiEndpoint.trim() || null
    }
    if (typeof body.apiHeaders === 'string') {
      data.apiHeaders = body.apiHeaders.trim() ? encrypt(body.apiHeaders) : null
    }
    if (typeof body.apiModel === 'string') {
      data.apiModel = body.apiModel.trim() || null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
    }

    const updated = await db.target.update({
      where: { id },
      data,
    })

    await logAudit(userId, 'target.update', `target:${id}`, req)

    return NextResponse.json({
      target: {
        ...updated,
        apiHeaders: undefined,
        hasApiHeaders: !!updated.apiHeaders,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * DELETE /api/targets/[id]
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
