import { useUIStore } from '../store/ui'
import { useNotesStore } from '../store/notes'
import { useAuthStore } from '../store/auth'
import { useSyncStore } from '../store/sync'

function SyncPill() {
  const { online, syncing, pendingCount, homeSyncing, homePending } = useSyncStore()
  const anySyncing = syncing || homeSyncing
  const anyPending = pendingCount > 0 || homePending

  if (online && !anySyncing && !anyPending) return null
  if (!online) return <span className="sync-pill sync-pill--offline">offline</span>
  if (anySyncing) return <span className="sync-pill sync-pill--syncing">sincronizando…</span>
  if (pendingCount > 0) return <span className="sync-pill sync-pill--pending">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
  return <span className="sync-pill sync-pill--pending">salvando…</span>
}

const MODES = [
  { id: 'home'     as const, label: 'Hoje' },
  { id: 'floating' as const, label: 'Floating' },
  { id: 'spatial'  as const, label: 'Spatial' },
  { id: 'graph'    as const, label: 'Graph' },
  { id: 'ai'       as const, label: 'AI' },
  { id: 'zen'      as const, label: 'Zen' },
]

export function AppBar() {
  const { mode, theme, setMode, setTheme, sidebarOpen, setSidebarOpen } = useUIStore()
  const createNote = useNotesStore(s => s.createNote)
  const { user, signOut } = useAuthStore()

  return (
    <header className="appbar">
      <div className="appbar__brand">
        <div className="appbar__mark">E</div>
        <div className="appbar__title">Excursus <em>· 2</em></div>
      </div>
      {mode === 'floating' && (
        <button
          className="appbar__hamburger"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Alternar painel de notas"
        >
          ☰
        </button>
      )}
      <div className="appbar__center">
        {MODES.map(m => (
          <button key={m.id}
            data-testid={`mode-${m.id}`}
            className={`appbar__tab ${mode === m.id ? 'appbar__tab--active' : ''}`}
            onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="appbar__right">
        <SyncPill />
        <button className="appbar__tab" onClick={() => createNote()} data-testid="new-note-btn">+ nota</button>
        <button className="appbar__tab" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☽' : '☀'}
        </button>
        <div className="appbar__avatar" title={user?.email ?? ''} onClick={signOut} style={{ cursor: 'pointer' }} />
      </div>
    </header>
  )
}
