'use client'

import { create } from 'zustand'

export type RedlineView =
  | 'home'
  | 'targets'
  | 'scans'
  | 'settings'

interface RedlineState {
  currentView: RedlineView
  selectedScanId: string | null
  selectedTargetId: string | null
  hardenScanId: string | null
  newScanTargetId: string | null
  showScanModal: boolean
  showHardenPanel: boolean
  setView: (view: RedlineView) => void
  setSelectedScanId: (id: string | null) => void
  setSelectedTargetId: (id: string | null) => void
  setHardenScanId: (id: string | null) => void
  setNewScanTargetId: (id: string | null) => void
  setShowScanModal: (show: boolean) => void
  setShowHardenPanel: (show: boolean) => void
  goToScanReport: (scanId: string) => void
  goToNewScan: (targetId?: string | null) => void
  goToHarden: (scanId?: string | null) => void
  goToBilling: () => void
}

export const useRedlineStore = create<RedlineState>((set) => ({
  currentView: 'home',
  selectedScanId: null,
  selectedTargetId: null,
  hardenScanId: null,
  newScanTargetId: null,
  showScanModal: false,
  showHardenPanel: false,
  setView: (currentView) => set({ currentView }),
  setSelectedScanId: (selectedScanId) => set({ selectedScanId }),
  setSelectedTargetId: (selectedTargetId) => set({ selectedTargetId }),
  setHardenScanId: (hardenScanId) => set({ hardenScanId }),
  setNewScanTargetId: (newScanTargetId) => set({ newScanTargetId }),
  setShowScanModal: (showScanModal) => set({ showScanModal }),
  setShowHardenPanel: (showHardenPanel) => set({ showHardenPanel }),
  goToScanReport: (scanId) =>
    set({ currentView: 'scans', selectedScanId: scanId, showHardenPanel: false }),
  goToNewScan: (targetId = null) =>
    set({
      currentView: 'targets',
      newScanTargetId: targetId,
      selectedTargetId: targetId,
      showScanModal: true,
    }),
  goToHarden: (scanId = null) =>
    set({ currentView: 'scans', hardenScanId: scanId, selectedScanId: scanId, showHardenPanel: true }),
  goToBilling: () => set({ currentView: 'settings' }),
}))
