import crypto from 'crypto'
import { db } from './db'
import { logger } from './logger'

/**
 * Webhook sender with Slack + Discord auto-formatting.
 *
 * When a scan completes (or fails), Redline POSTs the scan result to all
 * active webhook URLs the user has configured.
 *
 * Auto-detection:
 *   - URL contains "hooks.slack.com" → formatted Slack Block Kit message
 *   - URL contains "discord.com/api/webhooks" → formatted Discord embed
 *   - Otherwise → raw JSON with HMAC signature (for custom servers)
 *
 * For raw JSON webhooks, the payload is signed with HMAC-SHA256 using the
 * webhook's `secret`. The recipient verifies via the `X-Redline-Signature` header:
 *
 *   signature = HMAC-SHA256(secret, JSON.stringify(payload))
 */

interface WebhookPayload {
  event: string
  scanId: string
  targetId: string
  targetName: string
  overallScore: number | null
  vulnerableCount: number
  totalCount: number
  timestamp: string
}

type WebhookType = 'slack' | 'discord' | 'raw'

function detectWebhookType(url: string): WebhookType {
  const lower = url.toLowerCase()
  if (lower.includes('hooks.slack.com')) return 'slack'
  if (lower.includes('discord.com/api/webhooks') || lower.includes('discordapp.com/api/webhooks')) return 'discord'
  return 'raw'
}

function scoreColor(score: number | null): string {
  if (score == null) return '#6b7280'
  if (score >= 80) return '#10b981' // emerald
  if (score >= 50) return '#f59e0b' // amber
  return '#ef4444' // red
}

function scoreEmoji(score: number | null): string {
  if (score == null) return '❓'
  if (score >= 80) return '🟢'
  if (score >= 50) return '🟡'
  return '🔴'
}

function scoreLabel(score: number | null): string {
  if (score == null) return 'Unknown'
  if (score >= 80) return 'Strong defenses'
  if (score >= 50) return 'Some vulnerabilities'
  return 'Critical vulnerabilities'
}

function appUrl(): string {
  return process.env.NEXTAUTH_URL || 'https://redline-orcin.vercel.app'
}

// ─── Slack formatter (Block Kit) ───

function formatSlackPayload(payload: WebhookPayload): string {
  const score = payload.overallScore
  const color = scoreColor(score)
  const isFailed = payload.event === 'scan.failed'
  const title = isFailed ? '🔴 Scan Failed' : `Redline Scan Complete ${scoreEmoji(score)}`

  const blocks: unknown[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Target:*\n${payload.targetName}`,
        },
        {
          type: 'mrkdwn',
          text: `*Score:*\n${score ?? '—'}/100 ${scoreEmoji(score)}`,
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Vulnerable:*\n${payload.vulnerableCount} / ${payload.totalCount}`,
        },
        {
          type: 'mrkdwn',
          text: `*Status:*\n${scoreLabel(score)}`,
        },
      ],
    },
  ]

  // Add a "View Report" button
  if (!isFailed) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Full Report',
          },
          url: `${appUrl()}/app?scan=${payload.scanId}`,
          style: 'primary',
        },
      ],
    })
  }

  // Slack doesn't support colored borders on messages, but we can use a
  // colored emoji + the score to convey severity.
  return JSON.stringify({
    text: title, // fallback text for notifications
    blocks,
  })
}

// ─── Discord formatter (embed) ───

function formatDiscordPayload(payload: WebhookPayload): string {
  const score = payload.overallScore
  const color = parseInt(scoreColor(score).replace('#', ''), 16)
  const isFailed = payload.event === 'scan.failed'

  const embed: Record<string, unknown> = {
    title: isFailed ? '🔴 Scan Failed' : `Redline Scan Complete ${scoreEmoji(score)}`,
    color,
    url: `${appUrl()}/app?scan=${payload.scanId}`,
    timestamp: payload.timestamp,
    fields: [
      {
        name: 'Target',
        value: payload.targetName,
        inline: true,
      },
      {
        name: 'Score',
        value: `${score ?? '—'}/100`,
        inline: true,
      },
      {
        name: 'Vulnerable',
        value: `${payload.vulnerableCount} / ${payload.totalCount}`,
        inline: true,
      },
      {
        name: 'Status',
        value: scoreLabel(score),
        inline: false,
      },
    ],
    footer: {
      text: 'Redline — AI Security Testing Platform',
    },
  }

  return JSON.stringify({
    username: 'Redline',
    embeds: [embed],
  })
}

// ─── Main sender ───

/**
 * Fire all webhooks for a user after a scan completes or fails.
 */
export async function fireWebhooks(
  userId: string,
  event: string,
  data: {
    scanId: string
    targetId: string
    targetName: string
    overallScore: number | null
    vulnerableCount: number
    totalCount: number
  },
): Promise<void> {
  const webhooks = await db.webhook.findMany({
    where: {
      userId,
      isActive: true,
    },
  })

  if (webhooks.length === 0) return

  const payload: WebhookPayload = {
    event,
    ...data,
    timestamp: new Date().toISOString(),
  }

  for (const webhook of webhooks) {
    // Check if this webhook is subscribed to this event
    const events = webhook.events.split(',').map((e) => e.trim())
    if (!events.includes(event)) continue

    const webhookType = detectWebhookType(webhook.url)

    // Build the body based on the webhook type
    let body: string
    let headers: Record<string, string>

    if (webhookType === 'slack') {
      body = formatSlackPayload(payload)
      headers = { 'Content-Type': 'application/json' }
    } else if (webhookType === 'discord') {
      body = formatDiscordPayload(payload)
      headers = { 'Content-Type': 'application/json' }
    } else {
      // Raw JSON with HMAC signature (for custom servers)
      body = JSON.stringify(payload)
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex')
      headers = {
        'Content-Type': 'application/json',
        'X-Redline-Signature': signature,
        'X-Redline-Event': event,
      }
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
        redirect: 'error',
      })

      clearTimeout(timeout)

      await db.webhook.update({
        where: { id: webhook.id },
        data: {
          lastFiredAt: new Date(),
          lastStatus: res.status,
        },
      })

      if (!res.ok) {
        logger.warn('webhook.delivery_failed', {
          webhookId: webhook.id,
          type: webhookType,
          url: webhook.url,
          status: res.status,
        })
      }
    } catch (err) {
      logger.warn('webhook.delivery_error', {
        webhookId: webhook.id,
        type: webhookType,
        url: webhook.url,
        error: err instanceof Error ? err.message : String(err),
      })

      await db.webhook
        .update({
          where: { id: webhook.id },
          data: {
            lastFiredAt: new Date(),
            lastStatus: 0,
          },
        })
        .catch(() => {})
    }
  }
}
