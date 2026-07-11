'use client'

import { useEffect, useState } from 'react'

const BOOT_LINES = [
  { text: 'Redline v1.0 — AI Security Testing Platform', delay: 0 },
  { text: 'Initializing attack modules...', delay: 300 },
  { text: '✓ 6 attack types loaded (40 payloads)', delay: 200 },
  { text: 'Connecting to database...', delay: 250 },
  { text: '✓ Postgres connection established', delay: 200 },
  { text: 'Loading scoring engine...', delay: 200 },
  { text: '✓ Severity-weighted scoring ready', delay: 150 },
  { text: 'Verifying session...', delay: 300 },
]

/**
 * Hacker-style boot sequence loading screen.
 * Shown while the app checks auth state on initial load.
 */
export function LoadingScreen() {
  const [visibleLines, setVisibleLines] = useState<number>(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let mounted = true
    let totalDelay = 0
    const timeouts: ReturnType<typeof setTimeout>[] = []

    BOOT_LINES.forEach((line, i) => {
      totalDelay += line.delay
      timeouts.push(
        setTimeout(() => {
          if (mounted) setVisibleLines(i + 1)
        }, totalDelay),
      )
    })

    // Mark done after all lines appear
    timeouts.push(
      setTimeout(() => {
        if (mounted) setDone(true)
      }, totalDelay + 200),
    )

    return () => {
      mounted = false
      timeouts.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Matrix rain background (simplified, static-ish) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, #ef4444 2px, #ef4444 4px)`,
        }}
      />

      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, #ff0000 3px, #ff0000 4px)`,
        }}
      />

      {/* Center content */}
      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white shadow-lg shadow-red-600/30">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
            </svg>
          </span>
          <span className="font-mono text-xl font-bold tracking-tight text-white">
            REDLINE
          </span>
        </div>

        {/* Boot terminal */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-950/80 p-4 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2 border-b border-neutral-800 pb-2">
            <div className="flex gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-500/60" />
              <div className="h-2 w-2 rounded-full bg-amber-500/60" />
              <div className="h-2 w-2 rounded-full bg-emerald-500/60" />
            </div>
            <span className="font-mono text-[10px] text-neutral-600">boot — bash — 80x12</span>
          </div>
          <div className="font-mono text-xs leading-relaxed">
            {BOOT_LINES.slice(0, visibleLines).map((line, i) => {
              const isCheck = line.text.startsWith('✓')
              return (
                <div
                  key={i}
                  className={
                    isCheck ? 'text-emerald-400' : 'text-neutral-400'
                  }
                >
                  {line.text}
                </div>
              )
            })}
            {!done && (
              <div className="text-red-400">
                <span className="animate-pulse">▊</span>
              </div>
            )}
            {done && (
              <div className="mt-1 text-amber-400">
                <span className="animate-pulse">▊</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-neutral-900">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300"
            style={{ width: `${(visibleLines / BOOT_LINES.length) * 100}%` }}
          />
        </div>

        {/* Status text */}
        <div className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-neutral-600">
          {done ? 'Ready' : 'Loading...'}
        </div>
      </div>
    </div>
  )
}
