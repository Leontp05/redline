'use client'

import { useEffect } from 'react'
import { useRedlineStore } from '@/components/redline/use-redline-store'

/**
 * Global keyboard shortcuts.
 *
 *   h → Home
 *   t → Targets
 *   s → Scans
 *   , → Settings
 */
export function useKeyboardShortcuts() {
  const setView = useRedlineStore((s) => s.setView)
  const goToNewScan = useRedlineStore((s) => s.goToNewScan)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return

      switch (e.key.toLowerCase()) {
        case 'h':
          setView('home')
          break
        case 't':
          setView('targets')
          break
        case 's':
          setView('scans')
          break
        case ',':
          setView('settings')
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setView, goToNewScan])
}
