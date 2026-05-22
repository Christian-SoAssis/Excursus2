import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Mode = 'home' | 'floating' | 'spatial' | 'graph' | 'ai' | 'zen' | 'calendar'
export type Theme = 'dark' | 'light'
export type Accent = 'terracotta' | 'amber' | 'electric' | 'emerald'

interface UIStore {
  mode: Mode
  theme: Theme
  accent: Accent
  fontScale: number
  showHandles: boolean
  sidebarOpen: boolean
  setMode: (mode: Mode) => void
  setTheme: (theme: Theme) => void
  setAccent: (accent: Accent) => void
  setFontScale: (scale: number) => void
  setShowHandles: (show: boolean) => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      mode: 'floating',
      theme: 'dark',
      accent: 'terracotta',
      fontScale: 1.0,
      showHandles: true,
      sidebarOpen: false,
      setMode: (mode) => set({ mode }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setFontScale: (fontScale) => set({ fontScale }),
      setShowHandles: (showHandles) => set({ showHandles }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    { name: 'excursus-ui' }
  )
)
