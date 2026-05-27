import { useUIStore } from '../store/ui'
import { useNotesStore } from '../store/notes'
import { useAuthStore } from '../store/auth'
import { useSyncStore } from '../store/sync'
import { ExcursusLogo } from './ExcursusLogo'

function SyncPill() {
  const { online, syncing, pendingCount, homeSyncing, homePending, lastSyncedAt, failedIds } = useSyncStore()
  const anySyncing = syncing || homeSyncing
  const anyPending = pendingCount > 0 || homePending

  if (!online) return (
    <span className="sync-pill sync-pill--offline" title="Sem conexão — alterações salvas localmente">
      ⚡ offline · {pendingCount > 0 ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}` : 'local'}
    </span>
  )
  if (failedIds.length > 0) return (
    <span className="sync-pill sync-pill--error" title="Erro ao sincronizar — clique para tentar novamente">
      ⚠ sync error
    </span>
  )
  if (anySyncing) return <span className="sync-pill sync-pill--syncing">⟳ sincronizando…</span>
  if (anyPending) return <span className="sync-pill sync-pill--pending">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</span>
  if (lastSyncedAt) return null   // everything clean — stay silent
  return null
}

const MODES = [
  { id: 'home'     as const, label: 'Hoje'       },
  { id: 'calendar' as const, label: 'Calendário' },
  { id: 'gantt'    as const, label: 'Gantt'      },
  { id: 'floating' as const, label: 'Floating'   },
  { id: 'spatial'  as const, label: 'Spatial'    },
  { id: 'graph'    as const, label: 'Graph'      },
  { id: 'ai'       as const, label: 'AI'         },
  { id: 'zen'      as const, label: 'Zen'        },
]

export function AppBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { mode, setMode, sidebarOpen, setSidebarOpen } = useUIStore()
  const createNote = useNotesStore(s => s.createNote)
  const { user } = useAuthStore()

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const initials  = (user?.email ?? '?')[0].toUpperCase()

  return (
    <header className="appbar">
      <div className="appbar__brand">
        <ExcursusLogo size={28} bg className="appbar__logo" />
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
        <button
          className="appbar__avatar"
          title={`${user?.email ?? ''} · Configurações`}
          onClick={onOpenSettings}
          aria-label="Abrir configurações"
        >
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="appbar__avatar-img" />
            : <span className="appbar__avatar-initials">{initials}</span>
          }
        </button>
      </div>
    </header>
  )
}
