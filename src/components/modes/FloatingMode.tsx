import { useState, useEffect, useRef, useMemo } from 'react'
import type { JSONContent } from '@tiptap/react'
import { useNotesStore } from '../../store/notes'
import { useUIStore } from '../../store/ui'
import { Editor } from '../editor/Editor'
import { Sidebar } from '../Sidebar'
import { jsonToMarkdown, downloadMarkdown, titleToFilename } from '../../lib/exportNote'

// ── Backlink helpers ─────────────────────────────────────────────

/** Recursively check whether a TipTap JSON tree contains a backlink to `noteId`. */
function hasBacklinkTo(noteId: string, node: JSONContent | undefined): boolean {
  if (!node) return false
  if (node.type === 'backlink' && node.attrs?.noteId === noteId) return true
  return (node.content ?? []).some(child => hasBacklinkTo(noteId, child))
}

// ── BacklinksPanel sub-component ─────────────────────────────────
interface BacklinksPanelProps { noteId: string }

function BacklinksPanel({ noteId }: BacklinksPanelProps) {
  const { notes, contentCache, setActiveNote } = useNotesStore()
  const { setMode }                            = useUIStore()
  const [expanded, setExpanded]                = useState(true)

  const backlinks = useMemo(
    () => notes.filter(n => n.id !== noteId && hasBacklinkTo(noteId, contentCache[n.id])),
    [noteId, notes, contentCache]
  )

  if (backlinks.length === 0) return null

  return (
    <div className="floating__backlinks">
      <button
        className="floating__backlinks__header"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className="floating__backlinks__chevron" aria-hidden>{expanded ? '▾' : '▸'}</span>
        <span>Mencionado em</span>
        <span className="floating__backlinks__count">{backlinks.length}</span>
      </button>

      {expanded && (
        <div className="floating__backlinks__list">
          {backlinks.map(n => (
            <button
              key={n.id}
              className="floating__backlinks__item"
              onClick={() => { setActiveNote(n.id); setMode('floating') }}
            >
              <span className="floating__backlinks__item-icon" aria-hidden>↩</span>
              <span className="floating__backlinks__item-title">{n.title}</span>
              <span className="floating__backlinks__item-folder">{n.folder}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────
export function FloatingMode() {
  const { notes, activeNoteId, renameNote, moveToFolder, customFolders, contentCache } = useNotesStore()
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
                <button
                  className="floating__export-btn"
                  title="Exportar como Markdown"
                  onClick={() => {
                    const doc      = contentCache[note.id]
                    const md       = jsonToMarkdown(note.title, doc)
                    const filename = titleToFilename(note.title) + '.md'
                    downloadMarkdown(filename, md)
                  }}
                >
                  ↓ .md
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
            <BacklinksPanel noteId={note.id} />
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
