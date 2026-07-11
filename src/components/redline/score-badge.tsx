'use client'

import { cn } from '@/lib/utils'
import { scoreTier } from '@/lib/redline-api'

interface ScoreBadgeProps {
  score: number | null | undefined
  className?: string
  label?: string
}

/**
 * Color-coded score badge.
 *  >=80 emerald, 50-79 amber, <50 red, null gray.
 */
export function ScoreBadge({ score, className, label }: ScoreBadgeProps) {
  const tier = scoreTier(score)
  const styles =
    tier === 'strong'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tier === 'medium'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-red-50 text-red-700 border-red-200'
  const text =
    score == null ? 'N/A' : label ? `${score} ${label}` : `${score}`
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums',
        styles,
        className,
      )}
    >
      {text}
    </span>
  )
}
