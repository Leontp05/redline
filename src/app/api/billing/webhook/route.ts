import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { handleStripeWebhook } from '@/lib/stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/billing/webhook
 *
 * Stripe webhook endpoint. Verifies the signature using STRIPE_WEBHOOK_SECRET
 * and dispatches the event to handleStripeWebhook().
 *
 * Configure this URL in your Stripe dashboard:
 *   Webhooks → Add endpoint → http://localhost:3000/api/billing/webhook (dev)
 *   or https://yourdomain.com/api/billing/webhook (prod)
 *
 * Events to subscribe:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'STRIPE_WEBHOOK_SECRET is not set.' },
      { status: 503 },
    )
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header.' },
      { status: 400 },
    )
  }

  // Get the raw body as text (Stripe needs the raw body for verification).
  const body = await req.text()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
  })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-webhook] signature verification failed:', msg)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${msg}` },
      { status: 400 },
    )
  }

  try {
    await handleStripeWebhook(event)
    return NextResponse.json({ received: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe-webhook] handler failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
