import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AppBar } from './components/AppBar'
import { FloatingMode } from './components/modes/FloatingMode'
import { SpatialMode } from './components/modes/SpatialMode'
import { GraphMode } from './components/modes/GraphMode'
import { AiMode } from './components/modes/AiMode'
import { HomeMode } from './components/modes/HomeMode'
import { ZenMode } from './components/modes/ZenMode'
import { TweaksPanel } from './components/TweaksPanel'
import { useUIStore } from './store/ui'
import { useNotesStore } from './store/notes'

export function App() {
  const { mode, theme, accent, fontScale, showHandles } = useUIStore()
  const loadNotes = useNotesStore(s => s.loadNotes)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('font-size', `${fontScale * 16}px`)
  }, [fontScale])

  useEffect(() => {
    document.documentElement.style.setProperty('--handle-display', showHandles ? 'flex' : 'none')
  }, [showHandles])

  useEffect(() => { loadNotes() }, [])

  useEffect(() => {
    const ACCENT_MAP = {
      terracotta: { dark: { c: '255 157 119', e: '196 182 255' }, light: { c: '194 94 58', e: '107 92 255' } },
      amber:      { dark: { c: '240 189 139', e: '196 182 255' }, light: { c: '184 127 62', e: '107 92 255' } },
      electric:   { dark: { c: '196 182 255', e: '255 157 119' }, light: { c: '107 92 255', e: '194 94 58' } },
      emerald:    { dark: { c: '125 211 163', e: '196 182 255' }, light: { c: '47 125 86',  e: '107 92 255' } },
    }
    const a = ACCENT_MAP[accent] ?? ACCENT_MAP.terracotta
    const conf = a[theme === 'light' ? 'light' : 'dark']
    document.documentElement.style.setProperty('--accent-terracotta', `rgb(${conf.c})`)
    document.documentElement.style.setProperty('--accent-terracotta-rgb', conf.c)
    document.documentElement.style.setProperty('--accent-electric', `rgb(${conf.e})`)
    document.documentElement.style.setProperty('--accent-electric-rgb', conf.e)
  }, [accent, theme])

  const renderMode = () => {
    if (mode === 'home') return <HomeMode />
    if (mode === 'spatial') return <SpatialMode />
    if (mode === 'graph') return <GraphMode />
    if (mode === 'ai') return <AiMode />
    if (mode === 'zen') return <ZenMode />
    return <FloatingMode />
  }

  return (
    <>
      <AppBar />
      <main className="stage">{renderMode()}</main>
      <TweaksPanel />
      <Toaster position="bottom-right" />
    </>
  )
}
