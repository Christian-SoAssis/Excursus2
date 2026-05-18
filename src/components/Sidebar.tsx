import { useRef, useState } from 'react'
import { useNotesStore } from '../store/notes'
import { searchNotes } from '../lib/db'
import type { Note } from '../lib/db'

export function Sidebar() {
  const { notes, activeNoteId, setActiveNote, deleteNote } = useNotesStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[] | null>(null)
  const searchCounterRef = useRef(0)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    const id = ++searchCounterRef.current
    try {
      const r = await searchNotes(q)
      if (id === searchCounterRef.current) setResults(r)
    } catch {
      if (id === searchCounterRef.current) setResults([])
    }
  }

  const displayed = results ?? notes
  const folders = [...new Set(displayed.map(n => n.folder))]

  return (
    <aside className="sidebar">
      <div className="sidebar__search">
        <input value={query} onChange={e => handleSearch(e.target.value)} placeholder="Buscar notas..." />
      </div>
      <div className="sidebar__list">
        {folders.map(folder => (
          <div key={folder} className="sidebar__folder">
            <div className="sidebar__folder-name">{folder}</div>
            {displayed.filter(n => n.folder === folder).map(n => (
              <div key={n.id} className={`sidebar__note ${activeNoteId === n.id ? 'is-active' : ''}`}>
                <button className="sidebar__note-title" onClick={() => setActiveNote(n.id)}>
                  {n.title || 'Sem título'}
                </button>
                <button className="sidebar__note-del" onClick={() => deleteNote(n.id)} title="Deletar">×</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
