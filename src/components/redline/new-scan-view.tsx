'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Crosshair,
  Loader2,
  ShieldAlert,
  Play,
  AlertCircle,
  Lock,
  Crown,
  ArrowRight,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  useAttacks,
  useTargets,
  useCreateScan,
  useUsage,
  planHasApiConnect,
  JfetchError,
  type AttackType,
} from '@/lib/redline-api'
import { cn } from '@/lib/utils'
import { useRedlineStore } from './use-redline-store'

// Approximate payload count per attack type, from the backend spec.
const PAYLOAD_COUNTS: Record<string, number> = {
  roleplay: 8,
  override: 8,
  injection: 6,
  encoding: 7,
  'multi-turn': 3,
  extraction: 8,
}

function totalPayloadCount(keys: string[]): number {
  return keys.reduce((sum, k) => sum + (PAYLOAD_COUNTS[k] ?? 0), 0)
}

function ScanStartingCard({ payloadCount }: { payloadCount: number }) {
  return (
    <Card className="border-red-200 bg-red-50/40">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-red-600" />
        <div>
          <div className="text-base font-semibold text-neutral-900">
            Starting scan...
          </div>
          <div className="mt-1 max-w-md text-sm text-muted-foreground">
            Queuing {payloadCount} attack payloads against the target model.
            You&apos;ll be taken to the live report in a moment.
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-700">
          <ShieldAlert className="h-3.5 w-3.5" />
          Red-teaming in progress
        </div>
      </CardContent>
    </Card>
  )
}

function QuotaExceededCard({ message }: { message: string }) {
  const goToBilling = useRedlineStore((s) => s.goToBilling)
  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardContent className="flex items-start gap-3 p-5 text-sm">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="flex-1">
          <div className="font-semibold text-red-700">
            You&apos;ve reached your monthly scan limit
          </div>
          <div className="mt-1 text-xs text-red-700/90">
            {message}{' '}
            <span className="text-red-700/70">
              Upgrade to Pro for 50 scans/mo or Team for 250 scans/mo to
              continue running scans this period.
            </span>
          </div>
          <Button
            size="sm"
            onClick={goToBilling}
            className="mt-3 bg-red-600 hover:bg-red-700"
          >
            <Crown className="h-3.5 w-3.5" />
            Upgrade to Pro
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ApiModeLockedCard() {
  const goToBilling = useRedlineStore((s) => s.goToBilling)
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="flex-1">
          <div className="font-semibold">
            Upgrade to Pro to use API-connect mode
          </div>
          <div className="mt-0.5 text-xs text-amber-800">
            The selected target is in API-connect mode, which is available on
            Pro and Team plans. Switch to Simulate mode for this scan, or
            upgrade your plan to attack your live endpoint.
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={goToBilling}
            className="mt-3 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
          >
            <Crown className="h-3.5 w-3.5" />
            View plans
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AttackCard({
  attack,
  checked,
  onToggle,
}: {
  attack: AttackType
  checked: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <label
      htmlFor={`attack-${attack.id}`}
      className={cn(
        'flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors',
        checked
          ? 'border-red-300 bg-red-50/50'
          : 'border-neutral-200 bg-white hover:bg-neutral-50',
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={`attack-${attack.id}`}
          checked={checked}
          onCheckedChange={(v) => onToggle(v === true)}
          className="mt-0.5 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-900">
              {attack.name}
            </span>
            <Badge variant="outline" className="text-[10px] capitalize">
              {attack.category}
            </Badge>
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-[10px] text-red-700"
            >
              severity {attack.severityWeight}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {PAYLOAD_COUNTS[attack.key] ?? 0} payloads
            </Badge>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {attack.description}
          </p>
        </div>
      </div>
    </label>
  )
}

export function NewScanView() {
  const { data: attacks, isLoading: attacksLoading } = useAttacks()
  const { data: targets, isLoading: targetsLoading } = useTargets()
  const { data: usage } = useUsage()
  const createScan = useCreateScan()

  const newScanTargetId = useRedlineStore((s) => s.newScanTargetId)
  const setNewScanTargetId = useRedlineStore((s) => s.setNewScanTargetId)
  const goToScanReport = useRedlineStore((s) => s.goToScanReport)

  // Use the store value directly as the controlled target id. Fall back to
  // the first available target so the user always has a valid selection
  // without needing a `setState` inside an effect.
  const targetId = newScanTargetId || (targets && targets.length > 0 ? targets[0].id : '')

  // Attack selection: track only the user's manual override. Until the user
  // toggles anything, derive the default from the loaded attacks (all on).
  const [userAttackOverride, setUserAttackOverride] = useState<Set<string> | null>(
    null,
  )
  const selectedAttackIds = useMemo(() => {
    if (userAttackOverride) return userAttackOverride
    if (attacks && attacks.length > 0) return new Set(attacks.map((a) => a.id))
    return new Set<string>()
  }, [userAttackOverride, attacks])

  const selectedTarget = useMemo(
    () => targets?.find((t) => t.id === targetId),
    [targets, targetId],
  )

  const selectedAttacks = useMemo(
    () => attacks?.filter((a) => selectedAttackIds.has(a.id)) ?? [],
    [attacks, selectedAttackIds],
  )

  const payloadCount = useMemo(
    () => totalPayloadCount(selectedAttacks.map((a) => a.key)),
    [selectedAttacks],
  )

  // ---- Quota / rate-limit / feature-gate state ----
  // quotaError is paired with the targetId it occurred on so it auto-clears
  // when the user picks a different target (derived, no useEffect needed).
  const [quotaError, setQuotaError] = useState<{
    targetId: string
    message: string
  } | null>(null)
  const [cooldown, setCooldown] = useState(0) // seconds remaining before next scan
  // True when the selected target is API-connect mode and the user's plan
  // doesn't include API-connect. Gates the Run Scan button + shows the lock card.
  const apiModeLocked = useMemo(() => {
    if (!selectedTarget || selectedTarget.mode !== 'api') return false
    return !planHasApiConnect(usage?.plan)
  }, [selectedTarget, usage?.plan])

  // Countdown timer for rate-limit cooldown. Decrements `cooldown` every 1s
  // until it hits 0.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const toggleAttack = (id: string) => {
    setUserAttackOverride((prev) => {
      const base = prev ?? (attacks ? new Set(attacks.map((a) => a.id)) : new Set<string>())
      const next = new Set(base)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (attacks) setUserAttackOverride(new Set(attacks.map((a) => a.id)))
  }
  const clearAll = () => setUserAttackOverride(new Set<string>())

  // Only show the quota error for the target it occurred on — switching to
  // a different target naturally hides the stale banner.
  const visibleQuotaError =
    quotaError && quotaError.targetId === targetId ? quotaError.message : null

  const handleRun = () => {
    if (!targetId) {
      toast.error('Pick a target first.')
      return
    }
    if (selectedAttackIds.size === 0) {
      toast.error('Select at least one attack type.')
      return
    }
    if (apiModeLocked) return // gated — button is also disabled
    if (cooldown > 0) {
      toast.error(`Rate limit: try again in ${cooldown}s`)
      return
    }
    setQuotaError(null)
    createScan.mutate(
      {
        targetId,
        attackTypeIds: Array.from(selectedAttackIds),
      },
      {
        onSuccess: (scan) => {
          // Async scans: POST returns immediately with status='running'.
          // Switch to the Scan Report view right away — it will poll the scan
          // every 3s and show live progress + partial results as they land.
          toast.success('Scan started. Results will stream in live.')
          setNewScanTargetId(null)
          goToScanReport(scan.id)
        },
        onError: (err: Error) => {
          // Quota exceeded (402) — show a persistent upgrade card keyed to
          // the current target so it auto-clears if the user picks another.
          if (err instanceof JfetchError && err.code === 'QUOTA_EXCEEDED') {
            setQuotaError({
              targetId,
              message: err.message || 'You have reached your monthly scan limit.',
            })
            return
          }
          // Rate limited (429) — toast + cooldown on the Run button.
          if (
            err instanceof JfetchError &&
            err.code === 'RATE_LIMITED' &&
            typeof err.retryAfter === 'number' &&
            err.retryAfter > 0
          ) {
            setCooldown(err.retryAfter)
            toast.error(`Rate limit: try again in ${err.retryAfter}s`)
            return
          }
          // 401 — jfetch already shaped the message ("Session expired...").
          // Other errors: toast the message.
          toast.error(err.message || 'Scan failed to start.')
        },
      },
    )
  }

  const runButtonDisabled =
    createScan.isPending ||
    !targetId ||
    selectedAttackIds.size === 0 ||
    apiModeLocked ||
    cooldown > 0

  // Tooltip text for the disabled Run button when API-mode locked or rate-limited.
  const runTooltip = apiModeLocked
    ? 'Upgrade to Pro to use API-connect mode'
    : cooldown > 0
      ? `Rate limited — try again in ${cooldown}s`
      : ''

  const runButtonInner = createScan.isPending ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Starting...
    </>
  ) : cooldown > 0 ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      Cooldown {cooldown}s
    </>
  ) : (
    <>
      <Play className="h-4 w-4" />
      Run Scan
    </>
  )

  const runButton = (
    <Button
      onClick={handleRun}
      disabled={runButtonDisabled}
      className="w-full bg-red-600 hover:bg-red-700 sm:w-auto"
    >
      {runButtonInner}
    </Button>
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <Crosshair className="h-5 w-5 text-red-600" />
        <h2 className="text-xl font-bold tracking-tight text-neutral-900">
          New Scan
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: target selector */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>1. Choose a Target</CardTitle>
              <CardDescription>
                Pick the LLM target whose system prompt you want to attack.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {targetsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : targets && targets.length > 0 ? (
                <Select
                  value={targetId}
                  onValueChange={(v) => {
                    setNewScanTargetId(v)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a target..." />
                  </SelectTrigger>
                  <SelectContent>
                    {targets.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{' '}
                        <span className="text-xs text-muted-foreground">
                          (v{t.version})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md border border-dashed border-neutral-300 p-4 text-center text-sm text-muted-foreground">
                  No targets yet. Create one in the Targets tab first.
                </div>
              )}
            </CardContent>
          </Card>

          {selectedTarget && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-sm">
                  Target System Prompt
                </CardTitle>
                <CardDescription className="text-xs">
                  Read-only preview of what will be tested.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-neutral-50 p-3 font-mono text-xs text-neutral-700">
                  {selectedTarget.systemPrompt}
                </pre>
                {selectedTarget.context && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Context (RAG)
                    </div>
                    <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-neutral-50 p-3 font-mono text-xs text-neutral-700">
                      {selectedTarget.context}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: attack selection + run */}
        <div className="flex flex-col gap-6 lg:col-span-3">
          <Card>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>2. Select Attacks</CardTitle>
                  <CardDescription>
                    Default: all 6 attack types. Uncheck to skip a category.
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={selectAll}
                    className="text-red-700 hover:bg-red-50 hover:text-red-800"
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={clearAll}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {attacksLoading ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : attacks && attacks.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {attacks.map((a) => (
                    <AttackCard
                      key={a.id}
                      attack={a}
                      checked={selectedAttackIds.has(a.id)}
                      onToggle={() => toggleAttack(a.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Failed to load attacks.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Run summary */}
          <Card className="border-red-200">
            <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
              <div>
                <div className="text-sm font-semibold text-neutral-900">
                  {payloadCount} payload{payloadCount === 1 ? '' : 's'} will be
                  sent across {selectedAttacks.length} attack type
                  {selectedAttacks.length === 1 ? '' : 's'}.
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Estimated runtime: ~2 minutes. Keep this tab open.
                </div>
              </div>
              {runTooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex w-full sm:w-auto">
                      {runButton}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{runTooltip}</TooltipContent>
                </Tooltip>
              ) : (
                runButton
              )}
            </CardContent>
          </Card>

          {apiModeLocked && <ApiModeLockedCard />}

          {visibleQuotaError && <QuotaExceededCard message={visibleQuotaError} />}

          {createScan.isPending && <ScanStartingCard payloadCount={payloadCount} />}

          {createScan.isError && !visibleQuotaError && !(
            createScan.error instanceof JfetchError &&
            createScan.error.code === 'RATE_LIMITED'
          ) && (
            <Card className="border-red-200 bg-red-50/40">
              <CardContent className="flex items-start gap-3 p-4 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <div className="font-semibold">Scan failed</div>
                  <div className="text-xs">
                    {createScan.error?.message ?? 'Unknown error'}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accessibility helper label hidden visually */}
          <Label className="sr-only">Run scan button</Label>
        </div>
      </div>
    </div>
  )
}
