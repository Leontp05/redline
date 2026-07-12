'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  Crosshair,
  ListChecks,
  ShieldCheck,
  TrendingUp,
  FlaskConical,
  ArrowRight,
  Crown,
  Loader2,
  type LucideIcon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  useStats,
  useUsage,
  scoreTier,
  planDisplayName,
  type ScanListItem,
} from '@/lib/redline-api'
import { cn } from '@/lib/utils'
import { useRedlineStore } from './use-redline-store'
import { StatusBadge } from './status-badge'
import { ScoreBadge } from './score-badge'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  accent?: 'red' | 'amber' | 'emerald' | 'neutral'
}

function StatCard({ icon: Icon, label, value, hint, accent = 'red' }: StatCardProps) {
  const accentBg =
    accent === 'red'
      ? 'bg-red-50 text-red-600'
      : accent === 'amber'
        ? 'bg-amber-50 text-amber-600'
        : accent === 'emerald'
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-neutral-100 text-neutral-600'
  return (
    <Card className="gap-0">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-neutral-900">
              {value}
            </div>
            {hint && (
              <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
            )}
          </div>
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              accentBg,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function RecentScansTable({ scans }: { scans: ScanListItem[] }) {
  const goToScanReport = useRedlineStore((s) => s.goToScanReport)

  if (scans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
        <FlaskConical className="h-8 w-8 text-muted-foreground/50" />
        <div className="text-sm font-medium text-foreground">No scans yet</div>
        <div className="text-xs text-muted-foreground">
          Run your first scan to see results here.
        </div>
      </div>
    )
  }
  return (
    <div className="max-h-96 overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead>Target</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Results</TableHead>
            <TableHead className="w-8" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {scans.map((scan) => {
            const tier = scoreTier(scan.overallScore)
            return (
              <TableRow
                key={scan.id}
                onClick={() => goToScanReport(scan.id)}
                className="cursor-pointer hover:bg-red-50/40"
              >
                <TableCell className="font-medium text-neutral-900">
                  <div className="flex flex-col">
                    <span className="truncate">{scan.target.name}</span>
                    {scan.note && (
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {scan.note}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(scan.createdAt), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell>
                  <StatusBadge status={scan.status} />
                </TableCell>
                <TableCell className="text-right">
                  {scan.overallScore == null ? (
                    <span className="text-xs text-muted-foreground">–</span>
                  ) : (
                    <ScoreBadge score={scan.overallScore} />
                  )}
                  <span className="sr-only">{tier}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {scan.resultCount}
                </TableCell>
                <TableCell className="text-right">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function UsageIndicator() {
  const { data: usage, isLoading, isError } = useUsage()
  const goToBilling = useRedlineStore((s) => s.goToBilling)

  if (isLoading) {
    return (
      <Card className="mb-8 border-neutral-200 bg-white">
        <CardContent className="flex items-center gap-3 p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-2 w-24" />
        </CardContent>
      </Card>
    )
  }

  if (isError || !usage) {
    // Silent failure — usage is informational, not blocking. Render nothing
    // rather than polluting the dashboard with an error card.
    return null
  }

  const planName = planDisplayName(usage.plan)
  const unlimited = usage.scansLimit < 0
  const pct = unlimited
    ? 0
    : Math.min(100, Math.round((usage.scansUsed / usage.scansLimit) * 100))
  const atLimit = !unlimited && usage.scansUsed >= usage.scansLimit && usage.scansLimit > 0
  const scansLabel = unlimited
    ? `${usage.scansUsed} scans this month · unlimited`
    : `${usage.scansUsed}/${usage.scansLimit} scans this month`

  return (
    <Card
      className={cn(
        'mb-8',
        atLimit
          ? 'border-red-200 bg-red-50/60'
          : 'border-neutral-200 bg-white',
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                usage.plan === 'free'
                  ? 'bg-neutral-100 text-neutral-600'
                  : 'bg-red-100 text-red-700',
              )}
            >
              <Crown className="h-4 w-4" />
            </span>
            <div className="flex items-baseline gap-1.5 text-sm">
              <span className="font-semibold text-neutral-900">
                Plan: {planName}
              </span>
              <span className="text-muted-foreground">·</span>
              <span
                className={cn(
                  'tabular-nums',
                  atLimit ? 'font-semibold text-red-700' : 'text-neutral-700',
                )}
              >
                {scansLabel}
              </span>
            </div>
          </div>
          {!unlimited && (
            <div className="flex items-center gap-2 sm:w-32">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    atLimit ? 'bg-red-600' : 'bg-red-500',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
        {atLimit ? (
          <Button
            size="sm"
            onClick={goToBilling}
            className="shrink-0 bg-red-600 hover:bg-red-700"
          >
            <Crown className="h-3.5 w-3.5" />
            Upgrade
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={goToBilling}
            className="shrink-0 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            Manage plan
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardView() {
  const { data, isLoading, isError, error } = useStats()
  const setView = useRedlineStore((s) => s.setView)
  const goToNewScan = useRedlineStore((s) => s.goToNewScan)

  const isNewUser = !isLoading && !isError && data && data.targetsCount === 0

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero */}
      <section className="mb-8 rounded-xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-white p-6 sm:p-8">
        <div className="flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700">
            <Crosshair className="h-3.5 w-3.5" />
            Red-team your LLM apps
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Redline — AI Security Testing Platform
          </h1>
          <p className="max-w-3xl text-sm text-neutral-600 sm:text-base">
            Red-team your LLM apps. Run 40+ attack payloads, score
            vulnerabilities, auto-harden, re-test.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => setView('targets')} className="bg-red-600 hover:bg-red-700">
              <ListChecks className="h-4 w-4" />
              New Target
            </Button>
            <Button
              onClick={() => goToNewScan()}
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <Crosshair className="h-4 w-4" />
              Run Scan
            </Button>
          </div>
        </div>
      </section>

      {/* Onboarding banner for new users */}
      {isNewUser && (
        <Card className="mb-6 border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <FlaskConical className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-neutral-900">
                  Welcome to Redline! Let&apos;s run your first scan.
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Get started in 3 steps — takes about 2 minutes.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    onClick={() => setView('targets')}
                    className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">1</span>
                    <div>
                      <div className="text-xs font-semibold text-neutral-900">Create a target</div>
                      <div className="text-[11px] text-neutral-500">Paste your LLM&apos;s system prompt</div>
                    </div>
                  </button>
                  <button
                    onClick={() => goToNewScan()}
                    className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">2</span>
                    <div>
                      <div className="text-xs font-semibold text-neutral-900">Run a scan</div>
                      <div className="text-[11px] text-neutral-500">40 attack payloads fire automatically</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setView('billing')}
                    className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">3</span>
                    <div>
                      <div className="text-xs font-semibold text-neutral-900">Harden & re-test</div>
                      <div className="text-[11px] text-neutral-500">Auto-fix vulnerabilities, see the delta</div>
                    </div>
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setView('targets')} size="sm" className="bg-amber-600 hover:bg-amber-700">
                    <ListChecks className="h-3.5 w-3.5" />
                    Create your first target
                  </Button>
                  <Button
                    onClick={() => setView('billing')}
                    size="sm"
                    variant="outline"
                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                  >
                    View plans
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage indicator (Phase 2 — billing) */}
      <UsageIndicator />

      {/* Stat cards */}
      {isLoading ? (
        <StatCardsSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-600">
            Failed to load stats: {error?.message ?? 'unknown error'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={ListChecks}
            label="Targets"
            value={data?.targetsCount ?? 0}
            hint="Configured system prompts"
            accent="red"
          />
          <StatCard
            icon={FlaskConical}
            label="Scans Run"
            value={data?.scansCount ?? 0}
            hint="Total attack sweeps"
            accent="amber"
          />
          <StatCard
            icon={ShieldCheck}
            label="Avg Security Score"
            value={data?.avgScore == null ? '–' : Math.round(data.avgScore)}
            hint="Across all completed scans"
            accent={
              scoreTier(data?.avgScore) === 'strong'
                ? 'emerald'
                : scoreTier(data?.avgScore) === 'medium'
                  ? 'amber'
                  : 'red'
            }
          />
          <StatCard
            icon={TrendingUp}
            label="Hardening Improvements"
            value={data?.hardeningImprovements ?? 0}
            hint="Re-tests that beat the parent"
            accent="emerald"
          />
        </div>
      )}

      {/* Recent scans */}
      <section className="mt-8">
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Recent Scans</CardTitle>
                <CardDescription>
                  Last 5 scans. Click a row to view the full report.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToNewScan()}
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
              >
                <Crosshair className="h-4 w-4" />
                Run Scan
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-6 text-sm text-red-600">
                Failed to load scans.
              </div>
            ) : (
              <RecentScansTable scans={data?.recentScans ?? []} />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
