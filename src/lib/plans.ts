/**
 * Plan definitions for Redline SaaS.
 *
 * Three tiers: Free, Pro, Team. Limits are enforced server-side in every
 * API route that creates expensive resources (scans, targets, hardens).
 *
 * Stripe price IDs are optional — they're only needed when Stripe is
 * configured. Set STRIPE_PRICE_PRO and STRIPE_PRICE_TEAM env vars to the
 * Stripe Price IDs from your Stripe dashboard.
 *
 * NOTE: If Stripe is not available in your country (e.g. India), use
 * Razorpay instead. The billing UI + webhook pattern is the same —
 * just swap src/lib/stripe.ts for a Razorpay integration.
 */

export type PlanTier = 'free' | 'pro' | 'team'

export interface PlanConfig {
  id: PlanTier
  name: string
  priceMonthly: number // USD
  description: string
  features: {
    scansPerMonth: number // -1 = unlimited
    maxTargets: number // -1 = unlimited
    simulateMode: boolean
    apiConnectMode: boolean
    harden: boolean
    priorityQueue: boolean
  }
  rateLimitSeconds: number // min seconds between scans
  stripePriceId?: string // set via env var
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    description: 'For trying out Redline.',
    features: {
      scansPerMonth: 5,
      maxTargets: 3,
      simulateMode: true,
      apiConnectMode: false,
      harden: false,
      priorityQueue: false,
    },
    rateLimitSeconds: 300,
    stripePriceId: undefined,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 9,
    description: 'For developers testing their own LLM apps.',
    features: {
      scansPerMonth: 50,
      maxTargets: 10,
      simulateMode: true,
      apiConnectMode: true,
      harden: true,
      priorityQueue: false,
    },
    rateLimitSeconds: 60,
    stripePriceId: process.env.STRIPE_PRICE_PRO,
  },
  team: {
    id: 'team',
    name: 'Team',
    priceMonthly: 29,
    description: 'For teams security-testing multiple LLM apps.',
    features: {
      scansPerMonth: 200,
      maxTargets: -1,
      simulateMode: true,
      apiConnectMode: true,
      harden: true,
      priorityQueue: true,
    },
    rateLimitSeconds: 15,
    stripePriceId: process.env.STRIPE_PRICE_TEAM,
  },
}

export const PLAN_LIST: PlanConfig[] = [PLANS.free, PLANS.pro, PLANS.team]

/**
 * Get the plan config for a user's current plan tier.
 */
export function getPlan(tier: string | null | undefined): PlanConfig {
  if (tier === 'pro') return PLANS.pro
  if (tier === 'team') return PLANS.team
  return PLANS.free
}

/**
 * Is Stripe configured? (i.e. are the env vars set?)
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}
