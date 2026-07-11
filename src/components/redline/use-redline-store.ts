'use client'

import { create } from 'zustand'

export type RedlineView =
  | 'dashboard'
  | 'targets'
  | 'new-scan'
  | 'scan-report'
  | 'harden'
  | 'billing'

interface RedlineState {
  currentView: RedlineView
  selectedScanId: string | null
  selectedTargetId: string | null
  // For the Harden view: a scan preselected from the Scan Report's "Harden" button
  hardenScanId: string | null
  // For New Scan: target preselected from the Targets view
  newScanTargetId: string | null
  setView: (view: RedlineView) => void
  setSelectedScanId: (id: string | null) => void
  setSelectedTargetId: (id: string | null) => void
  setHardenScanId: (id: string | null) => void
  setNewScanTargetId: (id: string | null) => void
  // Convenience: navigate to scan report
  goToScanReport: (scanId: string) => void
  // Convenience: navigate to new scan with target preset
  goToNewScan: (targetId?: string | null) => void
  // Convenience: navigate to harden view with scan preset
  goToHarden: (scanId?: string | null) => void
  // Convenience: navigate to billing view (e.g. from an "Upgrade" CTA)
  goToBilling: () => void
}

export const useRedlineStore = create<RedlineState>((set) => ({
  currentView: 'dashboard',
  selectedScanId: null,
  selectedTargetId: null,
  hardenScanId: null,
  newScanTargetId: null,
  setView: (currentView) => set({ currentView }),
  setSelectedScanId: (selectedScanId) => set({ selectedScanId }),
  setSelectedTargetId: (selectedTargetId) => set({ selectedTargetId }),
  setHardenScanId: (hardenScanId) => set({ hardenScanId }),
  setNewScanTargetId: (newScanTargetId) => set({ newScanTargetId }),
  goToScanReport: (scanId) =>
    set({ currentView: 'scan-report', selectedScanId: scanId }),
  goToNewScan: (targetId = null) =>
    set({
      currentView: 'new-scan',
      newScanTargetId: targetId,
      selectedTargetId: targetId,
    }),
  goToHarden: (scanId = null) =>
    set({ currentView: 'harden', hardenScanId: scanId }),
  goToBilling: () => set({ currentView: 'billing' }),
}))
