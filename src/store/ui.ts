import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UIFont } from '../lib/fonts'

export type Mode     = 'home' | 'floating' | 'spatial' | 'graph' | 'ai' | 'zen' | 'calendar' | 'gantt'
export type Theme    = 'dark' | 'light'
export type Accent   = 'terracotta' | 'amber' | 'electric' | 'emerald'
export type UILanguage = 'pt' // | 'en'  ← to be added in the future
export type { UIFont }

interface UIStore {
  mode:        Mode
  theme:       Theme
  accent:      Accent
  fontScale:   number
  uiFont:      UIFont
  language:    UILanguage
  showHandles: boolean
  sidebarOpen: boolean

  setMode:        (mode: Mode) => void
  setTheme:       (theme: Theme) => void
  setAccent:      (accent: Accent) => void
  setFontScale:   (scale: number) => void
  setUIFont:      (font: UIFont) => void
  setLanguage:    (lang: UILanguage) => void
  setShowHandles: (show: boolean) => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      mode:        'floating',
      theme:       'dark',
      accent:      'terracotta',
      fontScale:   1.0,
      uiFont:      'inter',
      language:    'pt',
      showHandles: true,
      sidebarOpen: false,

      setMode:        (mode)        => set({ mode }),
      setTheme:       (theme)       => set({ theme }),
      setAccent:      (accent)      => set({ accent }),
      setFontScale:   (fontScale)   => set({ fontScale }),
      setUIFont:      (uiFont)      => set({ uiFont }),
      setLanguage:    (language)    => set({ language }),
      setShowHandles: (showHandles) => set({ showHandles }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    { name: 'excursus-ui' }
  )
)
