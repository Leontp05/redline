'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Key, Webhook, Plus, Trash2, Loader2, Copy, Check, ExternalLink, Send, Crown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUsage, useCheckout, usePortal, PLAN_LIST } from '@/lib/redline-api'

// ─── API Keys ───

function ApiKeysSection() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await fetch('/api/api-keys')
      return res.json()
    },
  })

  const createKey = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      setNewKey(data.key)
      setName('')
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key created')
    },
    onError: () => toast.error('Failed to create API key'),
  })

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      await fetch('/api/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['api-keys'] })
      toast.success('API key revoked')
    },
  })

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Key className="h-4 w-4 text-red-600" />
          API Keys
        </CardTitle>
        <CardDescription className="text-xs">
          Use API keys to run scans programmatically (CI/CD, scripts). Keys are shown once — store them securely.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {/* Create form */}
        <div className="flex gap-2">
          <Input
            placeholder="Key name (e.g. GitHub Actions)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => name.trim() && createKey.mutate(name.trim())}
            disabled={createKey.isPending || !name.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {createKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create
          </Button>
        </div>

        {/* New key display */}
        {newKey && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400">⚠ Save this key — you won&apos;t see it again</span>
              <Button size="sm" variant="outline" onClick={copyKey}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <code className="mt-2 block break-all rounded bg-black/50 p-2 font-mono text-xs text-amber-300">
              {newKey}
            </code>
            <button
              onClick={() => setNewKey(null)}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Key list */}
        <div className="mt-4 flex flex-col gap-2">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : keys?.keys?.length > 0 ? (
            keys.keys.map((k: { id: string; name: string; keyPrefix: string; lastUsedAt: string | null; createdAt: string }) => (
              <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <div className="text-xs font-semibold text-foreground">{k.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {k.keyPrefix}...
                    {k.lastUsedAt && <span className="ml-2">· used {formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true })}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500/30 text-red-600 hover:bg-red-500/10"
                  onClick={() => deleteKey.mutate(k.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground">No API keys yet. Create one above.</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Webhooks ───

function WebhooksSection() {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')
  const [newSecret, setNewSecret] = useState<string | null>(null)

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const res = await fetch('/api/webhooks')
      return res.json()
    },
  })

  const createWebhook = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, events: 'scan.complete' }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      setNewSecret(data.secret)
      setUrl('')
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook created')
    },
    onError: () => toast.error('Failed to create webhook'),
  })

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      await fetch('/api/webhooks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook deleted')
    },
  })

  const testWebhook = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      return res.json()
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast.success(data.message || 'Test message sent!')
      } else {
        toast.error(data.error || 'Test failed')
      }
      qc.invalidateQueries({ queryKey: ['webhooks'] })
    },
    onError: () => toast.error('Failed to send test'),
  })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Webhook className="h-4 w-4 text-red-600" />
          Webhooks
        </CardTitle>
        <CardDescription className="text-xs">
          Redline posts scan results to your webhook URL when scans complete. Slack + Discord URLs are auto-detected and formatted as rich messages. Custom URLs receive signed JSON.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        {/* Create form */}
        <div className="flex gap-2">
          <Input
            placeholder="https://your-app.com/api/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => url.trim() && createWebhook.mutate(url.trim())}
            disabled={createWebhook.isPending || !url.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {createWebhook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>

        {/* New secret display */}
        {newSecret && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
            <div className="text-xs font-semibold text-amber-400">⚠ Save this secret — used to verify webhook signatures</div>
            <code className="mt-2 block break-all rounded bg-black/50 p-2 font-mono text-xs text-amber-300">
              {newSecret}
            </code>
            <button onClick={() => setNewSecret(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">
              Dismiss
            </button>
          </div>
        )}

        {/* Webhook list */}
        <div className="mt-4 flex flex-col gap-2">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : webhooks?.webhooks?.length > 0 ? (
            webhooks.webhooks.map((w: { id: string; url: string; events: string; isActive: boolean; lastFiredAt: string | null; lastStatus: number | null }) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-foreground">{w.url}</span>
                    {w.isActive ? (
                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-950/20 text-[9px] text-emerald-400">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-500/30 bg-red-950/20 text-[9px] text-red-400">Disabled</Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Events: {w.events}
                    {w.lastStatus != null && <span className="ml-2">· last: {w.lastStatus === 0 ? 'error' : w.lastStatus}</span>}
                    {w.lastFiredAt && <span className="ml-2">· {formatDistanceToNow(new Date(w.lastFiredAt), { addSuffix: true })}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                    onClick={() => testWebhook.mutate(w.id)}
                    disabled={testWebhook.isPending}
                  >
                    {testWebhook.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    <span className="ml-1 hidden sm:inline">Test</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 text-red-600 hover:bg-red-500/10"
                    onClick={() => deleteWebhook.mutate(w.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground">No webhooks yet. Add one above.</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── API Documentation ───

function ApiDocsSection() {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ExternalLink className="h-4 w-4 text-red-600" />
          API Documentation
        </CardTitle>
        <CardDescription className="text-xs">
          Use the public REST API to run scans from CI/CD, scripts, or your own app.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <div className="space-y-4 text-xs">
          <div>
            <div className="mb-1 font-semibold text-foreground">Authentication</div>
            <pre className="overflow-x-auto rounded bg-black/50 p-2 font-mono text-[11px] text-neutral-400">
{`Authorization: Bearer rl_live_xxx`}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-semibold text-foreground">Create a target</div>
            <pre className="overflow-x-auto rounded bg-black/50 p-2 font-mono text-[11px] text-neutral-400">
{`curl -X POST https://redline-orcin.vercel.app/api/v1/targets \\
  -H "Authorization: Bearer rl_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"My Bot","systemPrompt":"You are..."}'`}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-semibold text-foreground">Start a scan</div>
            <pre className="overflow-x-auto rounded bg-black/50 p-2 font-mono text-[11px] text-neutral-400">
{`curl -X POST https://redline-orcin.vercel.app/api/v1/scans \\
  -H "Authorization: Bearer rl_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"targetId":"target_id"}'`}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-semibold text-foreground">Poll for results</div>
            <pre className="overflow-x-auto rounded bg-black/50 p-2 font-mono text-[11px] text-neutral-400">
{`curl https://redline-orcin.vercel.app/api/v1/scans/SCAN_ID \\
  -H "Authorization: Bearer rl_live_xxx"`}
            </pre>
          </div>
          <div>
            <div className="mb-1 font-semibold text-foreground">Webhook payload (POSTed to your URL)</div>
            <pre className="overflow-x-auto rounded bg-black/50 p-2 font-mono text-[11px] text-neutral-400">
{`{
  "event": "scan.complete",
  "scanId": "xxx",
  "targetName": "My Bot",
  "overallScore": 75,
  "vulnerableCount": 10,
  "totalCount": 40,
  "timestamp": "2025-01-15T..."
}`}
            </pre>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Verify with: <code className="text-foreground">HMAC-SHA256(secret, body)</code> in the <code className="text-foreground">X-Redline-Signature</code> header.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Billing/Plan ───

function BillingSection() {
  const { data: usage, isLoading } = useUsage()
  const checkout = useCheckout()
  const portal = usePortal()
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)

  if (isLoading) return <div className="font-mono text-xs text-neutral-600">Loading...</div>
  if (!usage) return null

  const isAdmin = (usage as { isAdmin?: boolean }).isAdmin

  const onUpgrade = (plan: 'pro' | 'team') => {
    if (!usage.stripeConfigured) {
      toast.error('Payments are in dev mode — Stripe is not configured.')
      return
    }
    setPendingPlan(plan)
    checkout.mutate(
      { plan },
      {
        onSuccess: (url: string) => { window.location.href = url },
        onError: (err: Error) => { toast.error(err.message); setPendingPlan(null) },
      },
    )
  }

  const onManage = () => {
    portal.mutate(undefined, {
      onSuccess: (url: string) => { window.location.href = url },
      onError: (err: Error) => { toast.error(err.message) },
    })
  }

  if (isAdmin) {
    return (
      <Card className="border-amber-900/40 bg-amber-950/10">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <span className="font-mono text-sm text-amber-400">Admin — unlimited</span>
          </div>
          <p className="mt-2 font-mono text-xs text-amber-700">Admin users bypass all quotas, rate limits, and feature gates.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Current plan */}
      <Card className="border-neutral-900 bg-[#0f0f10]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-700">Current Plan</div>
              <div className="mt-1 font-serif text-2xl text-neutral-100">{usage.plan === 'team' ? 'Team' : usage.plan === 'pro' ? 'Pro' : 'Free'}</div>
            </div>
            {usage.subscriptionStatus === 'active' && (
              <Badge variant="outline" className="border-emerald-900/50 bg-emerald-950/20 text-emerald-400">Active</Badge>
            )}
          </div>
          <div className="mt-3 font-mono text-xs text-neutral-600">
            {usage.scansUsed} / {usage.scansLimit === -1 ? '∞' : usage.scansLimit} scans used
          </div>
          {usage.subscriptionStatus === 'active' && (
            <Button size="sm" variant="outline" className="mt-3 border-neutral-800 text-neutral-400" onClick={onManage}>
              Manage subscription
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLAN_LIST.map((plan: { id: string; name: string; priceMonthly: number; features: { scansPerMonth: number; maxTargets: number; apiConnectMode: boolean; harden: boolean } }) => {
          const isCurrent = usage.plan === plan.id
          const isUpgradeable = plan.id === 'pro' || plan.id === 'team'
          return (
            <Card key={plan.id} className={cn('border-neutral-900 bg-[#0f0f10]', plan.id === 'pro' && 'border-red-900/40')}>
              <CardContent className="p-4">
                <div className="font-mono text-xs text-neutral-500">{plan.name}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-serif text-2xl text-neutral-100">${plan.priceMonthly}</span>
                  <span className="font-mono text-[10px] text-neutral-700">/mo</span>
                </div>
                <div className="mt-2 font-mono text-[10px] text-neutral-600">
                  {plan.features.scansPerMonth === -1 ? '250 scans' : `${plan.features.scansPerMonth} scans`}
                </div>
                {isCurrent ? (
                  <div className="mt-3 font-mono text-[10px] text-neutral-600">Current</div>
                ) : isUpgradeable && usage.stripeConfigured ? (
                  <Button
                    size="sm"
                    className="mt-3 w-full bg-red-600 hover:bg-red-700"
                    disabled={checkout.isPending}
                    onClick={() => onUpgrade(plan.id as 'pro' | 'team')}
                  >
                    {pendingPlan === plan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Upgrade'}
                  </Button>
                ) : isUpgradeable ? (
                  <div className="mt-3 font-mono text-[10px] text-neutral-700">Dev mode</div>
                ) : (
                  <div className="mt-3 font-mono text-[10px] text-neutral-700">—</div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main view ───

export function SettingsView() {
  const [tab, setTab] = useState<'plan' | 'api' | 'webhooks'>('plan')
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-700">Settings</div>
        <h1 className="font-serif text-3xl font-light text-neutral-100">Settings</h1>
      </div>

      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg border border-neutral-900 bg-[#0f0f10] p-1">
        {(['plan', 'api', 'webhooks'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-md px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors',
              tab === t ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-600 hover:text-neutral-400',
            )}
          >
            {t === 'plan' ? 'Plan' : t === 'api' ? 'API Keys' : 'Webhooks'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {tab === 'plan' && <BillingSection />}
        {tab === 'api' && (
          <>
            <ApiKeysSection />
            <ApiDocsSection />
          </>
        )}
        {tab === 'webhooks' && <WebhooksSection />}
      </div>
    </div>
  )
}
