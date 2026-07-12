import crypto from 'crypto'
import { db } from './db'
import { logger } from './logger'

/**
 * Webhook sender.
 *
 * When a scan completes (or fails), Redline POSTs the scan result to all
 * active webhook URLs the user has configured.
 *
 * Each webhook has a `secret` that's used to sign the payload (HMAC-SHA256).
 * The recipient verifies the signature using the `X-Redline-Signature` header:
 *
 *   signature = HMAC-SHA256(secret, JSON.stringify(payload))
 *
 * The payload includes:
 *   - event: "scan.complete" | "scan.failed"
 *   - scanId, targetId, targetName
 *   - overallScore, vulnerableCount, totalCount
 *   - timestamp
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

/**
 * Fire all webhooks for a user after a scan completes or fails.
 *
 * @param userId   The user who owns the scan
 * @param event    "scan.complete" or "scan.failed"
 * @param data     The scan data to include in the payload
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

  const body = JSON.stringify(payload)

  for (const webhook of webhooks) {
    // Check if this webhook is subscribed to this event
    const events = webhook.events.split(',').map((e) => e.trim())
    if (!events.includes(event)) continue

    try {
      // Sign the payload with the webhook's secret (HMAC-SHA256)
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(body)
        .digest('hex')

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000) // 10s timeout

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Redline-Signature': signature,
          'X-Redline-Event': event,
        },
        body,
        signal: controller.signal,
        redirect: 'error', // never follow redirects (SSRF protection)
      })

      clearTimeout(timeout)

      // Update the webhook's last delivery status
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
          url: webhook.url,
          status: res.status,
        })
      }
    } catch (err) {
      // Network error, timeout, DNS failure, etc.
      logger.warn('webhook.delivery_error', {
        webhookId: webhook.id,
        url: webhook.url,
        error: err instanceof Error ? err.message : String(err),
      })

      // Still record the attempt
      await db.webhook
        .update({
          where: { id: webhook.id },
          data: {
            lastFiredAt: new Date(),
            lastStatus: 0, // 0 = network error
          },
        })
        .catch(() => {})
    }
  }
}
