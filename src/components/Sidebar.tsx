import { useRef, useState } from 'react'
import { useNotesStore } from '../store/notes'
import { searchNotes } from '../lib/db'
import type { Note } from '../lib/db'

export function Sidebar() {
  const { notes, activeNoteId, setActiveNote, deleteNote, customFolders, createFolder, moveToFolder } = useNotesStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Note[] | null>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [folderDraft, setFolderDraft] = useState('')
  const [movingNoteId, setMovingNoteId] = useState<string | null>(null)
  const searchCounterRef = useRef(0)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults(null); return }
    const id = ++searchCounterRef.current
    try {
      const r = await searchNotes(q)
      if (id === searchCounterRef.current) setResults(r)
    } catch {
      if (id === searchCounterRef.current) setResults([])
    }
  }

  const displayed = results ?? notes
  const noteFolders = [...new Set(displayed.map(n => n.folder))]
  const allFolders = [...new Set([...noteFolders, ...customFolders])]

  const confirmFolder = () => {
    if (folderDraft.trim()) createFolder(folderDraft.trim())
    setFolderDraft('')
    setCreatingFolder(false)
  }

  const handleMoveToFolder = (noteId: string, folder: string) => {
    moveToFolder(noteId, folder)
    setMovingNoteId(null)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__search">
        <input value={query} onChange={e => handleSearch(e.target.value)} placeholder="Buscar notas..." />
      </div>
      <div className="sidebar__list">
        {allFolders.map(folder => (
          <div key={folder} className="sidebar__folder">
            <div className="sidebar__folder-name">{folder}</div>
            {displayed.filter(n => n.folder === folder).map(n => (
              <div key={n.id} className={`sidebar__note ${activeNoteId === n.id ? 'is-active' : ''}`}>
                <button className="sidebar__note-title" onClick={() => setActiveNote(n.id)}>
                  {n.title || 'Sem título'}
                </button>
                <div className="sidebar__note-actions">
                  <div className="sidebar__move-wrap">
                    <button
                      className="sidebar__note-move"
                      title="Mover para pasta"
                      onClick={e => { e.stopPropagation(); setMovingNoteId(movingNoteId === n.id ? null : n.id) }}
                    >⊞</button>
                    {movingNoteId === n.id && (
                      <div className="sidebar__folder-picker">
                        {allFolders.filter(f => f !== folder).map(f => (
                          <button key={f} className="sidebar__folder-picker-item"
                            onClick={() => handleMoveToFolder(n.id, f)}>{f}</button>
                        ))}
                        {allFolders.filter(f => f !== folder).length === 0 && (
                          <span className="sidebar__folder-picker-empty">Nenhuma outra pasta</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button className="sidebar__note-del" onClick={() => deleteNote(n.id)} title="Deletar">×</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="sidebar__footer">
        {creatingFolder ? (
          <div className="sidebar__new-folder-row">
            <input
              className="sidebar__new-folder-input"
              value={folderDraft}
              onChange={e => setFolderDraft(e.target.value)}
              placeholder="Nome da pasta..."
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') confirmFolder()
                if (e.key === 'Escape') { setCreatingFolder(false); setFolderDraft('') }
              }}
              onBlur={confirmFolder}
            />
          </div>
        ) : (
          <button className="sidebar__new-folder-btn" onClick={() => setCreatingFolder(true)}>
            + nova pasta
          </button>
        )}
      </div>
    </aside>
  )
}
