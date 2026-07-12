import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireApiUserId } from '@/lib/api-auth'
import { canCreateTarget } from '@/lib/usage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/v1/targets
 * List the authenticated user's targets.
 * Auth: Authorization: Bearer rl_live_xxx
 */
export async function GET(req: NextRequest) {
  const userId = await requireApiUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized. Provide a valid API key in the Authorization header.' }, { status: 401 })
  }

  const targets = await db.target.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      systemPrompt: true,
      context: true,
      mode: true,
      version: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ targets })
}

/**
 * POST /api/v1/targets
 * Create a new target.
 * Body: { name, systemPrompt, context?, mode? }
 */
export async function POST(req: NextRequest) {
  const userId = await requireApiUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const targetCheck = await canCreateTarget(userId)
  if (!targetCheck.allowed) {
    return NextResponse.json({ error: targetCheck.reason, code: 'QUOTA_EXCEEDED' }, { status: 402 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : ''

  if (!name || !systemPrompt) {
    return NextResponse.json({ error: 'name and systemPrompt are required.' }, { status: 400 })
  }

  const context = typeof body.context === 'string' && body.context.trim() ? body.context : null
  const mode = body.mode === 'api' ? 'api' : 'simulate'

  const target = await db.target.create({
    data: { userId, name, systemPrompt, context, mode },
    select: { id: true, name: true, mode: true, version: true, createdAt: true },
  })

  return NextResponse.json({ target }, { status: 201 })
}
