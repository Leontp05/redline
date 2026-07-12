'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  Shield,
  ShieldCheck,
  Loader2,
  ArrowUp,
  Minus,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  GitBranch,
  Code2,
  ChevronDown,
  Activity,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  useScans,
  useHarden,
  useScan,
  type ScanWithRelations,
  type HardenResponse,
} from '@/lib/redline-api'
import { cn } from '@/lib/utils'
import { useRedlineStore } from './use-redline-store'
import { ScoreBadge } from './score-badge'
import { CategoryBars } from './category-bars'

// Total payloads across the 6 attack types (8+8+6+7+3+8 = 40), per the backend.
const TOTAL_PAYLOADS = 40

function HardenRewritingCard() {
  // Phase 1: the POST to /api/harden is in flight. The backend is rewriting
  // the system prompt with the LLM (~10-20s) before it returns the new IDs.
  return (
    <Card className="border-red-200 bg-red-50/40">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-red-600" />
        <div>
          <div className="text-base font-semibold text-foreground">
            Rewriting the system prompt...
          </div>
          <div className="mt-1 max-w-md text-sm text-muted-foreground">
            Analyzing detected vulnerabilities and generating a hardened prompt.
            This usually takes 10–20 seconds, after which the re-test scan
            starts automatically.
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700">
          <Sparkles className="h-3.5 w-3.5" />
          Auto-patching vulnerabilities
        </div>
      </CardContent>
    </Card>
  )
}

function HardenPollingCard({ completed }: { completed: number }) {
  // Phase 2: the hardened scan is running in the background. Poll every 3s.
  const pct = Math.min(100, Math.round((completed / TOTAL_PAYLOADS) * 100))
  return (
    <Card className="border-red-200 bg-red-50/40">
      <CardContent className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-red-600" />
            <span className="text-base font-semibold text-foreground">
              Hardened scan in progress...
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
              <Activity className="h-3 w-3" />
              live
            </span>
          </div>
          <div className="text-sm font-medium tabular-nums text-muted-foreground">
            {completed} of {TOTAL_PAYLOADS} payloads completed
          </div>
        </div>

        <Progress
          value={pct}
          className="h-2.5 bg-red-100 [&>[data-slot=progress-indicator]]:bg-red-600"
        />

        <div className="text-xs text-muted-foreground">
          Re-running the full attack suite against the hardened prompt. This
          takes about 2 minutes. The before/after comparison appears here once
          it completes.
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreColumn({
  title,
  scan,
  highlight,
}: {
  title: string
  scan: ScanWithRelations
  highlight?: 'before' | 'after'
}) {
  const vulnCount = scan.results.filter((r) => r.success).length
  return (
    <Card
      className={cn(
        highlight === 'after'
          ? 'border-emerald-200 bg-emerald-50/30'
          : highlight === 'before'
            ? 'border-red-200 bg-red-50/20'
            : '',
      )}
    >
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="secondary" className="font-mono">
            v{scan.target.version}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {scan.results.length} results · {vulnCount} vulnerable
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Overall score
            </div>
            <div
              className={cn(
                'text-4xl font-bold tabular-nums',
                scan.overallScore == null
                  ? 'text-muted-foreground'
                  : scan.overallScore >= 80
                    ? 'text-emerald-600'
                    : scan.overallScore >= 50
                      ? 'text-amber-600'
                      : 'text-red-600',
              )}
            >
              {scan.overallScore == null ? '–' : scan.overallScore}
            </div>
          </div>
          <ScoreBadge score={scan.overallScore} />
        </div>
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </div>
          <CategoryBars scores={scan.categoryScores} compact />
        </div>
      </CardContent>
    </Card>
  )
}

function DeltaIndicator({
  before,
  after,
}: {
  before: number | null
  after: number | null
}) {
  if (before == null || after == null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
        <Minus className="h-4 w-4" />
        Score data unavailable
      </div>
    )
  }
  const delta = after - before
  if (delta > 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
        <ArrowUp className="h-4 w-4" />
        Score improved by +{delta} points
      </div>
    )
  }
  if (delta < 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        <ArrowUp className="h-4 w-4 rotate-180" />
        Score dropped by {delta} points
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
      <Minus className="h-4 w-4" />
      Score did not improve
    </div>
  )
}

function VulnerabilitiesClosedTable({
  original,
  hardened,
}: {
  original: ScanWithRelations
  hardened: ScanWithRelations
}) {
  // Build a map: attackTypeKey -> { wasVuln, nowVuln, name, category }
  const map = new Map<
    string,
    { key: string; name: string; category: string; wasVuln: boolean; nowVuln: boolean }
  >()

  for (const r of original.results) {
    const e =
      map.get(r.attackType.key) ??
      ({
        key: r.attackType.key,
        name: r.attackType.name,
        category: r.attackType.category,
        wasVuln: false,
        nowVuln: false,
      } as const)
    if (r.success) e.wasVuln = true
    map.set(r.attackType.key, { ...e, wasVuln: e.wasVuln || r.success })
  }
  for (const r of hardened.results) {
    const e =
      map.get(r.attackType.key) ??
      ({
        key: r.attackType.key,
        name: r.attackType.name,
        category: r.attackType.category,
        wasVuln: false,
        nowVuln: false,
      } as const)
    map.set(r.attackType.key, { ...e, nowVuln: r.success })
  }

  // Only show attack types that were vulnerable before (the spec says so)
  const rows = Array.from(map.values())
    .filter((r) => r.wasVuln)
    .sort((a, b) => a.name.localeCompare(b.name))

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-border bg-background p-6 text-center text-sm text-muted-foreground">
        No vulnerabilities were present before hardening.
      </div>
    )
  }

  return (
    <div className="max-h-96 overflow-y-auto rounded-md border border-border">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead>Attack Type</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Before</TableHead>
            <TableHead>After</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const closed = r.wasVuln && !r.nowVuln
            return (
              <TableRow key={r.key}>
                <TableCell className="font-medium text-foreground">
                  {r.name}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {r.category}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                    <XCircle className="h-3.5 w-3.5" />
                    Vulnerable
                  </span>
                </TableCell>
                <TableCell>
                  {r.nowVuln ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                      <XCircle className="h-3.5 w-3.5" />
                      Still vulnerable
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Defended
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {closed ? (
                    <Badge className="border-transparent bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      Closed
                    </Badge>
                  ) : (
                    <Badge className="border-transparent bg-red-100 text-red-800">
                      <XCircle className="h-3 w-3" />
                      Still open
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function HardenedPromptBlock({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Code2 className="h-4 w-4 text-red-600" />
                Hardened System Prompt
              </CardTitle>
              <CardDescription className="text-xs">
                The rewritten system prompt that closes detected gaps.
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    open && 'rotate-180',
                  )}
                />
                {open ? 'Collapse' : 'Expand'}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="p-5">
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-neutral-900 p-4 font-mono text-xs leading-relaxed text-neutral-100">
              {prompt}
            </pre>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function BeforeAfterComparison({
  originalScan,
  hardenedScan,
}: {
  originalScan: ScanWithRelations
  hardenedScan: ScanWithRelations
}) {
  const delta =
    originalScan.overallScore != null && hardenedScan.overallScore != null
      ? hardenedScan.overallScore - originalScan.overallScore
      : null

  return (
    <div className="flex flex-col gap-6">
      {/* Delta banner */}
      <DeltaIndicator
        before={originalScan.overallScore}
        after={hardenedScan.overallScore}
      />

      {/* Two-column comparison */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScoreColumn
          title="Before"
          scan={originalScan}
          highlight="before"
        />
        <ScoreColumn
          title="After"
          scan={hardenedScan}
          highlight="after"
        />
      </div>

      {/* Vulnerabilities closed table */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Vulnerabilities Closed</CardTitle>
          <CardDescription>
            Each attack type that was vulnerable before — and whether the
            hardened prompt now defends against it.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <VulnerabilitiesClosedTable
            original={originalScan}
            hardened={hardenedScan}
          />
        </CardContent>
      </Card>

      {/* Hardened prompt (the new target's system prompt) */}
      <HardenedPromptBlock prompt={hardenedScan.target.systemPrompt} />

      {delta !== null && delta > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            Hardening improved the security score by{' '}
            <strong>+{delta} points</strong>. The new target{' '}
            <strong>{hardenedScan.target.name}</strong> (v
            {hardenedScan.target.version}) has been saved.
          </span>
        </div>
      )}
    </div>
  )
}

export function HardenView() {
  const { data: scans, isLoading: scansLoading } = useScans()
  const hardenScanId = useRedlineStore((s) => s.hardenScanId)
  const setHardenScanId = useRedlineStore((s) => s.setHardenScanId)
  const harden = useHarden()

  // Local state: the IDs returned by the (async) harden POST. While the POST
  // is in flight, `harden.isPending` is true. After it resolves, we stash the
  // IDs here so we can poll the hardened scan + fetch the original scan for
  // the before/after comparison.
  const [hardenResult, setHardenResult] = useState<HardenResponse | null>(null)

  // Poll the hardened scan every 3s while it's still running (handled by
  // useScan's refetchInterval). Once it flips to 'complete' or 'failed', the
  // polling stops automatically.
  const {
    data: hardenedScan,
    isLoading: hardenedLoading,
    isError: hardenedIsError,
    error: hardenedError,
  } = useScan(hardenResult?.hardenedScanId)

  // Fetch the original scan (it's already complete — no polling needed, but
  // useScan will still apply the running-poll logic harmlessly since the
  // original scan's status is 'complete').
  const {
    data: originalScan,
    isLoading: originalLoading,
    isError: originalIsError,
    error: originalError,
  } = useScan(hardenResult?.originalScanId)

  // Use the store value directly as the controlled scan id. Fall back to
  // the most recent scan so the user always has a valid selection without
  // needing a `setState` inside an effect.
  const selectedScanId =
    hardenScanId || (scans && scans.length > 0 ? scans[0].id : '')

  const selectedScanSummary = useMemo(
    () => scans?.find((s) => s.id === selectedScanId),
    [scans, selectedScanId],
  )

  const handleHarden = () => {
    if (!selectedScanId) {
      toast.error('Pick a scan to harden.')
      return
    }
    // Clear any previous result before kicking off a new harden.
    setHardenResult(null)
    harden.mutate(
      { scanId: selectedScanId },
      {
        onSuccess: (resp) => {
          // Async harden: POST returns immediately with the three IDs.
          // Stash them so the useScan hooks below start polling/fetching.
          setHardenResult(resp)
          toast.success('Hardened prompt generated. Re-testing now...')
        },
        onError: (err: Error) => {
          toast.error(err.message || 'Hardening failed.')
        },
      },
    )
  }

  // Derive the "current phase" for the UI:
  // - 'idle'      : nothing in flight, no result yet
  // - 'rewriting' : POST to /api/harden is in flight (LLM rewriting the prompt)
  // - 'polling'   : IDs returned, hardened scan is running in the background
  // - 'complete'  : hardened scan finished (complete or failed)
  const phase: 'idle' | 'rewriting' | 'polling' | 'complete' =
    harden.isPending
      ? 'rewriting'
      : hardenResult && hardenedScan?.status === 'running'
        ? 'polling'
        : hardenResult && hardenedScan
          ? 'complete'
          : 'idle'

  const hardenedFailed = phase === 'complete' && hardenedScan?.status === 'failed'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <Shield className="h-5 w-5 text-red-600" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Harden
        </h2>
      </div>

      {/* Selector + summary */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-red-600" />
            1. Pick a Scan to Harden
          </CardTitle>
          <CardDescription>
            Choose a completed scan with detected vulnerabilities. Redline will
            rewrite the prompt and re-test it.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          {scansLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : scans && scans.length > 0 ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Select
                  value={selectedScanId}
                  onValueChange={(v) => {
                    setHardenScanId(v)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a scan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scans.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.target.name} ·{' '}
                        {formatDistanceToNow(new Date(s.createdAt), {
                          addSuffix: true,
                        })}
                        {s.overallScore != null
                          ? ` · score ${s.overallScore}`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleHarden}
                disabled={harden.isPending || !selectedScanId}
                className="bg-red-600 hover:bg-red-700"
              >
                {harden.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Hardening...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Harden Prompt
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No scans available. Run a scan first.
            </div>
          )}

          {selectedScanSummary && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Overall score
                </div>
                <div className="mt-1">
                  <ScoreBadge score={selectedScanSummary.overallScore} />
                </div>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Results
                </div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {selectedScanSummary.resultCount}
                </div>
              </div>
              <div className="col-span-2 rounded-md border border-border bg-background p-3 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Target
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-foreground">
                  {selectedScanSummary.target.name}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 1: rewriting the prompt (POST in flight) */}
      {phase === 'rewriting' && (
        <div className="mt-6">
          <HardenRewritingCard />
        </div>
      )}

      {/* Phase 2: hardened scan polling in the background */}
      {phase === 'polling' && (
        <div className="mt-6">
          <HardenPollingCard completed={hardenedScan?.results.length ?? 0} />
        </div>
      )}

      {/* Error from the harden POST itself (e.g. "no successful attacks") */}
      {harden.isError && (
        <Card className="mt-6 border-red-200 bg-red-50/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Hardening failed</div>
              <div className="text-xs">
                {harden.error?.message ?? 'Unknown error'}
              </div>
              <div className="mt-1 text-xs text-red-600/80">
                Tip: this happens if the scan has no successful attacks. Pick a
                scan with detected vulnerabilities.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hardened scan failed in the background */}
      {hardenedFailed && (
        <Card className="mt-6 border-red-200 bg-red-50/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">
                Hardened re-test scan failed
              </div>
              <div className="text-xs">
                {hardenedScan?.note ||
                  hardenedError?.message ||
                  'The re-test scan did not complete successfully.'}
              </div>
              <div className="mt-1 text-xs text-red-600/80">
                The hardened prompt was still saved as a new target — you can
                run a fresh scan on it from the New Scan tab.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errors fetching the original scan (shouldn't normally happen) */}
      {phase === 'complete' && originalIsError && (
        <Card className="mt-6 border-red-200 bg-red-50/40">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Could not load original scan</div>
              <div className="text-xs">
                {originalError?.message ?? 'Unknown error'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase 3: hardened scan complete — show the before/after comparison */}
      {phase === 'complete' &&
        !hardenedFailed &&
        hardenedScan &&
        originalScan &&
        !originalLoading &&
        !hardenedLoading && (
          <div className="mt-8">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Before / After
            </h3>
            <BeforeAfterComparison
              originalScan={originalScan}
              hardenedScan={hardenedScan}
            />
          </div>
        )}

      {/* Loading the original scan after the hardened one completes */}
      {phase === 'complete' &&
        !hardenedFailed &&
        hardenedScan &&
        (originalLoading || hardenedLoading) && (
          <div className="mt-8 flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading before/after comparison...
          </div>
        )}

      {/* Idle: no harden triggered yet */}
      {phase === 'idle' && !harden.isError && (
        <div className="mt-8">
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <Shield className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-sm font-medium text-foreground">
                Ready to harden
              </div>
              <div className="max-w-md text-xs text-muted-foreground">
                Pick a scan above and click <strong>Harden Prompt</strong>.
                Redline will rewrite the system prompt to close detected gaps
                and re-run the full attack suite.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
