import { useUIStore } from '../store/ui'
import { useNotesStore } from '../store/notes'

const MODES = [
  { id: 'home'     as const, label: 'Hoje' },
  { id: 'floating' as const, label: 'Floating' },
  { id: 'spatial'  as const, label: 'Spatial' },
  { id: 'graph'    as const, label: 'Graph' },
  { id: 'ai'       as const, label: 'AI' },
  { id: 'zen'      as const, label: 'Zen' },
]

export function AppBar() {
  const { mode, theme, setMode, setTheme } = useUIStore()
  const createNote = useNotesStore(s => s.createNote)

  return (
    <header className="appbar">
      <div className="appbar__brand">
        <div className="appbar__mark">E</div>
        <div className="appbar__title">Excursus <em>· 2</em></div>
      </div>
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
        <button className="appbar__tab" onClick={() => createNote()}
          data-testid="new-note-btn">+ nota</button>
        <button className="appbar__tab" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☽' : '☀'}
        </button>
        <div className="appbar__avatar" />
      </div>
    </header>
  )
}
