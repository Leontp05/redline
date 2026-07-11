'use client'

import { cn } from '@/lib/utils'
import { scoreRingStroke, scoreLabel, scoreTier } from '@/lib/redline-api'

interface ScoreGaugeProps {
  score: number | null | undefined
  size?: number
  className?: string
  showLabel?: boolean
}

/**
 * Circular score gauge drawn with SVG. Big number in the center.
 */
export function ScoreGauge({
  score,
  size = 220,
  className,
  showLabel = true,
}: ScoreGaugeProps) {
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const value = score ?? 0
  const pct = Math.max(0, Math.min(100, value))
  const offset = circumference - (pct / 100) * circumference
  const color = scoreRingStroke(score)
  const tier = scoreTier(score)

  return (
    <div
      className={cn('flex flex-col items-center justify-center', className)}
      style={{ width: size }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/60"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-bold tabular-nums leading-none',
              tier === 'strong'
                ? 'text-emerald-600'
                : tier === 'medium'
                  ? 'text-amber-600'
                  : 'text-red-600',
            )}
            style={{ fontSize: size * 0.28 }}
          >
            {score == null ? '–' : value}
          </span>
          <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            / 100
          </span>
        </div>
      </div>
      {showLabel && (
        <div className="mt-3 text-center">
          <div className="text-sm font-semibold text-foreground">
            Security Score
          </div>
          <div
            className={cn(
              'text-xs font-medium',
              tier === 'strong'
                ? 'text-emerald-600'
                : tier === 'medium'
                  ? 'text-amber-600'
                  : 'text-red-600',
            )}
          >
            {scoreLabel(score)}
          </div>
        </div>
      )}
    </div>
  )
}
