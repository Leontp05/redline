'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  FlaskConical,
  Lock,
  AlertCircle,
  Activity,
  RefreshCw,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'

import { useScan, useUsage, planHasHarden, type ScanResult } from '@/lib/redline-api'
import { cn } from '@/lib/utils'
import { useRedlineStore } from './use-redline-store'
import { StatusBadge } from './status-badge'
import { ScoreGauge } from './score-gauge'
import { CategoryBars } from './category-bars'

// Total payloads across the 6 attack types (8+8+6+7+3+8 = 40), per the backend.
const TOTAL_PAYLOADS = 40

type OutcomeFilter = 'all' | 'vulnerable' | 'defended'

function ReportSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-48" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full lg:col-span-2" />
      </div>
      <Skeleton className="mt-6 h-96 w-full" />
    </div>
  )
}

function LiveProgressCard({ completed }: { completed: number }) {
  const pct = Math.min(100, Math.round((completed / TOTAL_PAYLOADS) * 100))
  return (
    <Card className="mb-6 border-red-200 bg-red-50/40">
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-red-600" />
            <span className="text-base font-semibold text-neutral-900">
              Scan in progress...
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
              <Activity className="h-3 w-3" />
              live
            </span>
          </div>
          <div className="text-sm font-medium tabular-nums text-neutral-700">
            {completed} of {TOTAL_PAYLOADS} payloads completed
          </div>
        </div>

        <Progress
          value={pct}
          className="h-2.5 bg-red-100 [&>[data-slot=progress-indicator]]:bg-red-600"
        />

        <div className="text-xs text-muted-foreground">
          Results appear here as they complete. This takes about 2 minutes. The
          page auto-refreshes every few seconds — keep this tab open.
        </div>
      </CardContent>
    </Card>
  )
}

function FailedCard({ message }: { message: string }) {
  const goToNewScan = useRedlineStore((s) => s.goToNewScan)
  return (
    <Card className="mb-6 border-red-200 bg-red-50/40">
      <CardContent className="flex items-start gap-3 p-5 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <div className="font-semibold">Scan failed</div>
          <div className="mt-0.5 text-xs">{message}</div>
          <div className="mt-1 text-xs text-red-600/80">
            The background scan hit an unexpected error. This usually happens
            when the LLM provider is rate-limited or the target endpoint is
            unreachable.
          </div>
          <Button
            onClick={() => goToNewScan()}
            size="sm"
            className="mt-3 bg-red-600 hover:bg-red-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run a new scan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ConversationThread({ turns }: { turns: ScanResult['conversation'] }) {
  if (!turns || turns.length === 0) {
    return <div className="text-xs text-muted-foreground">No conversation.</div>
  }
  return (
    <div className="flex flex-col gap-2">
      {turns.map((turn, i) => {
        const isUser = turn.role === 'user'
        return (
          <div
            key={i}
            className={cn(
              'rounded-md border p-2 text-xs',
              isUser
                ? 'border-red-200 bg-red-50/50'
                : 'border-neutral-200 bg-neutral-50',
            )}
          >
            <div className="mb-1 flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-semibold uppercase',
                  isUser
                    ? 'border-red-200 bg-white text-red-700'
                    : 'border-neutral-300 bg-white text-neutral-700',
                )}
              >
                {turn.role}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                turn {i + 1}
              </span>
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-700">
              {turn.content}
            </pre>
          </div>
        )
      })}
    </div>
  )
}

function ResultRow({ result }: { result: ScanResult }) {
  const [expanded, setExpanded] = useState(false)
  const isVuln = result.success
  const hasConversation = !!result.conversation && result.conversation.length > 0

  return (
    <>
      <TableRow
        onClick={() => setExpanded((v) => !v)}
        className="cursor-pointer hover:bg-red-50/40"
      >
        <TableCell className="w-8">
          <ChevronRight
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="font-medium text-neutral-900">
              {result.attackType.name}
            </span>
            <Badge variant="outline" className="w-fit text-[10px] capitalize">
              {result.attackType.category}
            </Badge>
          </div>
        </TableCell>
        <TableCell className="text-sm text-neutral-700">
          {result.technique}
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className="border-red-200 bg-red-50 text-[10px] text-red-700"
          >
            sev {result.attackType.severityWeight}
          </Badge>
        </TableCell>
        <TableCell>
          {isVuln ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
              <ShieldAlert className="h-3 w-3" />
              Vulnerable
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-3 w-3" />
              Defended
            </span>
          )}
        </TableCell>
        <TableCell className="max-w-xs">
          <div className="truncate text-xs text-muted-foreground">
            {result.evidence || '—'}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-neutral-50/60 hover:bg-neutral-50/60">
          <TableCell colSpan={6} className="p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Payload sent
                </div>
                <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-neutral-200 bg-white p-3 font-mono text-[11px] text-neutral-700">
                  {result.payload}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Model response
                </div>
                <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-neutral-200 bg-white p-3 font-mono text-[11px] text-neutral-700">
                  {result.response || '—'}
                </pre>
              </div>
              {hasConversation && (
                <div className="lg:col-span-2">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Conversation thread ({result.conversation!.length} turns)
                  </div>
                  <ConversationThread turns={result.conversation} />
                </div>
              )}
              {result.evidence && (
                <div className="lg:col-span-2">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Evidence
                  </div>
                  <pre className="whitespace-pre-wrap break-words rounded-md border border-amber-200 bg-amber-50/40 p-3 font-mono text-[11px] text-amber-800">
                    {result.evidence}
                  </pre>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function ResultsTable({
  results,
  title,
}: {
  results: ScanResult[]
  title?: string
}) {
  const [outcome, setOutcome] = useState<OutcomeFilter>('all')
  const [attackFilter, setAttackFilter] = useState<string>('all')

  const attackTypes = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>()
    for (const r of results) {
      if (!seen.has(r.attackType.id)) {
        seen.set(r.attackType.id, {
          id: r.attackType.id,
          name: r.attackType.name,
        })
      }
    }
    return Array.from(seen.values())
  }, [results])

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (outcome === 'vulnerable' && !r.success) return false
      if (outcome === 'defended' && r.success) return false
      if (attackFilter !== 'all' && r.attackTypeId !== attackFilter) return false
      return true
    })
  }, [results, outcome, attackFilter])

  const vulnCount = results.filter((r) => r.success).length
  const defendedCount = results.length - vulnCount

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{title ?? 'Per-Attack Results'}</CardTitle>
            <CardDescription>
              {results.length} total · {vulnCount} vulnerable · {defendedCount}{' '}
              defended. Click a row to expand details.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={outcome} onValueChange={(v) => setOutcome(v as OutcomeFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="vulnerable">Vulnerable</TabsTrigger>
                <TabsTrigger value="defended">Defended</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={attackFilter} onValueChange={setAttackFilter}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="All attack types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All attack types</SelectItem>
                {attackTypes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[36rem] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Attack Type</TableHead>
                <TableHead>Technique</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="max-w-xs">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    {results.length === 0
                      ? 'No results yet — waiting for the scan to produce its first payload result.'
                      : 'No results match your filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => <ResultRow key={r.id} result={r} />)
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function ScanReportView() {
  const selectedScanId = useRedlineStore((s) => s.selectedScanId)
  const goToHarden = useRedlineStore((s) => s.goToHarden)
  const goToBilling = useRedlineStore((s) => s.goToBilling)
  const { data: scan, isLoading, isError, error } = useScan(selectedScanId)
  const { data: usage } = useUsage()
  // Plan feature gate: free users can't auto-harden. They see the button
  // disabled with a lock icon and an upgrade tooltip.
  const planAllowsHarden = planHasHarden(usage?.plan)
  const planLocked = !planAllowsHarden

  if (!selectedScanId) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-12 text-center sm:px-6">
        <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-3 text-base font-semibold">No scan selected</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a scan from the Dashboard or run a new one.
        </p>
      </div>
    )
  }

  if (isLoading) return <ReportSkeleton />

  if (isError || !scan) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <Card>
          <CardContent className="p-6 text-sm text-red-600">
            Failed to load scan: {error?.message ?? 'unknown error'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const isRunning = scan.status === 'running'
  const isFailed = scan.status === 'failed'
  const vulnerableCount = scan.results.filter((r) => r.success).length
  const hasVulns = vulnerableCount > 0
  // Harden is only actionable once the scan has fully completed AND found
  // vulnerabilities. While running, disable with a "still running" tooltip;
  // when complete with no vulns, disable with "nothing to harden".
  // Phase 2: also gated by plan — free users see a lock + upgrade tooltip.
  const canHarden = !isRunning && !isFailed && hasVulns && !planLocked
  const hardenTooltip = isRunning
    ? 'Scan still running...'
    : isFailed
      ? 'Scan failed — nothing to harden.'
      : planLocked
        ? hasVulns
          ? 'Upgrade to Pro to auto-harden prompts'
          : 'No vulnerabilities found — nothing to harden.'
        : hasVulns
          ? null
          : 'No vulnerabilities found — nothing to harden.'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
              {scan.target.name}
            </h2>
            <StatusBadge status={scan.status} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Created {format(new Date(scan.createdAt), 'PPpp')} ·{' '}
            {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })}
          </div>
          {scan.note && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
              <ShieldAlert className="h-3 w-3" />
              {scan.note}
            </div>
          )}
        </div>

        {/* Harden button */}
        <div className="flex shrink-0 items-center gap-2">
          {canHarden ? (
            <Button
              onClick={() => goToHarden(scan.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              <ShieldCheck className="h-4 w-4" />
              Harden This Prompt
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex">
                  <Button disabled className="cursor-not-allowed">
                    <Lock className="h-4 w-4" />
                    Harden This Prompt
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{hardenTooltip}</TooltipContent>
            </Tooltip>
          )}
          {planLocked && hasVulns && !isRunning && !isFailed && (
            <Button
              onClick={goToBilling}
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
            >
              <Lock className="h-3.5 w-3.5" />
              Upgrade to Pro
            </Button>
          )}
        </div>
      </div>

      {/* Live progress / failed banner — only shown while running or failed */}
      {isRunning && <LiveProgressCard completed={scan.results.length} />}
      {isFailed && (
        <FailedCard
          message={scan.note || 'The scan did not complete successfully.'}
        />
      )}

      {/* Score gauge + category breakdown — hidden while running (scores are
          null until the scan completes); shown for complete + failed scans
          (failed scans may still have partial scores if scoring ran). */}
      {!isRunning && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="border-b">
              <CardTitle className="text-sm">Overall Security Score</CardTitle>
              <CardDescription>
                Weighted by attack severity. Higher is more secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center p-6">
              <ScoreGauge score={scan.overallScore} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="border-b">
              <CardTitle className="text-sm">Category Breakdown</CardTitle>
              <CardDescription>
                Per-category scores across the 5 attack categories.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <CategoryBars scores={scan.categoryScores} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results table — always shown (including while running, so the user
          sees partial results stream in as the background job persists them). */}
      <div className={cn('mt-6', isRunning && 'opacity-95')}>
        <ResultsTable
          results={scan.results}
          title={isRunning ? 'Partial Results (streaming)' : undefined}
        />
      </div>
    </div>
  )
}
