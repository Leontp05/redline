'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { signIn } from 'next-auth/react'
import { Toaster } from '@/components/ui/sonner'
import { Loader2, ShieldAlert, Github } from 'lucide-react'
import { LoadingScreen } from '@/components/landing/loading-screen'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { motion, AnimatePresence } from 'framer-motion'

import { Header } from '@/components/redline/header'
import { AppBackground } from '@/components/redline/app-background'
import { useRedlineStore } from '@/components/redline/use-redline-store'
import { HomeView } from '@/components/redline/home-view'
import { TargetsView } from '@/components/redline/targets-view'
import { ScansView } from '@/components/redline/scans-view'
import { SettingsView } from '@/components/redline/settings-view'
import { useAuthUser, type AuthUser } from '@/lib/redline-api'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

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
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {view === 'home' && <HomeView />}
        {view === 'targets' && <TargetsView />}
        {view === 'scans' && <ScansView />}
        {view === 'settings' && <SettingsView />}
      </motion.div>
    </AnimatePresence>
  )
}

function LoginScreen() {
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [adminLoading, setAdminLoading] = useState(false)

  const handleAdminLogin = () => {
    if (!adminKey.trim()) return
    setAdminLoading(true)
    signIn('admin', { callbackUrl: '/app', password: adminKey.trim(), redirect: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0b]">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-neutral-900 bg-[#0f0f10]">
          <CardHeader className="items-center text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm">
              <ShieldAlert className="h-8 w-8" />
            </span>
            <CardTitle className="mt-2 font-serif text-2xl tracking-tight text-neutral-100">
              Redline
            </CardTitle>
            <CardDescription className="font-mono text-xs text-neutral-600">
              AI Security Testing Platform
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <button
                onClick={() => signIn('github', { callbackUrl: '/app' })}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                <Github className="h-5 w-5" />
                Sign in with GitHub
              </button>
              <button
                onClick={() => signIn('google', { callbackUrl: '/app' })}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-neutral-800 bg-transparent px-4 text-sm font-semibold text-neutral-300 transition-colors hover:bg-neutral-900"
              >
                <GoogleIcon className="h-5 w-5" />
                Sign in with Google
              </button>
            </div>
            <p className="text-center text-[10px] text-neutral-700">
              By signing in you agree to use Redline for educational and authorized security testing only.
            </p>
            <div className="mt-2 border-t border-neutral-900 pt-4">
              {!showAdmin ? (
                <button
                  onClick={() => setShowAdmin(true)}
                  className="mx-auto block font-mono text-[10px] text-neutral-700 hover:text-neutral-500"
                >
                  Admin login
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    type="password"
                    placeholder="Admin API key"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                    className="h-9 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 font-mono text-xs text-neutral-200"
                    disabled={adminLoading}
                  />
                  <button
                    onClick={handleAdminLogin}
                    disabled={adminLoading || !adminKey.trim()}
                    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-neutral-900 px-4 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
                  >
                    {adminLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Sign in as Admin
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="mt-auto border-t border-neutral-900 py-4">
        <div className="mx-auto w-full max-w-7xl px-4 text-center font-mono text-[10px] text-neutral-700 sm:px-6">
          <span className="text-red-600">Redline</span> — Educational use only
        </div>
      </footer>
    </div>
  )
}

function AppShell({ user, children }: { user: AuthUser; children: ReactNode }) {
  useKeyboardShortcuts()
  return (
    <div className="relative flex min-h-screen flex-col bg-[#0a0a0b] text-neutral-200">
      <AppBackground />
      <Header user={user} />
      <main className="relative z-10 flex-1">{children}</main>
      <footer className="relative z-10 mt-auto border-t border-neutral-900 py-4">
        <div className="mx-auto w-full max-w-7xl px-4 text-center font-mono text-[10px] text-neutral-700 sm:px-6">
          <span className="text-red-600">Redline</span> — Educational use only
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0b] px-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600 text-white">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <div className="font-mono text-sm text-red-500">
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
