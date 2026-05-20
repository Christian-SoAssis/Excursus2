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
import { LoginPage } from './components/auth/LoginPage'
import { useUIStore } from './store/ui'
import { useNotesStore } from './store/notes'
import { useAuthStore } from './store/auth'
import { useSyncStore } from './store/sync'
import { supabaseConfigured } from './lib/supabase'

export function App() {
  const { mode, theme, accent, fontScale, showHandles } = useUIStore()
  const loadNotes = useNotesStore(s => s.loadNotes)
  const { user, loading, initialize } = useAuthStore()
  const { initNetworkWatcher, drainQueue } = useSyncStore()

  useEffect(() => { initialize() }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

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
    if (mode === 'home') return <HomeMode />
    if (mode === 'spatial') return <SpatialMode />
    if (mode === 'graph') return <GraphMode />
    if (mode === 'ai') return <AiMode />
    if (mode === 'zen') return <ZenMode />
    return <FloatingMode />
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

  if (!user) {
    return (
      <>
        <LoginPage />
        <Toaster position="bottom-right" />
      </>
    )
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
