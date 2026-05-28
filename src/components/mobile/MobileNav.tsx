import { useUIStore } from '../../store/ui'
import { useSyncStore } from '../../store/sync'

const TABS = [
  { id: 'home'     as const, icon: '⌂', label: 'Hoje'    },
  { id: 'floating' as const, icon: '✎', label: 'Notas'   },
  { id: 'graph'    as const, icon: '⬡', label: 'Grafo'   },
  { id: 'calendar' as const, icon: '◫', label: 'Agenda'  },
  { id: 'ai'       as const, icon: '◎', label: 'AI'      },
]

export function MobileNav({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { mode, setMode } = useUIStore()
  const { online, syncing } = useSyncStore()

  return (
    <nav className="mob-nav" role="navigation" aria-label="Navegação principal">
      {TABS.map(t => (
        <button
          key={t.id}
          className={`mob-nav__tab${mode === t.id ? ' mob-nav__tab--active' : ''}`}
          onClick={() => setMode(t.id)}
          aria-current={mode === t.id ? 'page' : undefined}
        >
          <span className="mob-nav__icon">{t.icon}</span>
          <span className="mob-nav__label">{t.label}</span>
        </button>
      ))}

      {/* Settings tab — also shows sync dot */}
      <button
        className="mob-nav__tab"
        onClick={onOpenSettings}
        aria-label="Configurações"
      >
        <span className="mob-nav__icon mob-nav__icon--settings">
          ⚙
          {(!online || syncing) && <span className="mob-nav__sync-dot" />}
        </span>
        <span className="mob-nav__label">Config</span>
      </button>
    </nav>
  )
}
