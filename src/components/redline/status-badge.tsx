'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface StatusBadgeProps {
  status: string
  className?: string
}

/**
 * Scan status badge.
 *  running=amber, complete=emerald, failed=red, unknown=gray
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = (status || '').toLowerCase()
  const styles =
    s === 'running'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : s === 'complete'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : s === 'failed'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-muted text-neutral-500 border-neutral-800'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium capitalize',
        styles,
        className,
      )}
    >
      {s === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
      {s || 'unknown'}
    </span>
  )
}
