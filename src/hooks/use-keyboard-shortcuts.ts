'use client'

import { useEffect } from 'react'
import { useRedlineStore } from '@/components/redline/use-redline-store'

/**
 * Global keyboard shortcuts.
 *
 * Single-key shortcuts (no modifier) — only active when not typing in an
 * input/textarea/select.
 *
 *   d → Dashboard
 *   t → Targets
 *   n → New Scan
 *   r → Scan Report
 *   c → Compare
 *   h → Harden
 *   b → Billing
 *
 *   ? → Show shortcuts help (TODO)
 */
export function useKeyboardShortcuts() {
  const setView = useRedlineStore((s) => s.setView)
  const goToNewScan = useRedlineStore((s) => s.goToNewScan)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea/select
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      // Ignore if any modifier key is pressed (Ctrl, Alt, Meta, Shift)
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'd':
          setView('dashboard')
          break
        case 't':
          setView('targets')
          break
        case 'n':
          goToNewScan()
          break
        case 'r':
          setView('scan-report')
          break
        case 'c':
          setView('compare')
          break
        case 'h':
          setView('harden')
          break
        case 'b':
          setView('billing')
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setView, goToNewScan])
}
