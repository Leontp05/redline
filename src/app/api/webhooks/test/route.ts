import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/webhooks/test
 * Body: { id: string }
 *
 * Sends a test message to the webhook so the user can verify their
 * Slack/Discord/custom setup works before a real scan fires.
 */
export async function POST(req: NextRequest) {
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

  // Detect the type and format a test message
  const lower = webhook.url.toLowerCase()
  const isSlack = lower.includes('hooks.slack.com')
  const isDiscord =
    lower.includes('discord.com/api/webhooks') ||
    lower.includes('discordapp.com/api/webhooks')

  let bodyToSend: string
  let headers: Record<string, string>

  const testPayload = {
    event: 'scan.complete',
    scanId: 'test-scan-id',
    targetId: 'test-target-id',
    targetName: 'Test Target',
    overallScore: 85,
    vulnerableCount: 6,
    totalCount: 40,
    timestamp: new Date().toISOString(),
  }

  if (isSlack) {
    bodyToSend = JSON.stringify({
      text: '✅ Redline Webhook Test',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '✅ Redline Webhook Test' },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Your Slack webhook is working! You\'ll receive scan results here.',
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: 'Example scan: Test Target · Score 85/100 · 6 vulnerable',
            },
          ],
        },
      ],
    })
    headers = { 'Content-Type': 'application/json' }
  } else if (isDiscord) {
    bodyToSend = JSON.stringify({
      username: 'Redline',
      embeds: [
        {
          title: '✅ Redline Webhook Test',
          color: 0x10b981,
          description: 'Your Discord webhook is working! You\'ll receive scan results here.',
          fields: [
            { name: 'Example Target', value: 'Test Target', inline: true },
            { name: 'Example Score', value: '85/100', inline: true },
            { name: 'Vulnerable', value: '6 / 40', inline: true },
          ],
          footer: { text: 'Redline — AI Security Testing Platform' },
          timestamp: testPayload.timestamp,
        },
      ],
    })
    headers = { 'Content-Type': 'application/json' }
  } else {
    // Raw JSON test
    bodyToSend = JSON.stringify({
      ...testPayload,
      message: 'This is a test webhook from Redline. Your custom endpoint is working.',
    })
    headers = { 'Content-Type': 'application/json' }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const res = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: bodyToSend,
      signal: controller.signal,
      redirect: 'error',
    })

    clearTimeout(timeout)

    // Update last delivery status
    await db.webhook.update({
      where: { id: webhook.id },
      data: {
        lastFiredAt: new Date(),
        lastStatus: res.status,
      },
    })

    if (res.ok) {
      const platform = isSlack ? 'Slack' : isDiscord ? 'Discord' : 'custom endpoint'
      return NextResponse.json({
        ok: true,
        message: `Test message sent to ${platform}! Check your channel.`,
        status: res.status,
      })
    } else {
      const errText = await res.text().catch(() => '')
      return NextResponse.json({
        ok: false,
        error: `${platform(webhook.url)} returned HTTP ${res.status}${errText ? ': ' + errText.slice(0, 200) : ''}`,
        status: res.status,
      }, { status: 400 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn('webhook.test_error', { webhookId: id, error: msg })
    return NextResponse.json({
      ok: false,
      error: `Failed to send: ${msg}`,
    }, { status: 400 })
  }
}

function platform(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('hooks.slack.com')) return 'Slack'
  if (lower.includes('discord.com/api/webhooks')) return 'Discord'
  return 'Custom endpoint'
}
