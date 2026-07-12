'use client'

import { cn } from '@/lib/utils'
import { scoreTier } from '@/lib/redline-api'

interface CategoryBarsProps {
  scores: Record<string, number> | null | undefined
  className?: string
  compact?: boolean
}

/**
 * Horizontal color-coded bars for per-category scores.
 * Categories: jailbreak, injection, encoding, multi-turn, extraction
 */
export function CategoryBars({ scores, className, compact }: CategoryBarsProps) {
  const entries = Object.entries(scores || {}).filter(
    ([, v]) => typeof v === 'number',
  )

  if (entries.length === 0) {
    return (
      <div className={cn('text-sm text-neutral-500', className)}>
        No category scores available.
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {entries.map(([cat, score]) => {
        const tier = scoreTier(score as number)
        const barColor =
          tier === 'strong'
            ? 'bg-emerald-500'
            : tier === 'medium'
              ? 'bg-amber-500'
              : 'bg-red-500'
        return (
          <div key={cat} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium capitalize text-neutral-200">
                {cat}
              </span>
              <span className="tabular-nums text-neutral-500">
                {score as number}
              </span>
            </div>
            <div
              className={cn(
                'w-full overflow-hidden rounded-full bg-muted',
                compact ? 'h-1.5' : 'h-2.5',
              )}
            >
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${Math.max(0, Math.min(100, score as number))}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
