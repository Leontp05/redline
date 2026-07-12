/**
 * Email notification helper.
 *
 * Uses Resend (resend.com) — generous free tier (100 emails/day).
 *
 * To enable:
 *   1. Sign up at resend.com
 *   2. Get your API key (re_xxx)
 *   3. Set RESEND_API_KEY env var
 *   4. Set EMAIL_FROM=redline@yourdomain.com (must be a verified domain in Resend)
 *
 * Without RESEND_API_KEY, all email functions are a no-op (returns silently).
 * This lets the app run in dev without email — scans still work, just no
 * notifications.
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Send an email via Resend. No-op if RESEND_API_KEY is not set.
 */
export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Email not configured — silent no-op
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Redline <noreply@redline.dev>',
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[email] Resend API error:', err)
      return false
    }

    return true
  } catch (err) {
    console.error('[email] Failed to send:', err)
    return false
  }
}

/**
 * Notify a user that their scan has completed.
 */
export async function notifyScanComplete(opts: {
  email: string
  targetName: string
  scanId: string
  overallScore: number | null
  vulnerableCount: number
  totalCount: number
  appUrl: string
}): Promise<void> {
  const { email, targetName, scanId, overallScore, vulnerableCount, totalCount, appUrl } = opts
  const defendedCount = totalCount - vulnerableCount
  const scoreColor = overallScore == null ? '#6b7280' : overallScore >= 80 ? '#10b981' : overallScore >= 50 ? '#f59e0b' : '#ef4444'

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e5e5e5; padding: 32px; border-radius: 12px; border: 1px solid #262626;">
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; color: #ef4444;">
          <span style="display: inline-block; width: 24px; height: 24px; background: #ef4444; border-radius: 6px; text-align: center; line-height: 24px; color: white; font-size: 14px;">⚠</span>
          Redline
        </span>
      </div>

      <h1 style="font-size: 22px; font-weight: 700; color: white; margin: 0 0 8px 0;">
        Your scan is complete
      </h1>
      <p style="font-size: 14px; color: #a3a3a3; margin: 0 0 24px 0;">
        Target: <strong style="color: #e5e5e5;">${targetName}</strong>
      </p>

      <div style="background: #171717; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #262626;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #737373; margin-bottom: 8px;">Security Score</div>
        <div style="font-size: 48px; font-weight: 800; color: ${scoreColor}; line-height: 1;">
          ${overallScore ?? '—'}<span style="font-size: 16px; color: #525252;">/100</span>
        </div>
      </div>

      <div style="display: flex; gap: 12px; margin-bottom: 24px;">
        <div style="flex: 1; background: #171717; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #262626;">
          <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${vulnerableCount}</div>
          <div style="font-size: 11px; color: #737373; margin-top: 4px;">Vulnerable</div>
        </div>
        <div style="flex: 1; background: #171717; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #262626;">
          <div style="font-size: 24px; font-weight: 700; color: #10b981;">${defendedCount}</div>
          <div style="font-size: 11px; color: #737373; margin-top: 4px;">Defended</div>
        </div>
      </div>

      <a href="${appUrl}/app?scan=${scanId}" style="display: block; background: #ef4444; color: white; text-align: center; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        View Full Report →
      </a>

      <p style="font-size: 12px; color: #525252; margin-top: 24px; text-align: center;">
        You received this email because scan notifications are enabled.
      </p>
    </div>
  `

  await sendEmail({
    to: email,
    subject: `Redline scan complete — ${targetName} scored ${overallScore ?? '—'}/100`,
    html,
    text: `Your Redline scan of "${targetName}" is complete.\n\nSecurity Score: ${overallScore ?? '—'}/100\nVulnerable: ${vulnerableCount}/${totalCount}\n\nView report: ${appUrl}/app?scan=${scanId}`,
  })
}
