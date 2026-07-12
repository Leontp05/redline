'use client'

import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { ShieldAlert, Home, Crosshair, FlaskConical, Settings, LogOut } from 'lucide-react'
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
  { key: 'home', label: 'Home', icon: Home },
  { key: 'targets', label: 'Targets', icon: Crosshair },
  { key: 'scans', label: 'Scans', icon: FlaskConical },
  { key: 'settings', label: 'Settings', icon: Settings },
]

function initialsFrom(user: AuthUser): string {
  const name = user.name?.trim()
  if (name && name.length > 0) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const email = user.email?.trim()
  if (email && email.length > 0) {
    return email.slice(0, 2).toUpperCase()
  }
  return 'RL'
}

export function Header({ user }: { user: AuthUser }) {
  const currentView = useRedlineStore((s) => s.currentView)
  const setView = useRedlineStore((s) => s.setView)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-900 bg-[#0a0a0b]/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <button
          onClick={() => setView('home')}
          className="flex items-center gap-2"
        >
          <ShieldAlert className="h-5 w-5 text-red-600" />
          <span className="font-serif text-base tracking-tight text-neutral-200">Redline</span>
        </button>

        {/* Tabs */}
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = currentView === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setView(tab.key)}
                className={cn(
                  'group relative flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-xs transition-colors',
                  isActive
                    ? 'text-neutral-200'
                    : 'text-neutral-600 hover:text-neutral-400',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                {isActive && (
                  <span className="absolute -bottom-px left-0 h-px w-full bg-gradient-to-r from-transparent via-red-600 to-transparent" />
                )}
              </button>
            )
          })}
        </nav>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex items-center gap-2 rounded-full border border-neutral-800 py-1 pl-1 pr-2 outline-none transition-colors hover:border-neutral-700"
              aria-label="User menu"
            >
              <Avatar className="h-6 w-6">
                {user.image ? (
                  <AvatarImage src={user.image} alt={user.name ?? 'user avatar'} />
                ) : null}
                <AvatarFallback className={user.isAdmin ? 'bg-amber-600 text-[9px] font-semibold text-white' : 'bg-red-600 text-[9px] font-semibold text-white'}>
                  {user.isAdmin ? '★' : initialsFrom(user)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[100px] truncate text-xs font-medium text-neutral-500 sm:block">
                {user.name ?? user.email ?? 'Account'}
                {user.isAdmin && (
                  <span className="ml-1 rounded bg-amber-900/40 px-1 py-0.5 text-[8px] font-bold uppercase text-amber-500">
                    Admin
                  </span>
                )}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 border-neutral-800 bg-[#0f0f10]">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-neutral-200">
                {user.name ?? 'Signed in'}
              </span>
              {user.email && (
                <span className="truncate text-xs font-normal text-neutral-600">
                  {user.email}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-neutral-800" />
            <DropdownMenuItem asChild>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex w-full cursor-pointer items-center gap-2 text-sm text-red-500 focus:text-red-400"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
