'use client'

import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  ShieldAlert,
  LayoutDashboard,
  Crosshair,
  ListChecks,
  FlaskConical,
  Shield,
  CreditCard,
  LogOut,
} from 'lucide-react'
import { useRedlineStore, type RedlineView } from './use-redline-store'
import type { AuthUser } from '@/lib/redline-api'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TabDef {
  key: RedlineView
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'targets', label: 'Targets', icon: ListChecks },
  { key: 'new-scan', label: 'New Scan', icon: Crosshair },
  { key: 'scan-report', label: 'Scan Report', icon: FlaskConical },
  { key: 'harden', label: 'Harden', icon: Shield },
  { key: 'billing', label: 'Billing', icon: CreditCard },
]

function initialsFrom(user: AuthUser): string {
  const name = user.name?.trim()
  if (name && name.length > 0) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }
  if (user.email && user.email.length > 0) {
    return user.email.slice(0, 2).toUpperCase()
  }
  return 'RL'
}

export function Header({ user }: { user: AuthUser }) {
  const currentView = useRedlineStore((s) => s.currentView)
  const setView = useRedlineStore((s) => s.setView)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-6">
        {/* Logo / wordmark */}
        <button
          type="button"
          onClick={() => setView('dashboard')}
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          aria-label="Redline home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <span className="flex flex-col items-start leading-none">
            <span className="text-base font-bold tracking-tight text-neutral-900">
              Redline
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-wider text-red-600 sm:block">
              AI Security Testing
            </span>
          </span>
        </button>

        {/* Right side: tabs + user menu */}
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Primary">
            {TABS.map((t) => {
              const active = currentView === t.key
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setView(t.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm',
                    active
                      ? 'bg-red-50 text-red-700'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{t.label}</span>
                </button>
              )
            })}
          </nav>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-2 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-red-500/40"
                aria-label="User menu"
              >
                <Avatar className="h-7 w-7">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={user.name ?? 'user avatar'} />
                  ) : null}
                  <AvatarFallback className={user.isAdmin ? 'bg-amber-600 text-[10px] font-semibold text-white' : 'bg-red-600 text-[10px] font-semibold text-white'}>
                    {user.isAdmin ? '★' : initialsFrom(user)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-[120px] truncate text-xs font-medium text-neutral-700 sm:block">
                  {user.name ?? user.email ?? 'Account'}
                  {user.isAdmin && (
                    <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                      Admin
                    </span>
                  )}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-neutral-900">
                  {user.name ?? 'Signed in'}
                </span>
                {user.email && (
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                asChild
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                <button className="flex w-full cursor-pointer items-center gap-2 text-sm text-red-700 focus:text-red-800">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
