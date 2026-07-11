'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { signIn } from 'next-auth/react'
import { Toaster } from '@/components/ui/sonner'
import { Loader2, ShieldAlert, Github } from 'lucide-react'
import { LoadingScreen } from '@/components/landing/loading-screen'

// Inline Google SVG (lucide doesn't have a Google brand icon)
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

import { Header } from '@/components/redline/header'
import { useRedlineStore } from '@/components/redline/use-redline-store'
import { DashboardView } from '@/components/redline/dashboard-view'
import { TargetsView } from '@/components/redline/targets-view'
import { NewScanView } from '@/components/redline/new-scan-view'
import { ScanReportView } from '@/components/redline/scan-report-view'
import { HardenView } from '@/components/redline/harden-view'
import { BillingView } from '@/components/redline/billing-view'
import { useAuthUser, type AuthUser } from '@/lib/redline-api'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  })
}

function CurrentView() {
  const view = useRedlineStore((s) => s.currentView)
  switch (view) {
    case 'dashboard':
      return <DashboardView />
    case 'targets':
      return <TargetsView />
    case 'new-scan':
      return <NewScanView />
    case 'scan-report':
      return <ScanReportView />
    case 'harden':
      return <HardenView />
    case 'billing':
      return <BillingView />
    default:
      return <DashboardView />
  }
}

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 px-4 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
        <ShieldAlert className="h-7 w-7" />
      </span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  )
}

function LoginScreen() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-neutral-200 shadow-sm">
          <CardHeader className="items-center text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
              <ShieldAlert className="h-8 w-8" />
            </span>
            <CardTitle className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
              Redline
            </CardTitle>
            <CardDescription className="text-sm">
              AI Security Testing Platform
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-center text-sm text-muted-foreground">
              Sign in to red-team your LLM applications. Run 40 attack payloads
              across 6 attack types, score defenses, and auto-harden system
              prompts.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => signIn('github', { callbackUrl: '/app' })}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              >
                <Github className="h-5 w-5" />
                Sign in with GitHub
              </button>
              <button
                onClick={() => signIn('google', { callbackUrl: '/app' })}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              >
                <GoogleIcon className="h-5 w-5" />
                Sign in with Google
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              By signing in you agree to use Redline for educational and
              authorized security testing only.
            </p>
            <div className="mt-2 border-t border-dashed border-neutral-200 pt-4">
              <button
                onClick={() => signIn('dev-test', { callbackUrl: '/app', email: 'test@redline.dev' })}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-red-50 px-4 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Sign in as test user (dev only)
              </button>
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                Bypasses OAuth for local testing. Disabled in production.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="mt-auto border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          <span className="font-semibold text-red-600">Redline</span> — AI
          Security Testing Platform. Built for red-teaming LLM applications. |
          Educational use only.
        </div>
      </footer>
    </div>
  )
}

function AppShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900">
      <Header user={user} />
      <main className="flex-1">{children}</main>
      <footer className="mt-auto border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          <span className="font-semibold text-red-600">Redline</span> — AI
          Security Testing Platform. Built for red-teaming LLM applications. |
          Educational use only.
        </div>
      </footer>
    </div>
  )
}

function AuthenticatedApp() {
  const { data, isLoading, isError, error } = useAuthUser()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50 px-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <div className="text-sm text-red-600">
          {error?.message ?? 'Failed to load session.'}
        </div>
        <button
          onClick={() => signIn('github', { callbackUrl: '/app' })}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          <Github className="h-4 w-4" />
          Sign in with GitHub
        </button>
      </div>
    )
  }

  if (!data || data.user === null) {
    return <LoginScreen />
  }

  return <AppShell user={data.user}>{<CurrentView />}</AppShell>
}

export default function AppPage() {
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  )
}
