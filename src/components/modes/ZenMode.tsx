import { useState, useEffect, useRef } from 'react'
import { useNotesStore } from '../../store/notes'
import { Editor } from '../editor/Editor'

export function ZenMode() {
  const { notes, activeNoteId, setActiveNote, renameNote, moveToFolder, customFolders } = useNotesStore()
  const note = notes.find(n => n.id === activeNoteId) ?? notes[0] ?? null
  const [titleDraft, setTitleDraft] = useState(note?.title ?? '')
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const folderRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setTitleDraft(note?.title ?? '') }, [note?.id])

  useEffect(() => {
    if (!showFolderPicker) return
    const handler = (e: MouseEvent) => {
      if (folderRef.current && !folderRef.current.contains(e.target as Node))
        setShowFolderPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showFolderPicker])

  if (!note) return (
    <div className="zen">
      <div className="zen__empty">
        <div className="zen__empty-title">Nenhuma nota</div>
        <div className="zen__empty-hint">Crie uma nota em Floating para escrever aqui</div>
      </div>
    </div>
  )

  const handleTitleSave = () => {
    const title = titleDraft.trim() || 'Sem título'
    if (title !== note.title) renameNote(note.id, title)
    if (!titleDraft.trim()) setTitleDraft('Sem título')
  }

  const allFolders = [...new Set([...customFolders, ...notes.map(n => n.folder), note.folder])]

  return (
    <div className="zen">
      <div className="zen__body">
        <input
          className="zen__title-input"
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={handleTitleSave}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); handleTitleSave(); (e.target as HTMLInputElement).blur() }
          }}
          placeholder="Sem título"
        />
        <div className="zen__folder-row" ref={folderRef}>
          <button className="zen__folder-pill" onClick={() => setShowFolderPicker(v => !v)}>
            ⊞ {note.folder}
          </button>
          {showFolderPicker && (
            <div className="zen__folder-dropdown">
              {allFolders.map(f => (
                <button key={f} className="zen__folder-option"
                  data-active={f === note.folder || undefined}
                  onClick={() => { moveToFolder(note.id, f); setShowFolderPicker(false) }}>
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
        <Editor noteId={note.id} />
      </div>

      <div className="zen__footer">
        {notes.length > 1 && (
          <div className="zen__switcher">
            {notes.map(n => (
              <button key={n.id}
                className={`zen__switcher-dot ${n.id === note.id ? 'zen__switcher-dot--active' : ''}`}
                onClick={() => setActiveNote(n.id)}
                title={n.title}/>
            ))}
          </div>
        )}
        <span className="zen__sep">·</span>
        <span className="zen__wc">{note.wordCount} palavras</span>
      </div>
    </div>
  )
}
