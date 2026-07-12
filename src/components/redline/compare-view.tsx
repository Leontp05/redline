'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { GitCompare, Loader2, ArrowRight } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useScans,
  useScan,
  type ScanListItem,
} from '@/lib/redline-api'
import { cn } from '@/lib/utils'
import { ScoreBadge } from './score-badge'
import { CategoryBars } from './category-bars'

function ComparisonColumn({
  label,
  scan,
  loading,
}: {
  label: string
  scan: ReturnType<typeof useScan>
  loading: boolean
}) {
  if (loading || scan.isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-sm">{label}</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (!scan.data) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-sm">{label}</CardTitle>
        </CardHeader>
        <CardContent className="p-5 text-center text-sm text-muted-foreground">
          Select a scan to compare
        </CardContent>
      </Card>
    )
  }

  const s = scan.data
  const vulnCount = s.results.filter((r) => r.success).length
  const defendedCount = s.results.length - vulnCount

  return (
    <Card
      className={cn(
        'border-border bg-card',
        label === 'After' && 'border-emerald-500/30',
        label === 'Before' && 'border-red-500/30',
      )}
    >
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{label}</CardTitle>
          <Badge variant="secondary" className="font-mono text-[10px]">
            v{s.target.version}
          </Badge>
        </div>
        <CardDescription className="text-[11px]">
          {s.target.name} · {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Security Score
            </div>
            <div
              className={cn(
                'text-4xl font-bold tabular-nums',
                s.overallScore == null
                  ? 'text-muted-foreground'
                  : s.overallScore >= 80
                    ? 'text-emerald-500'
                    : s.overallScore >= 50
                      ? 'text-amber-500'
                      : 'text-red-500',
              )}
            >
              {s.overallScore == null ? '–' : s.overallScore}
            </div>
          </div>
          <ScoreBadge score={s.overallScore} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {s.results.length} results · {vulnCount} vulnerable · {defendedCount} defended
        </div>
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Categories
          </div>
          <CategoryBars scores={s.categoryScores} compact />
        </div>
      </CardContent>
    </Card>
  )
}

export function CompareView() {
  const { data: scans, isLoading: scansLoading } = useScans()
  const [scanAId, setScanAId] = useState<string | null>(null)
  const [scanBId, setScanBId] = useState<string | null>(null)

  const scanA = useScan(scanAId)
  const scanB = useScan(scanBId)

  const completedScans =
    scans?.filter((s: ScanListItem) => s.status === 'complete') ?? []

  // Compute delta if both scans are loaded
  const scoreA = scanA.data?.overallScore
  const scoreB = scanB.data?.overallScore
  const delta =
    scoreA != null && scoreB != null ? scoreB - scoreA : null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <GitCompare className="h-5 w-5 text-red-600" />
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Compare Scans
        </h2>
      </div>

      {/* Scan pickers */}
      <Card className="mb-6 border-border bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-sm">Pick two scans to compare</CardTitle>
          <CardDescription className="text-xs">
            See how your security score changed between scans — before/after
            hardening, or across different targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          {scansLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : completedScans.length < 2 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              You need at least 2 completed scans to compare. Run more scans
              first.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Scan A (Before)
                </label>
                <Select value={scanAId ?? ''} onValueChange={setScanAId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select first scan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {completedScans.map((s: ScanListItem) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.target.name} ·{' '}
                        {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                        {s.overallScore != null ? ` · score ${s.overallScore}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Scan B (After)
                </label>
                <Select value={scanBId ?? ''} onValueChange={setScanBId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select second scan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {completedScans.map((s: ScanListItem) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.target.name} ·{' '}
                        {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                        {s.overallScore != null ? ` · score ${s.overallScore}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison */}
      {scanAId && scanBId && (
        <>
          {/* Delta indicator */}
          {delta !== null && (
            <div className="mb-4 flex justify-center">
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-semibold',
                  delta > 0
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                    : delta < 0
                      ? 'border-red-500/30 bg-red-500/10 text-red-500'
                      : 'border-border bg-muted text-muted-foreground',
                )}
              >
                {delta > 0 ? `▲ +${delta} points` : delta < 0 ? `▼ ${delta} points` : 'No change'}
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          )}

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ComparisonColumn label="Before" scan={scanA} loading={false} />
            <ComparisonColumn label="After" scan={scanB} loading={false} />
          </div>
        </>
      )}

      {!scanAId && !scanBId && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <GitCompare className="h-8 w-8 text-muted-foreground/50" />
            <div className="text-sm font-medium text-foreground">
              Select two scans to compare
            </div>
            <div className="text-xs text-muted-foreground">
              Pick a &quot;Before&quot; and &quot;After&quot; scan above to see
              how your security score changed.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
