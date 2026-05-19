import { useState, useEffect, useRef } from 'react'
import { useNotesStore } from '../../store/notes'
import { Editor } from '../editor/Editor'
import { Sidebar } from '../Sidebar'

export function FloatingMode() {
  const { notes, activeNoteId, renameNote, moveToFolder, customFolders } = useNotesStore()
  const note = notes.find(n => n.id === activeNoteId)
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

  const handleTitleSave = () => {
    if (!note) return
    const title = titleDraft.trim() || 'Sem título'
    if (title !== note.title) renameNote(note.id, title)
    if (!titleDraft.trim()) setTitleDraft('Sem título')
  }

  const allFolders = note
    ? [...new Set([...customFolders, ...notes.map(n => n.folder), note.folder])]
    : []

  return (
    <div className="floating">
      <Sidebar />
      <div className="floating__doc">
        {note ? (
          <>
            <div className="floating__title-wrap">
              <input
                className="floating__title-input"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); handleTitleSave(); (e.target as HTMLInputElement).blur() }
                }}
                placeholder="Sem título"
              />
              <div className="floating__folder-row" ref={folderRef}>
                <button className="floating__folder-pill" onClick={() => setShowFolderPicker(v => !v)}>
                  ⊞ {note.folder}
                </button>
                {showFolderPicker && (
                  <div className="floating__folder-dropdown">
                    {allFolders.map(f => (
                      <button key={f} className="floating__folder-option"
                        data-active={f === note.folder || undefined}
                        onClick={() => { moveToFolder(note.id, f); setShowFolderPicker(false) }}>
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <Editor noteId={note.id} />
          </>
        ) : (
          <div className="floating__empty">
            <p>Selecione uma nota ou clique em <strong>+ nota</strong></p>
          </div>
        )}
      </div>
    </div>
  )
}
