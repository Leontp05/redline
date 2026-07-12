'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  CreditCard,
  Crown,
  Check,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  useUsage,
  useCheckout,
  usePortal,
  type Plan,
  type UsageInfo,
} from '@/lib/redline-api'

// ---------- Plan definitions (mirrors the spec table) ----------

interface PlanDef {
  key: Plan
  name: string
  price: string
  cadence: string
  scans: string
  targets: string
  apiConnect: boolean
  harden: boolean
  highlight?: boolean
  cta: string
  icon: React.ComponentType<{ className?: string }>
}

const PLANS: PlanDef[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    scans: '3 scans/mo',
    targets: '2 targets',
    apiConnect: false,
    harden: false,
    cta: 'Downgrade',
    icon: ShieldAlert,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$29',
    cadence: '/mo',
    scans: '50 scans/mo',
    targets: '10 targets',
    apiConnect: true,
    harden: true,
    highlight: true,
    cta: 'Upgrade to Pro',
    icon: Zap,
  },
  {
    key: 'team',
    name: 'Team',
    price: '$99',
    cadence: '/mo',
    scans: '250 scans/mo',
    targets: 'Unlimited targets',
    apiConnect: true,
    harden: true,
    cta: 'Upgrade to Team',
    icon: Users,
  },
]

// ---------- Small subcomponents ----------

function PlanBadge({ plan }: { plan: Plan }) {
  const cls =
    plan === 'team'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : plan === 'pro'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-border bg-background text-muted-foreground'
  const label = plan === 'team' ? 'Team' : plan === 'pro' ? 'Pro' : 'Free'
  return (
    <Badge variant="outline" className={cn('font-semibold uppercase', cls)}>
      {label}
    </Badge>
  )
}

function SubStatusPill({ status }: { status: string | null }) {
  if (!status) return null
  const cls =
    status === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'past_due'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-border bg-background text-muted-foreground'
  const label =
    status === 'past_due' ? 'Past due — update payment' : status === 'canceled' ? 'Canceled' : 'Active'
  return (
    <Badge variant="outline" className={cn('capitalize', cls)}>
      {label}
    </Badge>
  )
}

function UsageProgress({
  used,
  limit,
  label,
  unit,
}: {
  used: number
  limit: number // -1 = unlimited
  label: string
  unit: string
}) {
  const unlimited = limit < 0
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const atLimit = !unlimited && used >= limit && limit > 0
  const displayLimit = unlimited ? '∞' : String(limit)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          <span className={cn('font-semibold', atLimit && 'text-red-700')}>
            {used}
          </span>
          {' / '}
          {displayLimit} {unit}
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(
          'h-2',
          atLimit
            ? 'bg-red-100 [&>[data-slot=progress-indicator]]:bg-red-600'
            : 'bg-muted [&>[data-slot=progress-indicator]]:bg-red-500',
        )}
      />
      {atLimit && (
        <div className="text-xs font-medium text-red-700">
          Limit reached — upgrade to continue
        </div>
      )}
    </div>
  )
}

function DevModeBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="text-sm text-amber-900">
        <div className="font-semibold">Payments are in dev mode</div>
        <div className="mt-0.5 text-xs text-amber-800">
          Stripe is not configured on this server. Plan limits are still
          enforced. Upgrade buttons are disabled — set{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
            STRIPE_SECRET_KEY
          </code>{' '}
          and{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
            STRIPE_PRICE_*
          </code>{' '}
          to enable checkout.
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  current,
  hasActiveSub,
  stripeConfigured,
  onUpgrade,
  onManage,
  checkoutPending,
  managePending,
}: {
  plan: PlanDef
  current: boolean
  hasActiveSub: boolean
  stripeConfigured: boolean
  onUpgrade: () => void
  onManage: () => void
  checkoutPending: boolean
  managePending: boolean
}) {
  const Icon = plan.icon
  const popular = plan.highlight

  // Decide button state:
  //  - current → "Current plan" (disabled)
  //  - hasActiveSub → "Manage subscription" (routes to Stripe portal)
  //  - plan.key === 'free' → "Downgrade" disabled with tooltip
  //  - !stripeConfigured → "Upgrade to X" disabled with dev-mode tooltip
  //  - otherwise → "Upgrade to X" enabled
  const isUpgradeable = plan.key === 'pro' || plan.key === 'team'
  const devModeBlocked = isUpgradeable && !stripeConfigured
  const downgradeBlocked = plan.key === 'free' && !current

  const buttonLabel = current ? (
    <>
      <Check className="h-4 w-4" />
      Current plan
    </>
  ) : hasActiveSub ? (
    <>
      <CreditCard className="h-4 w-4" />
      Manage subscription
    </>
  ) : plan.key === 'free' ? (
    <>
      <CreditCard className="h-4 w-4" />
      Downgrade
    </>
  ) : (
    <>
      <Sparkles className="h-4 w-4" />
      {plan.cta}
    </>
  )

  const tooltipText = devModeBlocked
    ? 'Payments are in dev mode — Stripe is not configured.'
    : downgradeBlocked
      ? 'Downgrade via the billing portal after cancelling your current subscription.'
      : ''

  const disabled =
    current ||
    hasActiveSub ||
    devModeBlocked ||
    downgradeBlocked ||
    checkoutPending ||
    managePending

  const onClick = () => {
    if (current) return
    if (hasActiveSub) {
      onManage()
      return
    }
    if (devModeBlocked || downgradeBlocked) return
    onUpgrade()
  }

  const inner = (
    <Button
      onClick={onClick}
      disabled={disabled}
      variant={popular ? 'default' : 'outline'}
      className={cn(
        'w-full',
        popular
          ? 'bg-red-600 hover:bg-red-700'
          : 'border border-border bg-card text-foreground hover:bg-background',
      )}
    >
      {checkoutPending || managePending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {managePending ? 'Opening portal...' : 'Redirecting...'}
        </>
      ) : (
        buttonLabel
      )}
    </Button>
  )

  const wrapped =
    tooltipText && !hasActiveSub ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex w-full">{inner}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    ) : (
      inner
    )

  return (
    <Card
      className={cn(
        'relative flex flex-col',
        popular && 'border-2 border-red-500 shadow-md',
      )}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white shadow-sm">
            <Crown className="h-3 w-3" />
            Most popular
          </span>
        </div>
      )}
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg',
                popular
                  ? 'bg-red-100 text-red-700'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <CardTitle className="text-lg">{plan.name}</CardTitle>
          </div>
          {current && (
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-red-700"
            >
              Current
            </Badge>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {plan.price}
          </span>
          <span className="text-sm text-muted-foreground">{plan.cadence}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        <ul className="flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-2">
            <Check
              className={cn(
                'h-4 w-4',
                popular ? 'text-red-600' : 'text-emerald-600',
              )}
            />
            <span>{plan.scans}</span>
          </li>
          <li className="flex items-center gap-2">
            <Check
              className={cn(
                'h-4 w-4',
                popular ? 'text-red-600' : 'text-emerald-600',
              )}
            />
            <span>{plan.targets}</span>
          </li>
          <li className="flex items-center gap-2">
            {plan.apiConnect ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <span className="h-4 w-4 text-center text-xs text-muted-foreground">
                ✕
              </span>
            )}
            <span
              className={cn(
                !plan.apiConnect && 'text-muted-foreground line-through',
              )}
            >
              API-connect mode
            </span>
          </li>
          <li className="flex items-center gap-2">
            {plan.harden ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <span className="h-4 w-4 text-center text-xs text-muted-foreground">
                ✕
              </span>
            )}
            <span
              className={cn(
                !plan.harden && 'text-muted-foreground line-through',
              )}
            >
              Auto-harden prompts
            </span>
          </li>
        </ul>
        <div className="mt-auto pt-4">{wrapped}</div>
      </CardContent>
    </Card>
  )
}

function CurrentPlanBanner({ usage }: { usage: UsageInfo }) {
  const planName =
    usage.plan === 'team'
      ? 'Team'
      : usage.plan === 'pro'
        ? 'Pro'
        : 'Free'
  const isAdmin = (usage as UsageInfo & { isAdmin?: boolean }).isAdmin
  return (
    <Card className={isAdmin ? 'border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white' : 'border-red-200 bg-gradient-to-br from-red-50 via-white to-white'}>
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Crown className={isAdmin ? 'h-5 w-5 text-amber-600' : 'h-5 w-5 text-red-600'} />
            <span className="text-base font-semibold text-foreground">
              {isAdmin ? 'Admin access' : `You're on the ${planName} plan`}
            </span>
            {isAdmin ? (
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                ★ Admin — unlimited
              </Badge>
            ) : (
              <PlanBadge plan={usage.plan} />
            )}
            {!isAdmin && <SubStatusPill status={usage.subscriptionStatus} />}
          </div>
          {isAdmin ? (
            <div className="text-xs text-amber-700">
              Admin users bypass all quotas, rate limits, and feature gates.
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Billing period {format(new Date(usage.periodStart), 'MMM d')} –{' '}
              {format(new Date(usage.periodEnd), 'MMM d, yyyy')}. Quota resets{' '}
              {format(new Date(usage.resetAt), "MMM d 'at' h:mm a")}.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function UsageCard({ usage }: { usage: UsageInfo }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="text-sm">Current Period Usage</CardTitle>
        <CardDescription>
          Counts reset on {format(new Date(usage.resetAt), 'MMM d, yyyy')}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-5">
        <UsageProgress
          used={usage.scansUsed}
          limit={usage.scansLimit}
          label="Scans"
          unit="scans"
        />
        <UsageProgress
          used={usage.targetsUsed}
          limit={usage.targetsLimit}
          label="Targets"
          unit="targets"
        />
      </CardContent>
    </Card>
  )
}

function BillingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-red-600" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Billing
        </h2>
      </div>
      <Skeleton className="h-24 w-full" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  )
}

// ---------- Main view ----------

export function BillingView() {
  const { data: usage, isLoading, isError, error, refetch } = useUsage()
  const checkout = useCheckout()
  const portal = usePortal()
  // Track which plan is currently being checked out so we can show its spinner
  // (only one mutation runs at a time, but the button state should reflect it).
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null)

  const onUpgrade = (plan: 'pro' | 'team') => {
    if (!usage) return
    if (!usage.stripeConfigured) {
      toast.error('Payments are in dev mode — Stripe is not configured.')
      return
    }
    setPendingPlan(plan)
    checkout.mutate(
      { plan },
      {
        onSuccess: (url) => {
          // Redirect to Stripe Checkout. The page will unload, so we don't
          // need to reset pendingPlan on success.
          window.location.href = url
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Failed to start checkout.')
          setPendingPlan(null)
        },
      },
    )
  }

  const onManage = () => {
    portal.mutate(undefined, {
      onSuccess: (url) => {
        window.location.href = url
      },
      onError: (err: Error) => {
        toast.error(err.message || 'Failed to open billing portal.')
      },
    })
  }

  if (isLoading) return <BillingSkeleton />

  if (isError || !usage) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Card className="border-red-200">
          <CardContent className="flex flex-col items-start gap-3 p-6 text-sm">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">
                Failed to load billing information
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {error?.message ?? 'Unknown error'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasActiveSub = !!usage.subscriptionStatus

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <CreditCard className="h-5 w-5 text-red-600" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Billing
        </h2>
      </div>

      {/* Current plan banner */}
      <CurrentPlanBanner usage={usage} />

      {/* Dev mode banner */}
      {!usage.stripeConfigured && (
        <div className="mt-4">
          <DevModeBanner />
        </div>
      )}

      {/* Usage card */}
      <div className="mt-6">
        <UsageCard usage={usage} />
      </div>

      {/* Pricing cards */}
      <div className="mt-8">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Plans
        </h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              current={usage.plan === plan.key}
              hasActiveSub={hasActiveSub}
              stripeConfigured={usage.stripeConfigured}
              onUpgrade={() =>
                plan.key !== 'free' && onUpgrade(plan.key as 'pro' | 'team')
              }
              onManage={onManage}
              checkoutPending={
                checkout.isPending && pendingPlan === plan.key
              }
              managePending={portal.isPending}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Note:</span> Plan
        limits are enforced server-side on every scan and target creation. If
        you hit a limit, you&apos;ll see a clear upgrade prompt in the
        affected view. Payments are processed securely by Stripe — we never
        see or store your card details.
      </div>
    </div>
  )
}
