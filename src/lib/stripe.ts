import Stripe from 'stripe'
import { PLANS, isStripeConfigured } from './plans'

/**
 * Stripe integration.
 *
 * If STRIPE_SECRET_KEY is not set, all functions return null/throw clearly.
 * This lets the app run in "dev mode" without Stripe — plan enforcement
 * and usage tracking still work, just no payment processing.
 *
 * To enable payments:
 *   1. Create a Stripe account
 *   2. Get your test mode secret key (sk_test_...)
 *   3. Create products + prices for Pro ($29/mo) and Team ($99/mo)
 *   4. Set env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM,
 *      STRIPE_WEBHOOK_SECRET
 *   5. Set up a webhook endpoint pointing to /api/billing/webhook
 *      (events: checkout.session.completed, customer.subscription.updated,
 *       customer.subscription.deleted)
 */

let stripeInstance: Stripe | null = null

export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null
  if (!stripeInstance) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    })
  }
  return stripeInstance
}

/**
 * Create a Stripe Checkout Session for upgrading to a paid plan.
 * Returns the session URL to redirect the user to, or null if Stripe
 * isn't configured.
 */
export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  planTier: 'pro' | 'team',
  customerId?: string | null,
): Promise<{ url: string } | null> {
  const stripe = getStripe()
  if (!stripe) return null

  const plan = PLANS[planTier]
  if (!plan.stripePriceId) {
    throw new Error(
      `STRIPE_PRICE_${planTier.toUpperCase()} env var is not set. Create the price in Stripe and set it.`,
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: customerId ? undefined : userEmail,
    customer: customerId || undefined,
    line_items: [
      {
        price: plan.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXTAUTH_URL}/?billing=success`,
    cancel_url: `${process.env.NEXTAUTH_URL}/?billing=canceled`,
    client_reference_id: userId,
    metadata: {
      userId,
      plan: planTier,
    },
    subscription_data: {
      metadata: {
        userId,
        plan: planTier,
      },
    },
  })

  return { url: session.url! }
}

/**
 * Create a Stripe Customer Portal session (for managing subscriptions —
 * upgrade/downgrade/cancel, update payment method, view invoices).
 */
export async function createPortalSession(
  customerId: string,
): Promise<{ url: string } | null> {
  const stripe = getStripe()
  if (!stripe) return null

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXTAUTH_URL}/?billing=portal`,
  })

  return { url: session.url }
}

/**
 * Handle a Stripe webhook event. Updates the user's plan + subscription
 * status in the database.
 */
export async function handleStripeWebhook(
  event: Stripe.Event,
): Promise<void> {
  const stripe = getStripe()
  if (!stripe) return

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id || session.metadata?.userId
      const planTier = session.metadata?.plan as 'pro' | 'team' | undefined
      if (!userId || !planTier) break

      // Get the subscription to find the customer + period end.
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string,
      )

      await db.user.update({
        where: { id: userId },
        data: {
          plan: planTier,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      })
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      const planTier = subscription.metadata?.plan as 'pro' | 'team' | undefined
      if (!userId) break

      await db.user.update({
        where: { id: userId },
        data: {
          plan: planTier || undefined,
          subscriptionStatus: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        },
      })
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.userId
      if (!userId) break

      // Downgrade to free when subscription is canceled.
      await db.user.update({
        where: { id: userId },
        data: {
          plan: 'free',
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: null,
        },
      })
      break
    }

    default:
      // Ignore unhandled events.
      break
  }
}

// Import db here to avoid circular dependency in the webhook handler.
import { db } from './db'
