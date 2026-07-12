'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShieldAlert, Trophy, TrendingUp, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BenchmarkModel {
  model: string
  avgScore: number
  minScore: number
  maxScore: number
  scanCount: number
}

interface BenchmarkData {
  models: BenchmarkModel[]
  totalScans: number
  avgScoreAll: number | null
  topCategoryVulnerabilities: Array<{ category: string; avgVulnerableRate: number }>
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

export default function BenchmarkPage() {
  const [data, setData] = useState<BenchmarkData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/benchmark')
      .then((res) => res.json())
      .then((d) => { setData(d); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-neutral-200">
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            <span className="font-serif text-lg tracking-tight text-neutral-200">Redline</span>
          </Link>
          <Link href="/" className="font-mono text-xs text-neutral-500 transition-colors hover:text-neutral-200">
            ← Back
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-32">
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/5 px-3 py-1">
            <Trophy className="h-3 w-3 text-amber-400" />
            <span className="font-mono text-xs text-amber-400">Benchmark</span>
          </div>
          <h1 className="font-serif text-4xl font-light text-neutral-100 sm:text-5xl">
            Which LLM is most secure?
          </h1>
          <p className="mt-3 text-sm text-neutral-600">
            Aggregated scores from all API-connect scans. Updated hourly.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading...
          </div>
        ) : data && data.models.length > 0 ? (
          <>
            {/* Stats */}
            <div className="mb-8 grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-neutral-900 p-4 text-center">
                <div className="font-serif text-2xl text-neutral-100">{data.totalScans}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">Scans</div>
              </div>
              <div className="rounded-lg border border-neutral-900 p-4 text-center">
                <div className={cn('font-serif text-2xl', scoreColor(data.avgScoreAll ?? 0))}>
                  {data.avgScoreAll ?? '—'}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">Avg Score</div>
              </div>
              <div className="rounded-lg border border-neutral-900 p-4 text-center">
                <div className="font-serif text-2xl text-neutral-100">{data.models.length}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">Models</div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="flex flex-col gap-2">
              {data.models.map((model, i) => (
                <div
                  key={model.model}
                  className="flex items-center gap-4 rounded-lg border border-neutral-900 bg-[#0f0f10] p-4 transition-colors hover:border-neutral-700"
                >
                  <div className="w-10 shrink-0 text-center font-mono text-lg font-bold text-neutral-500">
                    {rankIcon(i + 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-neutral-200">{model.model}</div>
                    <div className="font-mono text-[10px] text-neutral-600">
                      {model.scanCount} scans · {model.minScore}–{model.maxScore}
                    </div>
                  </div>
                  <div className="hidden w-32 sm:block">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-900">
                      <div
                        className={cn('h-full rounded-full', scoreBg(model.avgScore))}
                        style={{ width: `${model.avgScore}%` }}
                      />
                    </div>
                  </div>
                  <div className={cn('w-12 shrink-0 text-right font-serif text-2xl font-light', scoreColor(model.avgScore))}>
                    {model.avgScore}
                  </div>
                </div>
              ))}
            </div>

            {/* Top vulnerabilities */}
            {data.topCategoryVulnerabilities.length > 0 && (
              <div className="mt-10">
                <div className="mb-3 flex items-center gap-2 font-mono text-xs text-neutral-500">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  Most common vulnerabilities
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.topCategoryVulnerabilities.map((vuln) => (
                    <div key={vuln.category} className="flex items-center justify-between rounded-lg border border-neutral-900 px-4 py-2">
                      <span className="font-mono text-xs capitalize text-neutral-500">{vuln.category}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-neutral-900">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${vuln.avgVulnerableRate}%` }} />
                        </div>
                        <span className="font-mono text-xs text-red-400">{vuln.avgVulnerableRate}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-900 p-12 text-center">
            <Trophy className="mx-auto mb-4 h-10 w-10 text-neutral-800" />
            <div className="font-serif text-lg text-neutral-400">No data yet</div>
            <div className="mt-1 text-sm text-neutral-600">
              {data?.message || 'Run an API-connect scan to contribute.'}
            </div>
            <Link
              href="/app"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-red-600/30 px-6 py-2 font-mono text-xs text-neutral-300 transition-all hover:border-red-600/60"
            >
              Launch app →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
