'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Crosshair, X, Loader2, Lock } from 'lucide-react'
import {
  useAttacks,
  useCreateScan,
  useUsage,
  JfetchError,
  type AttackType,
} from '@/lib/redline-api'
import { useRedlineStore } from './use-redline-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ScanModal() {
  const showScanModal = useRedlineStore((s) => s.showScanModal)
  const setShowScanModal = useRedlineStore((s) => s.setShowScanModal)
  const newScanTargetId = useRedlineStore((s) => s.newScanTargetId)
  const goToScanReport = useRedlineStore((s) => s.goToScanReport)

  const { data: attacks } = useAttacks()
  const { data: usage } = useUsage()
  const createScan = useCreateScan()
  const [selectedAttacks, setSelectedAttacks] = useState<Set<string>>(new Set())
  const [cooldown, setCooldown] = useState(0)

  // Select all attacks by default
  const initialized = useRef(false)
  useEffect(() => {
    if (attacks && !initialized.current) {
      initialized.current = true
      // Defer to avoid cascading render lint error
      const timer = setTimeout(() => {
        setSelectedAttacks(new Set(attacks.map((a: AttackType) => a.id)))
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [attacks])

  // Cooldown timer for rate limiting
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (!showScanModal || !newScanTargetId) return null

  const isAdmin = (usage as { isAdmin?: boolean })?.isAdmin
  const attackList = attacks || []
  const selectedCount = selectedAttacks.size
  const totalPayloads = attackList
    .filter((a: AttackType) => selectedAttacks.has(a.id))
    .reduce((sum: number, a: AttackType) => {
      // Each attack type has roughly 6-8 payloads
      const counts: Record<string, number> = {
        roleplay: 8, override: 8, injection: 6, encoding: 7, 'multi-turn': 3, extraction: 8,
      }
      return sum + (counts[a.key] || 6)
    }, 0)

  const handleStartScan = () => {
    if (!newScanTargetId) return
    const attackIds = Array.from(selectedAttacks)
    if (attackIds.length === 0) {
      toast.error('Select at least one attack type.')
      return
    }

    createScan.mutate(
      { targetId: newScanTargetId, attackTypeIds: attackIds },
      {
        onSuccess: (scan) => {
          toast.success('Scan started. Results will stream in live.')
          setShowScanModal(false)
          setSelectedAttacks(new Set())
          goToScanReport(scan.id)
        },
        onError: (err: Error) => {
          if (err instanceof JfetchError && err.code === 'QUOTA_EXCEEDED') {
            toast.error(err.message)
          } else if (err instanceof JfetchError && err.code === 'RATE_LIMITED') {
            const retryAfter = (err as JfetchError & { retryAfter?: number }).retryAfter || 60
            setCooldown(retryAfter)
            toast.error(`Rate limit: try again in ${retryAfter}s`)
          } else {
            toast.error(err.message || 'Scan failed to start.')
          }
        },
      },
    )
  }

  return (
    <AnimatePresence>
      {showScanModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowScanModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg rounded-xl border border-neutral-800 bg-[#0f0f10] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="h-5 w-5 text-red-600" />
                <h2 className="font-serif text-xl text-neutral-100">Run Scan</h2>
              </div>
              <button onClick={() => setShowScanModal(false)} className="text-neutral-600 hover:text-neutral-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Attack selection */}
            <div className="mb-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-600">
                Attack Types — {selectedCount} selected
              </div>
              <div className="grid grid-cols-2 gap-2">
                {attackList.map((attack: AttackType) => {
                  const isSelected = selectedAttacks.has(attack.id)
                  return (
                    <button
                      key={attack.id}
                      onClick={() => {
                        const next = new Set(selectedAttacks)
                        if (isSelected) next.delete(attack.id)
                        else next.add(attack.id)
                        setSelectedAttacks(next)
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-3 text-left transition-colors',
                        isSelected
                          ? 'border-red-600/40 bg-red-600/5'
                          : 'border-neutral-900 bg-[#0a0a0b] hover:border-neutral-800',
                      )}
                    >
                      <div className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        isSelected ? 'border-red-600 bg-red-600' : 'border-neutral-700',
                      )}>
                        {isSelected && <span className="text-[10px] text-white">✓</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[10px] text-neutral-300">{attack.name}</div>
                        <div className="font-mono text-[8px] text-neutral-600">sev {attack.severityWeight}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="mb-4 rounded-lg border border-neutral-900 bg-[#0a0a0b] p-3">
              <div className="font-mono text-xs text-neutral-500">
                {totalPayloads} payloads will be sent across {selectedCount} attack types.
              </div>
              <div className="mt-1 font-mono text-[10px] text-neutral-700">
                Estimated runtime: ~1-2 minutes. Results stream in live.
              </div>
            </div>

            {/* API-connect lock for free users */}
            {!isAdmin && usage && !usage.isAdmin && usage.plan === 'free' && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-900/30 bg-amber-950/10 p-3">
                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <div className="font-mono text-[10px] text-amber-600">
                  Free plan: Simulate mode only. Upgrade to Pro for API-connect mode.
                </div>
              </div>
            )}

            {/* Start button */}
            <Button
              onClick={handleStartScan}
              disabled={createScan.isPending || cooldown > 0 || selectedCount === 0}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {createScan.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting scan...
                </>
              ) : cooldown > 0 ? (
                `Rate limited — wait ${cooldown}s`
              ) : (
                <>
                  <Crosshair className="h-4 w-4" />
                  Start Scan
                </>
              )}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
