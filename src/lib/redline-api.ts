'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query'

// ---------- Types (mirror backend response shapes from worklog) ----------

export interface AttackType {
  id: string
  key: string
  name: string
  category: string
  severityWeight: number
  description: string
}

export interface LatestScanSummary {
  id: string
  overallScore: number | null
  createdAt: string
}

export interface TargetListItem {
  id: string
  name: string
  systemPrompt: string
  context: string | null
  parentId: string | null
  version: number
  mode: 'simulate' | 'api'
  apiEndpoint: string | null
  apiModel: string | null
  hasApiHeaders: boolean
  createdAt: string
  updatedAt: string
  scanCount: number
  latestScan: LatestScanSummary | null
}

export interface Target {
  id: string
  name: string
  systemPrompt: string
  context: string | null
  parentId: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface TargetWithScans extends Target {
  scans: Array<{
    id: string
    targetId: string
    createdAt: string
    status: string
    overallScore: number | null
    categoryScores: Record<string, number> | null
    note: string | null
    _count: { results: number }
  }>
}

export interface ConversationTurn {
  role: string
  content: string
}

export interface ScanResult {
  id: string
  scanId: string
  attackTypeId: string
  technique: string
  payload: string
  response: string
  success: boolean
  evidence: string
  conversation: ConversationTurn[] | null
  createdAt: string
  attackType: AttackType
}

export interface Scan {
  id: string
  targetId: string
  createdAt: string
  status: string // 'running' | 'complete' | 'failed'
  overallScore: number | null
  categoryScores: Record<string, number> | null
  note: string | null
}

export interface ScanWithRelations extends Scan {
  target: Target
  results: ScanResult[]
}

export interface ScanListItem {
  id: string
  targetId: string
  createdAt: string
  status: string
  overallScore: number | null
  categoryScores: Record<string, number> | null
  note: string | null
  target: { id: string; name: string }
  resultCount: number
}

export interface Stats {
  targetsCount: number
  scansCount: number
  avgScore: number | null
  hardeningImprovements: number
  recentScans: ScanListItem[]
}

export interface HardenResponse {
  hardenedTargetId: string
  hardenedScanId: string
  originalScanId: string
}

// ---------- Auth ----------

export interface AuthUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

// ---------- Fetch helpers ----------

/**
 * Richer error type for non-OK responses. Carries the HTTP status, an optional
 * machine-readable `code` (e.g. 'QUOTA_EXCEEDED', 'RATE_LIMITED'), and an
 * optional `retryAfter` (seconds) for rate-limit responses. UIs that need to
 * branch on these can `instanceof JfetchError` and read the fields; everything
 * else still works because `.message` is set from the body's `error` string.
 */
export class JfetchError extends Error {
  status: number
  code?: string
  retryAfter?: number
  constructor(
    message: string,
    status: number,
    code?: string,
    retryAfter?: number,
  ) {
    super(message)
    this.name = 'JfetchError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

async function jfetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    let code: string | undefined
    let retryAfter: number | undefined
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
      if (body?.code && typeof body.code === 'string') code = body.code
      if (typeof body?.retryAfter === 'number') retryAfter = body.retryAfter
    } catch {
      // ignore parse errors
    }
    // 401 = session expired / not authenticated. Surface a clear message;
    // the UI's `useAuthUser` query will still hold the (now stale) user, but
    // any mutation/query error handler can trigger a re-fetch of /api/auth/me
    // or the user can refresh the page to land back on the login screen.
    if (res.status === 401) {
      throw new JfetchError(
        'Session expired. Please sign in again.',
        401,
        code,
        retryAfter,
      )
    }
    throw new JfetchError(msg, res.status, code, retryAfter)
  }
  return res.json() as Promise<T>
}

// ---------- Queries ----------

export function useAttacks() {
  return useQuery<AttackType[]>({
    queryKey: ['attacks'],
    queryFn: async () => (await jfetch<{ attacks: AttackType[] }>('/api/attacks')).attacks,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTargets() {
  return useQuery<TargetListItem[]>({
    queryKey: ['targets'],
    queryFn: async () => (await jfetch<{ targets: TargetListItem[] }>('/api/targets')).targets,
    placeholderData: keepPreviousData,
  })
}

export function useTarget(id: string | null | undefined) {
  return useQuery<TargetWithScans | null>({
    queryKey: ['target', id],
    queryFn: async () => {
      if (!id) return null
      const data = await jfetch<{ target: TargetWithScans }>(`/api/targets/${id}`)
      return data.target
    },
    enabled: !!id,
  })
}

export function useScans() {
  return useQuery<ScanListItem[]>({
    queryKey: ['scans'],
    queryFn: async () => (await jfetch<{ scans: ScanListItem[] }>('/api/scans')).scans,
    placeholderData: keepPreviousData,
  })
}

export function useScan(id: string | null | undefined) {
  return useQuery<ScanWithRelations | null>({
    queryKey: ['scan', id],
    queryFn: async () => {
      if (!id) return null
      const data = await jfetch<{ scan: ScanWithRelations }>(`/api/scans/${id}`)
      return data.scan
    },
    enabled: !!id,
    // Poll every 3s while the scan is still running; stop once it flips to
    // 'complete' or 'failed'. This drives the live progress UI in the Scan
    // Report view (and the polling after a harden kick-off).
    refetchInterval: (query) => {
      const scan = query.state.data
      if (scan?.status === 'running') return 3000
      return false
    },
  })
}

export function useAuthUser() {
  return useQuery<{ user: AuthUser | null }>({
    queryKey: ['auth-me'],
    queryFn: async () =>
      await jfetch<{ user: AuthUser | null }>('/api/auth/me'),
    staleTime: 60_000,
    refetchOnMount: true,
  })
}

export function useStats() {
  return useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => jfetch<Stats>('/api/stats'),
    placeholderData: keepPreviousData,
  })
}

// ---------- Mutations ----------

export function useCreateTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      systemPrompt: string
      context?: string
      mode?: 'simulate' | 'api'
      apiEndpoint?: string
      apiHeaders?: string
      apiModel?: string
    }) => {
      const data = await jfetch<{ target: Target }>('/api/targets', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.target
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['targets'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useDeleteTarget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await jfetch<{ ok: true }>(`/api/targets/${id}`, { method: 'DELETE' })
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['targets'] })
      qc.invalidateQueries({ queryKey: ['scans'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useCreateScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { targetId: string; attackTypeIds?: string[] }) => {
      const data = await jfetch<{ scan: ScanWithRelations } & { error?: string }>(
        '/api/scans',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      )
      return data.scan
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans'] })
      qc.invalidateQueries({ queryKey: ['targets'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

export function useHarden() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { scanId: string }) => {
      const data = await jfetch<HardenResponse>('/api/harden', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans'] })
      qc.invalidateQueries({ queryKey: ['targets'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// ---------- Score color helpers ----------

export type ScoreTier = 'strong' | 'medium' | 'weak'

export function scoreTier(score: number | null | undefined): ScoreTier {
  if (score == null) return 'medium'
  if (score >= 80) return 'strong'
  if (score >= 50) return 'medium'
  return 'weak'
}

export function scoreColor(score: number | null | undefined): string {
  const t = scoreTier(score)
  if (t === 'strong') return 'text-emerald-600'
  if (t === 'medium') return 'text-amber-600'
  return 'text-red-600'
}

export function scoreBg(score: number | null | undefined): string {
  const t = scoreTier(score)
  if (t === 'strong') return 'bg-emerald-500'
  if (t === 'medium') return 'bg-amber-500'
  return 'bg-red-500'
}

export function scoreRingStroke(score: number | null | undefined): string {
  const t = scoreTier(score)
  if (t === 'strong') return '#10b981' // emerald-500
  if (t === 'medium') return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

export function scoreLabel(score: number | null | undefined): string {
  const t = scoreTier(score)
  if (t === 'strong') return 'Strong defenses'
  if (t === 'medium') return 'Some vulnerabilities'
  return 'Critical vulnerabilities'
}

// ---------- Billing (Phase 2) ----------

export type Plan = 'free' | 'pro' | 'team'

export interface UsageInfo {
  plan: Plan
  scansUsed: number
  scansLimit: number // -1 = unlimited
  scansRemaining: number // -1 = unlimited
  targetsUsed: number
  targetsLimit: number // -1 = unlimited
  periodStart: string
  periodEnd: string
  resetAt: string
  stripeConfigured: boolean
  subscriptionStatus: string | null // active | past_due | canceled | null
}

export function useUsage() {
  return useQuery<UsageInfo>({
    queryKey: ['usage'],
    queryFn: async () => jfetch<UsageInfo>('/api/billing/usage'),
    staleTime: 30_000,
  })
}

export function useCheckout() {
  return useMutation({
    mutationFn: async (input: { plan: 'pro' | 'team' }) => {
      const data = await jfetch<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify(input),
      })
      return data.url
    },
  })
}

export function usePortal() {
  return useMutation({
    mutationFn: async () => {
      const data = await jfetch<{ url: string }>('/api/billing/portal', {
        method: 'POST',
      })
      return data.url
    },
  })
}

// ---------- Plan feature helpers ----------

/**
 * Plans where API-connect mode is available. Free users can only use Simulate.
 */
export function planHasApiConnect(plan: Plan | undefined | null): boolean {
  return plan === 'pro' || plan === 'team'
}

/**
 * Plans where the auto-harden feature is available. Free users see the button
 * disabled with a lock icon and upgrade tooltip.
 */
export function planHasHarden(plan: Plan | undefined | null): boolean {
  return plan === 'pro' || plan === 'team'
}

/**
 * Friendly display name for a plan code.
 */
export function planDisplayName(plan: Plan | undefined | null): string {
  if (plan === 'pro') return 'Pro'
  if (plan === 'team') return 'Team'
  return 'Free'
}
