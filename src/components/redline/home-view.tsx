'use client'

import { formatDistanceToNow } from 'date-fns'
import { motion } from 'framer-motion'
import { Crosshair, ListChecks, ShieldCheck, TrendingUp, ArrowRight } from 'lucide-react'
import { useStats, useUsage, scoreTier, planDisplayName } from '@/lib/redline-api'
import { useRedlineStore } from './use-redline-store'
import { StatusBadge } from './status-badge'
import { ScoreBadge } from './score-badge'
import { TiltCard, CountUp } from './visual-effects'
import { cn } from '@/lib/utils'

const ease = [0.16, 1, 0.3, 1] as const

function StatCard({ icon: Icon, label, value, hint, delay }: {
  icon: typeof Crosshair
  label: string
  value: string | number
  hint?: string
  delay?: number
}) {
  return (
    <TiltCard delay={delay} className="p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-600">{label}</span>
        <Icon className="h-4 w-4 text-neutral-700 transition-colors group-hover:text-red-600" />
      </div>
      <div className="mt-3 font-serif text-3xl font-light text-neutral-100">
        {typeof value === 'number' ? <CountUp to={value} delay={delay} /> : value}
      </div>
      {hint && <div className="mt-1 font-mono text-[10px] text-neutral-700">{hint}</div>}
    </TiltCard>
  )
}

function UsageIndicator() {
  const { data: usage, isLoading, isError } = useUsage()
  const goToBilling = useRedlineStore((s) => s.goToBilling)
  const setView = useRedlineStore((s) => s.setView)

  if (isLoading || isError || !usage) return null
  if (usage.isAdmin) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-900/40 bg-amber-950/10 px-4 py-2.5">
        <span className="font-mono text-xs text-amber-500">★ Admin — unlimited access</span>
        <span className="font-mono text-[10px] text-amber-700">no limits</span>
      </div>
    )
  }

  const planName = planDisplayName(usage.plan)
  const unlimited = usage.scansLimit < 0
  const pct = unlimited ? 0 : Math.min(100, Math.round((usage.scansUsed / usage.scansLimit) * 100))
  const atLimit = !unlimited && usage.scansUsed >= usage.scansLimit && usage.scansLimit > 0

  return (
    <div className={cn(
      'mb-6 flex items-center justify-between rounded-lg border px-4 py-2.5',
      atLimit ? 'border-red-900/40 bg-red-950/10' : 'border-neutral-900 bg-[#0f0f10]',
    )}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-neutral-500">Plan: <span className="text-neutral-300">{planName}</span></span>
        <span className="text-neutral-800">·</span>
        <span className="font-mono text-xs text-neutral-500">
          {usage.scansUsed}{unlimited ? '' : `/${usage.scansLimit}`} scans
        </span>
      </div>
      {atLimit ? (
        <button onClick={() => setView('settings')} className="font-mono text-xs text-red-500 hover:text-red-400">
          Upgrade →
        </button>
      ) : (
        <button onClick={() => setView('settings')} className="font-mono text-[10px] text-neutral-700 hover:text-neutral-500">
          Manage
        </button>
      )}
    </div>
  )
}

export function HomeView() {
  const { data, isLoading, isError } = useStats()
  const setView = useRedlineStore((s) => s.setView)
  const goToNewScan = useRedlineStore((s) => s.goToNewScan)

  const isNewUser = !isLoading && !isError && data && data.targetsCount === 0

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-8"
      >
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-700">
          Dashboard
        </div>
        <h1 className="font-serif text-3xl font-light tracking-tight text-neutral-100 sm:text-4xl">
          Red-team your LLM apps
        </h1>
      </motion.div>

      {/* Onboarding banner */}
      {isNewUser && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease }}
          className="mb-8 rounded-lg border border-amber-900/30 bg-amber-950/10 p-5"
        >
          <div className="font-mono text-xs font-semibold text-amber-500">Welcome to Redline</div>
          <div className="mt-1 text-sm text-neutral-400">Get started in 2 minutes — create a target, run a scan, see your score.</div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setView('targets')}
              className="rounded-md bg-amber-600 px-4 py-1.5 font-mono text-xs text-white transition-colors hover:bg-amber-700"
            >
              Create your first target →
            </button>
          </div>
        </motion.div>
      )}

      <UsageIndicator />

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ListChecks} label="Targets" value={data?.targetsCount ?? '—'} delay={0.1} />
        <StatCard icon={Crosshair} label="Scans" value={data?.scansCount ?? '—'} delay={0.15} />
        <StatCard icon={ShieldCheck} label="Avg Score" value={data?.avgScore ?? '—'} delay={0.2} />
        <StatCard icon={TrendingUp} label="Improved" value={data?.hardeningImprovements ?? '—'} delay={0.25} />
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          onClick={() => setView('targets')}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-800 px-5 py-2 font-mono text-xs text-neutral-300 transition-all hover:border-red-600/40 hover:text-white"
        >
          <ListChecks className="h-3.5 w-3.5" />
          New Target
        </button>
        <button
          onClick={() => goToNewScan()}
          className="inline-flex items-center gap-2 rounded-full border border-red-600/30 bg-red-600/5 px-5 py-2 font-mono text-xs text-neutral-200 transition-all hover:border-red-600/60 hover:bg-red-600/10"
        >
          <Crosshair className="h-3.5 w-3.5 text-red-500" />
          Run Scan
        </button>
      </div>

      {/* Recent scans */}
      <div>
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-700">Recent Scans</div>
        {isLoading ? (
          <div className="rounded-lg border border-neutral-900 p-6 text-center font-mono text-xs text-neutral-700">Loading...</div>
        ) : isError ? (
          <div className="rounded-lg border border-red-900/40 p-6 text-center font-mono text-xs text-red-500">Failed to load</div>
        ) : data?.recentScans?.length > 0 ? (
          <div className="flex flex-col gap-2">
            {data.recentScans.map((scan, i) => (
              <motion.button
                key={scan.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.05, ease }}
                onClick={() => useRedlineStore.getState().goToScanReport(scan.id)}
                className="group flex items-center justify-between rounded-lg border border-neutral-900 bg-[#0f0f10] px-4 py-3 text-left transition-colors hover:border-neutral-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs text-neutral-300">{scan.target.name}</div>
                  <div className="font-mono text-[10px] text-neutral-700">
                    {formatDistanceToNow(new Date(scan.createdAt), { addSuffix: true })} · {scan.resultCount} results
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={scan.status} />
                  <ScoreBadge score={scan.overallScore} />
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-800 transition-colors group-hover:text-neutral-600" />
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-neutral-900 p-8 text-center">
            <div className="font-mono text-xs text-neutral-600">No scans yet</div>
            <button
              onClick={() => goToNewScan()}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-600/30 px-4 py-1.5 font-mono text-xs text-neutral-300 hover:border-red-600/60"
            >
              <Crosshair className="h-3 w-3 text-red-500" />
              Run your first scan
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
