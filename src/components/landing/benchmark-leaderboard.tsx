'use client'

import { useQuery } from '@tanstack/react-query'
import { Trophy, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BenchmarkModel {
  model: string
  avgScore: number
  minScore: number
  maxScore: number
  scanCount: number
  categories: Record<string, number>
}

interface BenchmarkData {
  models: BenchmarkModel[]
  totalScans: number
  avgScoreAll: number | null
  topCategoryVulnerabilities: Array<{
    category: string
    avgVulnerableRate: number
  }>
  message?: string
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

function rankIcon(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

function ModelRow({ model, rank }: { model: BenchmarkModel; rank: number }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-red-500/30">
      {/* Rank */}
      <div className="w-10 shrink-0 text-center text-lg font-bold">
        {rankIcon(rank)}
      </div>

      {/* Model name */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-white">{model.model}</div>
        <div className="text-[10px] text-neutral-500">
          {model.scanCount} scan{model.scanCount === 1 ? '' : 's'} · range {model.minScore}–{model.maxScore}
        </div>
      </div>

      {/* Score bar */}
      <div className="hidden w-32 sm:block">
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className={cn('h-full rounded-full transition-all', scoreBg(model.avgScore))}
            style={{ width: `${model.avgScore}%` }}
          />
        </div>
      </div>

      {/* Score */}
      <div className={cn('w-16 shrink-0 text-right text-xl font-bold tabular-nums', scoreColor(model.avgScore))}>
        {model.avgScore}
      </div>
    </div>
  )
}

export function BenchmarkLeaderboard() {
  const { data, isLoading, isError } = useQuery<BenchmarkData>({
    queryKey: ['benchmark'],
    queryFn: async () => {
      const res = await fetch('/api/benchmark')
      return res.json()
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  return (
    <section id="benchmark" className="bg-black py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <Badge className="mb-4 border-amber-500/30 bg-amber-950/50 text-amber-400">
            <Trophy className="mr-1 h-3 w-3" />
            Benchmark Leaderboard
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Which LLM is most secure?
          </h2>
          <p className="mt-3 text-neutral-400">
            Aggregated security scores from all Redline API-connect scans.
            Updated hourly. Contribute by scanning your own LLM.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading benchmark data...
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-6 text-center text-sm text-red-400">
            Failed to load benchmark data. Try refreshing.
          </div>
        ) : data && data.models.length > 0 ? (
          <>
            {/* Overall stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-center">
                <div className="text-2xl font-bold text-white">{data.totalScans}</div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Total Scans</div>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-center">
                <div className={cn('text-2xl font-bold', scoreColor(data.avgScoreAll ?? 0))}>
                  {data.avgScoreAll ?? '—'}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Avg Score</div>
              </div>
              <div className="col-span-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-center sm:col-span-1">
                <div className="text-2xl font-bold text-white">{data.models.length}</div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Models Tested</div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="flex flex-col gap-2">
              {data.models.map((model, i) => (
                <ModelRow key={model.model} model={model} rank={i + 1} />
              ))}
            </div>

            {/* Top vulnerabilities */}
            {data.topCategoryVulnerabilities.length > 0 && (
              <div className="mt-8">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Most Common Vulnerabilities
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.topCategoryVulnerabilities.map((vuln) => (
                    <div
                      key={vuln.category}
                      className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/30 px-4 py-2"
                    >
                      <span className="text-xs capitalize text-neutral-400">{vuln.category}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-800">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${vuln.avgVulnerableRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-red-400">
                          {vuln.avgVulnerableRate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-600">
              <TrendingUp className="h-3 w-3" />
              Data is anonymous and aggregated. Run an API-connect scan to contribute.
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="rounded-lg border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center">
            <Trophy className="mx-auto mb-4 h-10 w-10 text-neutral-700" />
            <div className="text-sm font-semibold text-white">No benchmark data yet</div>
            <div className="mt-1 text-xs text-neutral-500">
              {data?.message ||
                'Be the first to contribute. Connect your LLM endpoint in API-connect mode and run a scan.'}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
