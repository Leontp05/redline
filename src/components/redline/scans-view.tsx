'use client'

import { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { toast } from 'sonner'
import {
  FlaskConical,
  Crosshair,
  Shield,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronRight,
  Lock,
  ArrowRight,
  GitCompare,
} from 'lucide-react'
import {
  useScans,
  useScan,
  useCreateScan,
  useTargets,
  JfetchError,
  type ScanListItem,
} from '@/lib/redline-api'
import { useRedlineStore } from './use-redline-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScoreBadge } from './score-badge'
import { StatusBadge } from './status-badge'
import { CategoryBars } from './category-bars'
import { CircularGauge, TiltCard } from './visual-effects'
import { cn } from '@/lib/utils'

const ease = [0.16, 1, 0.3, 1] as const

// ─── Scan list ───

function ScanList({ scans, onSelect }: { scans: ScanListItem[]; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {scans.map((scan, i) => (
        <motion.button
          key={scan.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.04, ease }}
          onClick={() => onSelect(scan.id)}
          className="group flex items-center justify-between rounded-lg border border-neutral-900 bg-[#0f0f10] px-4 py-3 text-left transition-colors hover:border-neutral-800"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-xs text-neutral-300">{scan.target.name}</div>
            <div className="font-mono text-[10px] text-neutral-700">
              {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })} · {scan.resultCount} results
              {scan.note?.startsWith('Hardened') && <span className="ml-2 text-amber-600">· hardened</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge status={scan.status} />
            <ScoreBadge score={scan.overallScore} />
            <ChevronRight className="h-3.5 w-3.5 text-neutral-800 transition-colors group-hover:text-neutral-600" />
          </div>
        </motion.button>
      ))}
    </div>
  )
}

// ─── Scan report ───

function ScanReport({ scanId }: { scanId: string }) {
  const { data: scan, isLoading } = useScan(scanId)
  const [filter, setFilter] = useState<'all' | 'vulnerable' | 'defended'>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  if (isLoading || !scan) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const isRunning = scan.status === 'running'
  const isFailed = scan.status === 'failed'
  const results = scan.results || []
  const filtered = results.filter((r) => {
    if (filter === 'vulnerable') return r.success
    if (filter === 'defended') return !r.success
    return true
  })
  const vulnerableCount = results.filter((r) => r.success).length

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => useRedlineStore.getState().setSelectedScanId(null)}
        className="mb-4 font-mono text-xs text-neutral-600 hover:text-neutral-400"
      >
        ← All scans
      </button>

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-700">
            {scan.target.name} · v{scan.target.version}
          </div>
          <h2 className="mt-1 font-serif text-2xl font-light text-neutral-100">
            {isRunning ? 'Scan in progress' : isFailed ? 'Scan failed' : 'Scan report'}
          </h2>
        </div>
        {!isRunning && !isFailed && (
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700"
            onClick={() => useRedlineStore.getState().goToHarden(scanId)}
            disabled={vulnerableCount === 0}
          >
            <Shield className="h-3.5 w-3.5" />
            Harden
          </Button>
        )}
      </div>

      {/* Running state */}
      {isRunning && (
        <div className="mb-6 rounded-lg border border-amber-900/40 bg-amber-950/10 p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            <div>
              <div className="font-mono text-sm text-amber-400">Scanning...</div>
              <div className="font-mono text-[10px] text-amber-700">
                {results.length} of 40 payloads completed · auto-refreshing
              </div>
            </div>
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-neutral-900">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${(results.length / 40) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="mb-6 rounded-lg border border-red-900/40 bg-red-950/10 p-5">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <div>
              <div className="font-mono text-sm text-red-400">Scan failed</div>
              <div className="font-mono text-[10px] text-red-700">
                The LLM provider may be rate-limited. Try again.
              </div>
            </div>
          </div>
          <Button
            size="sm"
            className="mt-3 bg-red-600 hover:bg-red-700"
            onClick={() => useRedlineStore.getState().goToNewScan()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run new scan
          </Button>
        </div>
      )}

      {/* Score + categories (complete only) */}
      {!isRunning && !isFailed && scan.overallScore != null && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {/* Score gauge */}
          <TiltCard className="p-6" glowColor="rgba(220, 38, 38, 0.12)">
            <div className="flex flex-col items-center justify-center">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-700">Security Score</div>
              <CircularGauge score={scan.overallScore} size={140} />
              <div className="mt-3 font-mono text-xs text-neutral-600">
                {results.length} results · {vulnerableCount} vulnerable · {results.length - vulnerableCount} defended
              </div>
            </div>
          </TiltCard>

          {/* Categories */}
          <TiltCard className="p-6" glowColor="rgba(220, 38, 38, 0.08)">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-700">Categories</div>
            <CategoryBars scores={scan.categoryScores} compact />
          </TiltCard>
        </motion.div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div>
          {/* Filter tabs */}
          <div className="mb-3 flex items-center gap-1">
            {(['all', 'vulnerable', 'defended'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors',
                  filter === f ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-700 hover:text-neutral-500',
                )}
              >
                {f === 'all' ? `All (${results.length})` : f === 'vulnerable' ? `Vulnerable (${vulnerableCount})` : `Defended (${results.length - vulnerableCount})`}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="overflow-hidden rounded-lg border border-neutral-900">
            {filtered.map((r) => {
              const isExpanded = expandedRow === r.id
              return (
                <div key={r.id} className="border-b border-neutral-900 last:border-0">
                  <button
                    onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#0f0f10]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-xs text-neutral-300">{r.attackType.name}</div>
                      <div className="font-mono text-[10px] text-neutral-700">{r.technique}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {r.success ? (
                        <Badge variant="outline" className="border-red-900/50 bg-red-950/20 text-[9px] text-red-400">Vulnerable</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-900/50 bg-emerald-950/20 text-[9px] text-emerald-400">Defended</Badge>
                      )}
                      <ChevronRight className={cn('h-3.5 w-3.5 text-neutral-800 transition-transform', isExpanded && 'rotate-90')} />
                    </div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 px-4 py-3">
                          <div>
                            <div className="font-mono text-[9px] uppercase tracking-wider text-neutral-700">Payload</div>
                            <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 font-mono text-[10px] text-neutral-500">{r.payload}</pre>
                          </div>
                          <div>
                            <div className="font-mono text-[9px] uppercase tracking-wider text-neutral-700">Response</div>
                            <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 font-mono text-[10px] text-neutral-500">{r.response}</pre>
                          </div>
                          {r.evidence && (
                            <div>
                              <div className="font-mono text-[9px] uppercase tracking-wider text-neutral-700">Evidence</div>
                              <p className="mt-1 font-mono text-[10px] text-neutral-600">{r.evidence}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main scans view ───

export function ScansView() {
  const { data: scans, isLoading } = useScans()
  const selectedScanId = useRedlineStore((s) => s.selectedScanId)

  if (selectedScanId) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <ScanReport scanId={selectedScanId} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-8"
      >
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-700">Scans</div>
        <h1 className="font-serif text-3xl font-light text-neutral-100">Scan history</h1>
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : scans && scans.length > 0 ? (
        <ScanList scans={scans} onSelect={(id) => useRedlineStore.getState().setSelectedScanId(id)} />
      ) : (
        <div className="rounded-lg border border-dashed border-neutral-900 p-12 text-center">
          <FlaskConical className="mx-auto mb-3 h-8 w-8 text-neutral-800" />
          <div className="font-mono text-xs text-neutral-600">No scans yet</div>
          <button
            onClick={() => useRedlineStore.getState().setView('targets')}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-600/30 px-4 py-1.5 font-mono text-xs text-neutral-300 hover:border-red-600/60"
          >
            <Crosshair className="h-3 w-3 text-red-500" />
            Run your first scan
          </button>
        </div>
      )}
    </div>
  )
}
