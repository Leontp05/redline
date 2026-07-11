/**
 * Plan definitions for Redline SaaS.
 *
 * Three tiers: Free, Pro, Team. Limits are enforced server-side in every
 * API route that creates expensive resources (scans, targets, hardens).
 *
 * Stripe price IDs are optional — they're only needed when Stripe is
 * configured. Set STRIPE_PRICE_PRO and STRIPE_PRICE_TEAM env vars to the
 * Stripe Price IDs from your Stripe dashboard.
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
    description: 'For trying out Redline and small projects.',
    features: {
      scansPerMonth: 3,
      maxTargets: 2,
      simulateMode: true,
      apiConnectMode: false,
      harden: false,
      priorityQueue: false,
    },
    rateLimitSeconds: 300, // 1 scan per 5 min
    stripePriceId: undefined,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 29,
    description: 'For developers testing their own LLM apps.',
    features: {
      scansPerMonth: 50,
      maxTargets: 10,
      simulateMode: true,
      apiConnectMode: true,
      harden: true,
      priorityQueue: false,
    },
    rateLimitSeconds: 30, // 1 scan per 30 sec
    stripePriceId: process.env.STRIPE_PRICE_PRO,
  },
  team: {
    id: 'team',
    name: 'Team',
    priceMonthly: 99,
    description: 'For teams security-testing multiple LLM apps.',
    features: {
      scansPerMonth: 250,
      maxTargets: -1, // unlimited
      simulateMode: true,
      apiConnectMode: true,
      harden: true,
      priorityQueue: true,
    },
    rateLimitSeconds: 10, // 1 scan per 10 sec
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
