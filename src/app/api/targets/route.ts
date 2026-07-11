import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import { encrypt } from '@/lib/crypto'
import { canCreateTarget } from '@/lib/usage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/targets
 * Returns the authenticated user's targets ordered by createdAt desc,
 * each with a count of scans and the latest scan's overallScore.
 *
 * NOTE: apiHeaders is NEVER returned to the client (it contains secrets).
 * Only a masked indicator is returned so the UI can show "API key set".
 */
export async function GET() {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const targets = await db.target.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { scans: true } },
        scans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, overallScore: true, createdAt: true },
        },
      },
    })
    const flat = targets.map((t) => ({
      id: t.id,
      name: t.name,
      systemPrompt: t.systemPrompt,
      context: t.context,
      parentId: t.parentId,
      version: t.version,
      mode: t.mode,
      // API-connect fields — endpoint + model are not secret, headers ARE.
      apiEndpoint: t.apiEndpoint,
      apiModel: t.apiModel,
      hasApiHeaders: !!t.apiHeaders,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      scanCount: t._count.scans,
      latestScan: t.scans[0] ?? null,
    }))
    return NextResponse.json({ targets: flat })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/targets
 * Body: { name, systemPrompt, context?, mode?, apiEndpoint?, apiHeaders?, apiModel? }
 *
 * When mode='api', apiHeaders (which typically contains an Authorization
 * header with a secret API key) is ENCRYPTED at rest before being stored.
 * The encryption uses AES-256-GCM with a key from ENCRYPT_KEY env var.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check target quota (plan limit).
    const targetCheck = await canCreateTarget(userId)
    if (!targetCheck.allowed) {
      return NextResponse.json(
        { error: targetCheck.reason, code: 'QUOTA_EXCEEDED' },
        { status: 402 },
      )
    }

    const body = (await req.json()) as {
      name?: unknown
      systemPrompt?: unknown
      context?: unknown
      mode?: unknown
      apiEndpoint?: unknown
      apiHeaders?: unknown
      apiModel?: unknown
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const systemPrompt =
      typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : ''
    if (!name || !systemPrompt) {
      return NextResponse.json(
        { error: 'name and systemPrompt are required.' },
        { status: 400 },
      )
    }
    const context =
      typeof body.context === 'string' && body.context.trim().length > 0
        ? body.context
        : null
    const mode =
      body.mode === 'api' ? 'api' : ('simulate' as 'simulate' | 'api')

    // API-connect fields. When mode='api', require an endpoint.
    const apiEndpoint =
      mode === 'api' && typeof body.apiEndpoint === 'string'
        ? body.apiEndpoint.trim()
        : null
    const apiModel =
      mode === 'api' && typeof body.apiModel === 'string'
        ? body.apiModel.trim()
        : null
    // apiHeaders is encrypted at rest (it contains the user's secret API key).
    const apiHeadersRaw =
      mode === 'api' && typeof body.apiHeaders === 'string'
        ? body.apiHeaders
        : null
    const apiHeaders = encrypt(apiHeadersRaw)

    if (mode === 'api' && !apiEndpoint) {
      return NextResponse.json(
        { error: 'apiEndpoint is required when mode is "api".' },
        { status: 400 },
      )
    }

    const target = await db.target.create({
      data: {
        userId,
        name,
        systemPrompt,
        context,
        mode,
        apiEndpoint,
        apiHeaders,
        apiModel,
      },
    })

    await logAudit(userId, 'target.create', `target:${target.id}`, req, {
      name,
      mode,
      hasApiHeaders: !!apiHeaders,
    })

    // Return the target WITHOUT the encrypted headers (never expose secrets).
    return NextResponse.json(
      {
        target: {
          ...target,
          apiHeaders: undefined,
          hasApiHeaders: !!target.apiHeaders,
        },
      },
      { status: 201 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
