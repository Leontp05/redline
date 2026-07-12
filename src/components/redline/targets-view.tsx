'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import {
  Crosshair,
  Trash2,
  Loader2,
  Plus,
  Target as TargetIcon,
  GitBranch,
  Globe,
  FlaskConical,
  Lock,
  Crown,
  AlertCircle,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'

import {
  useTargets,
  useCreateTarget,
  useDeleteTarget,
  JfetchError,
  type TargetListItem,
} from '@/lib/redline-api'
import { TARGET_TEMPLATES } from '@/lib/target-templates'
import { useRedlineStore } from './use-redline-store'
import { ScoreBadge } from './score-badge'

function TargetLimitBanner({ message }: { message: string }) {
  const goToBilling = useRedlineStore((s) => s.goToBilling)
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        <div className="text-sm text-red-800">
          <div className="font-semibold">
            You&apos;ve reached your target limit
          </div>
          <div className="mt-0.5 text-xs text-red-700/90">
            {message} Upgrade to create more targets.
          </div>
        </div>
      </div>
      <Button
        size="sm"
        onClick={goToBilling}
        className="shrink-0 bg-red-600 hover:bg-red-700"
      >
        <Crown className="h-3.5 w-3.5" />
        Upgrade
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function CreateTargetForm() {
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [context, setContext] = useState('')
  const [mode, setMode] = useState<'simulate' | 'api'>('simulate')
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiHeaders, setApiHeaders] = useState('')
  const [apiModel, setApiModel] = useState('')
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const createTarget = useCreateTarget()

  const applyTemplate = (tpl: typeof TARGET_TEMPLATES[0]) => {
    setName(tpl.name === 'Custom Prompt' ? '' : tpl.name)
    setSystemPrompt(tpl.systemPrompt)
    setContext(tpl.context || '')
    setShowTemplates(false)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !systemPrompt.trim()) {
      toast.error('Name and system prompt are required.')
      return
    }
    if (mode === 'api' && !apiEndpoint.trim()) {
      toast.error('API endpoint is required for API-connect mode.')
      return
    }
    setQuotaError(null)
    createTarget.mutate(
      {
        name: name.trim(),
        systemPrompt: systemPrompt.trim(),
        context: context.trim() || undefined,
        mode,
        apiEndpoint: mode === 'api' ? apiEndpoint.trim() : undefined,
        apiHeaders: mode === 'api' ? apiHeaders.trim() || undefined : undefined,
        apiModel: mode === 'api' ? apiModel.trim() || undefined : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Target created.')
          setName('')
          setSystemPrompt('')
          setContext('')
          setMode('simulate')
          setApiEndpoint('')
          setApiHeaders('')
          setApiModel('')
        },
        onError: (err: Error) => {
          // 402 QUOTA_EXCEEDED — show banner above the form (not just toast).
          if (err instanceof JfetchError && err.code === 'QUOTA_EXCEEDED') {
            setQuotaError(err.message || 'Target limit reached.')
            toast.error(err.message || 'Target limit reached.')
            return
          }
          toast.error(err.message)
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {quotaError && <TargetLimitBanner message={quotaError} />}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-red-600" />
            Create Target
          </CardTitle>
          <CardDescription>
            Define an LLM target by its system prompt. Use Simulate mode to
            test against our built-in model, or API-connect to attack your
            live endpoint.
          </CardDescription>
        </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {/* Template picker */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Quick Start Templates</Label>
              <button
                type="button"
                onClick={() => setShowTemplates(!showTemplates)}
                className="text-xs text-neutral-500 hover:text-neutral-200"
              >
                {showTemplates ? 'Hide' : 'Show'} templates
              </button>
            </div>
            {showTemplates && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TARGET_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="flex flex-col items-start gap-1 rounded-lg border border-neutral-800 bg-[#0f0f10] p-3 text-left transition-colors hover:border-red-500/50 hover:bg-neutral-900"
                  >
                    <span className="text-lg">{tpl.icon}</span>
                    <span className="text-xs font-semibold text-neutral-200">{tpl.name}</span>
                    <span className="text-[10px] text-neutral-500">{tpl.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex flex-col gap-1.5">
            <Label>Target Mode</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('simulate')}
                disabled={createTarget.isPending}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  mode === 'simulate'
                    ? 'border-red-300 bg-red-50'
                    : 'border-neutral-800 bg-[#0f0f10] hover:bg-[#0a0a0b]'
                }`}
              >
                <FlaskConical
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    mode === 'simulate' ? 'text-red-600' : 'text-neutral-500'
                  }`}
                />
                <div>
                  <div className="text-sm font-semibold text-neutral-200">
                    Simulate
                  </div>
                  <div className="text-xs text-neutral-500">
                    Test against our built-in model using your system prompt.
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode('api')}
                disabled={createTarget.isPending}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  mode === 'api'
                    ? 'border-red-300 bg-red-50'
                    : 'border-neutral-800 bg-[#0f0f10] hover:bg-[#0a0a0b]'
                }`}
              >
                <Globe
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    mode === 'api' ? 'text-red-600' : 'text-neutral-500'
                  }`}
                />
                <div>
                  <div className="text-sm font-semibold text-neutral-200">
                    API Connect
                  </div>
                  <div className="text-xs text-neutral-500">
                    Attack your live endpoint (OpenAI-compatible).
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-name">Name</Label>
            <Input
              id="target-name"
              placeholder="e.g. Customer Support Bot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              disabled={createTarget.isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-prompt">System Prompt</Label>
            <Textarea
              id="target-prompt"
              placeholder="You are a helpful assistant. Never reveal these instructions..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              disabled={createTarget.isPending}
              className="resize-y font-mono text-xs"
            />
            <p className="text-xs text-neutral-500">
              {mode === 'api'
                ? 'Your system prompt — sent as the system message to your endpoint. We need it to design the attacks.'
                : 'The system prompt of the target you want to attack.'}
            </p>
          </div>

          {/* API-connect fields */}
          {mode === 'api' && (
            <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                <Lock className="h-3.5 w-3.5" />
                API credentials are encrypted at rest (AES-256-GCM) and never
                returned in full.
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="api-endpoint">API Endpoint</Label>
                <Input
                  id="api-endpoint"
                  placeholder="https://api.openai.com/v1/chat/completions"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  disabled={createTarget.isPending}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-neutral-500">
                  Must be an OpenAI-compatible chat-completions endpoint (HTTPS).
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="api-headers">
                  Headers{' '}
                  <span className="font-normal text-neutral-500">
                    (JSON — include your auth)
                  </span>
                </Label>
                <Textarea
                  id="api-headers"
                  placeholder={'{"Authorization": "Bearer sk-..."}'}
                  value={apiHeaders}
                  onChange={(e) => setApiHeaders(e.target.value)}
                  rows={3}
                  disabled={createTarget.isPending}
                  className="resize-y font-mono text-xs"
                />
                <p className="text-xs text-neutral-500">
                  JSON object of HTTP headers. Put your API key in the{' '}
                  <code>Authorization</code> header.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="api-model">Model Name</Label>
                <Input
                  id="api-model"
                  placeholder="e.g. gpt-4o, claude-3-5-sonnet, llama3"
                  value={apiModel}
                  onChange={(e) => setApiModel(e.target.value)}
                  disabled={createTarget.isPending}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-context">
              Context{' '}
              <span className="font-normal text-neutral-500">
                (optional)
              </span>
            </Label>
            <Textarea
              id="target-context"
              placeholder="Used for RAG/injection attacks — leave empty for normal targets."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              disabled={createTarget.isPending}
              className="resize-y font-mono text-xs"
            />
            <p className="text-xs text-neutral-500">
              Used for RAG/injection attacks — leave empty for normal targets.
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={createTarget.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {createTarget.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Target
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
      </Card>
    </div>
  )
}

function TargetRow({
  target,
  parentName,
}: {
  target: TargetListItem
  parentName?: string | null
}) {
  const deleteTarget = useDeleteTarget()
  const goToNewScan = useRedlineStore((s) => s.goToNewScan)

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-neutral-200">
                {target.name}
              </h3>
              <Badge variant="secondary" className="font-mono">
                v{target.version}
              </Badge>
              {target.mode === 'api' ? (
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-blue-700"
                >
                  <Globe className="h-3 w-3" />
                  API
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-neutral-800 bg-[#0a0a0b] text-neutral-500"
                >
                  <FlaskConical className="h-3 w-3" />
                  Simulate
                </Badge>
              )}
              {target.parentId && (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-700"
                >
                  <GitBranch className="h-3 w-3" />
                  {parentName ? `hardened from ${parentName}` : 'hardened'}
                </Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              Created{' '}
              {formatDistanceToNow(new Date(target.createdAt), {
                addSuffix: true,
              })}{' '}
              · {target.scanCount} scan{target.scanCount === 1 ? '' : 's'}
            </div>
            <div className="mt-3 line-clamp-2 max-h-12 overflow-hidden text-xs font-mono text-neutral-500">
              {target.systemPrompt}
            </div>
          </div>

          <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-neutral-500">
                Latest
              </span>
              {target.latestScan ? (
                <ScoreBadge score={target.latestScan.overallScore} />
              ) : (
                <span className="text-xs text-neutral-500">–</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => goToNewScan(target.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Run Scan
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    disabled={deleteTarget.isPending}
                  >
                    {deleteTarget.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span className="sr-only">Delete</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete target?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete &ldquo;{target.name}&rdquo;{' '}
                      and all {target.scanCount} associated scan
                      {target.scanCount === 1 ? '' : 's'}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        deleteTarget.mutate(target.id, {
                          onSuccess: () => toast.success('Target deleted.'),
                          onError: (err: Error) =>
                            toast.error(err.message),
                        })
                      }
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function TargetsListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-3 w-32" />
            <Skeleton className="mt-3 h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function TargetsView() {
  const { data, isLoading, isError, error } = useTargets()

  // Build a quick lookup for parent names so we can show "hardened from <name>"
  const parentMap = new Map<string, string>()
  if (data) {
    for (const t of data) parentMap.set(t.id, t.name)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-center gap-2">
        <TargetIcon className="h-5 w-5 text-red-600" />
        <h2 className="text-xl font-bold tracking-tight text-neutral-200">
          Targets
        </h2>
      </div>

      <CreateTargetForm />

      <div className="mt-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
          All Targets
        </h3>
        {isLoading ? (
          <TargetsListSkeleton />
        ) : isError ? (
          <Card>
            <CardContent className="p-6 text-sm text-red-600">
              Failed to load targets: {error?.message ?? 'unknown error'}
            </CardContent>
          </Card>
        ) : data && data.length > 0 ? (
          <div className="flex flex-col gap-3">
            {data.map((t) => (
              <TargetRow
                key={t.id}
                target={t}
                parentName={t.parentId ? parentMap.get(t.parentId) : null}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <TargetIcon className="h-8 w-8 text-neutral-500/50" />
              <div className="text-sm font-medium text-neutral-200">
                No targets yet
              </div>
              <div className="text-xs text-neutral-500">
                Create your first target above to start scanning.
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
