import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import { useUIStore } from '../../store/ui'
import { Editor } from '../editor/Editor'

/* ── Note list ──────────────────────────────────────────────────── */
function NotesList({ onOpen }: { onOpen: (id: string) => void }) {
  const { notes, createNote } = useNotesStore()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return [...notes]
      .filter(n => !q || n.title.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [notes, search])

  const handleNew = useCallback(async () => {
    const id = await createNote()
    onOpen(id)
  }, [createNote, onOpen])

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <div className="mob-notes">
      <div className="mob-notes__header">
        <input
          className="mob-notes__search"
          placeholder="Buscar notas…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="mob-notes__new" onClick={handleNew} aria-label="Nova nota">+</button>
      </div>
      <div className="mob-notes__list">
        {filtered.map(note => (
          <button key={note.id} className="mob-notes__item" onClick={() => onOpen(note.id)}>
            <div className="mob-notes__item-title">{note.title || 'Sem título'}</div>
            <div className="mob-notes__item-meta">
              {note.folder && <span className="mob-notes__item-folder">{note.folder}</span>}
              <span className="mob-notes__item-date">{fmt(note.updatedAt)}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="mob-notes__empty">
            {search ? 'Nenhuma nota encontrada' : 'Nenhuma nota ainda — crie a primeira!'}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── Editor view ────────────────────────────────────────────────── */
function NoteEditor({ noteId, onBack }: { noteId: string; onBack: () => void }) {
  const { notes, renameNote } = useNotesStore()
  const { setMode } = useUIStore()
  const note = notes.find(n => n.id === noteId)

  // Título editável
  const [titleDraft, setTitleDraft] = useState(note?.title ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setTitleDraft(note?.title ?? '') }, [note?.id])

  const saveTitle = useCallback(() => {
    const t = titleDraft.trim() || 'Sem título'
    if (note && t !== note.title) renameNote(noteId, t)
    if (!titleDraft.trim()) setTitleDraft('Sem título')
  }, [titleDraft, note, noteId, renameNote])

  // Hardware back button — quando editor aberto, voltar = fechar editor
  useEffect(() => {
    window.history.pushState({ mobEditor: true }, '')
    const handler = (e: PopStateEvent) => {
      // Se o estado anterior não era o editor, interceptamos e voltamos à lista
      if (!(e.state as Record<string, unknown>)?.mobEditor) {
        onBack()
        window.history.pushState({ mobEditor: true }, '')
      }
    }
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('popstate', handler)
    }
  }, [onBack])

  return (
    <div className="mob-editor">
      <div className="mob-editor__header">
        {/* Voltar à lista */}
        <button className="mob-editor__back" onClick={onBack} aria-label="Voltar">←</button>

        {/* Título editável */}
        <input
          ref={inputRef}
          className="mob-editor__title-input"
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); saveTitle(); inputRef.current?.blur() }
          }}
          placeholder="Sem título"
        />

        {/* Ir para Home */}
        <button
          className="mob-editor__home-btn"
          onClick={() => setMode('home')}
          aria-label="Ir para Hoje"
        >
          ⌂
        </button>
      </div>

      <div className="mob-editor__body">
        <Editor noteId={noteId} />
      </div>
    </div>
  )
}

/* ── Root ───────────────────────────────────────────────────────── */
export function MobileNotesMode() {
  const [activeId, setActiveId] = useState<string | null>(null)

  if (activeId) {
    return <NoteEditor noteId={activeId} onBack={() => setActiveId(null)} />
  }
  return <NotesList onOpen={setActiveId} />
}
