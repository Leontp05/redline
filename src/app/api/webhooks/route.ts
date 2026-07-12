import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { logAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/webhooks
 * List the authenticated user's webhooks.
 */
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const webhooks = await db.webhook.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      events: true,
      isActive: true,
      lastFiredAt: true,
      lastStatus: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ webhooks })
}

/**
 * POST /api/webhooks
 * Body: { url: string, events?: string }
 * Creates a new webhook. Returns the secret (for verifying signatures).
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const url = typeof body.url === 'string' ? body.url.trim() : ''

  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'A valid URL is required.' }, { status: 400 })
  }

  const events = typeof body.events === 'string' ? body.events : 'scan.complete'
  const secret = crypto.randomBytes(24).toString('hex')

  const webhook = await db.webhook.create({
    data: {
      userId,
      url,
      events,
      secret,
    },
  })

  await logAudit(userId, 'webhook.create', `webhook:${webhook.id}`, req, { url })

  return NextResponse.json({
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    secret,
    message: 'Save this secret — you\'ll need it to verify webhook signatures.',
  }, { status: 201 })
}

/**
 * DELETE /api/webhooks
 * Body: { id: string }
 */
export async function DELETE(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''

  if (!id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 })
  }

  const webhook = await db.webhook.findFirst({ where: { id, userId } })
  if (!webhook) {
    return NextResponse.json({ error: 'Webhook not found.' }, { status: 404 })
  }

  await db.webhook.delete({ where: { id } })
  await logAudit(userId, 'webhook.delete', `webhook:${id}`, req)

  return NextResponse.json({ ok: true })
}
