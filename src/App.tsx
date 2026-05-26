import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { handleOAuthPopupCallback } from './lib/googleAuth'
import { applyFont } from './lib/fonts'
import { AppBar } from './components/AppBar'
import { FloatingMode } from './components/modes/FloatingMode'
import { SpatialMode } from './components/modes/SpatialMode'
import { GraphMode } from './components/modes/GraphMode'
import { AiMode } from './components/modes/AiMode'
import { HomeMode } from './components/modes/HomeMode'
import { ZenMode } from './components/modes/ZenMode'
import { CalendarMode } from './components/modes/CalendarMode'
import { GanttMode } from './components/modes/GanttMode'
import { TweaksPanel } from './components/TweaksPanel'
import { SettingsModal } from './components/SettingsModal'
import { LandingPage } from './components/LandingPage'
import { ResetPasswordPage } from './components/auth/ResetPasswordPage'
import { TutorialOverlay } from './components/tutorial/TutorialOverlay'
import { SuggestionsPanel } from './components/ui/SuggestionsPanel'
import { MobileHeader } from './components/mobile/MobileHeader'
import { MobileNav } from './components/mobile/MobileNav'
import { MobileNotesMode } from './components/mobile/MobileNotesMode'
import { useUIStore } from './store/ui'
import { useTutorialStore } from './store/tutorial'
import { useNotesStore } from './store/notes'
import { useAuthStore } from './store/auth'
import { useSyncStore } from './store/sync'
import { usePlatform } from './hooks/usePlatform'
import { supabaseConfigured } from './lib/supabase'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { isMobile } = usePlatform()
  const { mode, setMode, theme, accent, fontScale, uiFont, showHandles } = useUIStore()
  const loadNotes = useNotesStore(s => s.loadNotes)
  const { user, loading, initialize, isRecovering } = useAuthStore()
  const { initNetworkWatcher, drainQueue } = useSyncStore()
  const { hasSeenOnboarding, openTutorial } = useTutorialStore()

  // Handle Google OAuth popup callback — must run before any render logic
  useEffect(() => { handleOAuthPopupCallback() }, [])

  useEffect(() => { initialize() }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => { applyFont(uiFont) }, [uiFont])

  useEffect(() => {
    document.documentElement.style.setProperty('font-size', `${fontScale * 16}px`)
  }, [fontScale])

  useEffect(() => {
    document.documentElement.style.setProperty('--handle-display', showHandles ? 'flex' : 'none')
  }, [showHandles])

  useEffect(() => {
    if (!user) return
    loadNotes()
    const cleanup = initNetworkWatcher()
    drainQueue()
    // Show tutorial on first login
    if (!hasSeenOnboarding) {
      const t = setTimeout(() => openTutorial(0), 900)
      return () => { clearTimeout(t); cleanup?.() }
    }
    return cleanup
  }, [user])

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
    if (mode === 'home')     return <HomeMode />
    if (mode === 'calendar') return <CalendarMode />
    if (mode === 'gantt')    return <GanttMode />
    if (mode === 'spatial')  return <SpatialMode />
    if (mode === 'graph')    return <GraphMode />
    if (mode === 'ai')       return <AiMode />
    if (mode === 'zen')      return <ZenMode />
    return <FloatingMode />
  }

  const renderMobileMode = () => {
    // Modes not supported on mobile — redirect to home
    if (mode === 'spatial' || mode === 'graph' || mode === 'zen') {
      setMode('home')
      return <HomeMode />
    }
    if (mode === 'home')     return <HomeMode />
    if (mode === 'calendar') return <CalendarMode />
    if (mode === 'ai')       return <AiMode />
    // 'floating' → dedicated mobile notes UI
    return <MobileNotesMode />
  }

  if (!supabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo"><span className="auth-logo__mark">E</span><span className="auth-logo__name">Excursus</span></div>
          <p className="auth-tagline" style={{ color: 'var(--accent-terracotta)', marginTop: '1.5rem' }}>
            Configure as variáveis de ambiente para continuar.
          </p>
          <div className="auth-error" style={{ marginTop: '1rem', lineHeight: 1.7 }}>
            Crie um arquivo <code>.env.local</code> na raiz do projeto com:<br />
            <code>VITE_SUPABASE_URL=https://seu-projeto.supabase.co</code><br />
            <code>VITE_SUPABASE_ANON_KEY=sua-chave-anonima</code>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="auth-loading"><span className="auth-loading__dot"/></div>
  }

  // User clicked the reset-password link in their email
  if (isRecovering) {
    return <ResetPasswordPage />
  }

  if (!user) {
    return (
      <>
        <LandingPage />
        <Toaster position="bottom-right" />
      </>
    )
  }

  if (isMobile) {
    return (
      <>
        <MobileHeader />
        <main className="mob-stage">{renderMobileMode()}</main>
        <MobileNav onOpenSettings={() => setSettingsOpen(true)} />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <Toaster position="top-center" />
      </>
    )
  }

  return (
    <>
      <AppBar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="stage">{renderMode()}</main>
      <TweaksPanel onOpen={() => setSettingsOpen(true)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <TutorialOverlay />
      {mode !== 'spatial' && <SuggestionsPanel />}
      <Toaster position="bottom-right" />
    </>
  )
}
