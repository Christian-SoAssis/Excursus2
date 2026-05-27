import { useEffect, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import { useUIStore } from '../../store/ui'

interface Props {
  open: boolean
  onClose: () => void
}

export function QuickCaptureModal({ open, onClose }: Props) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { createNote, cacheContent, saveNoteContent, setActiveNote } = useNotesStore()
  const { setMode } = useUIStore()

  useEffect(() => {
    if (open) {
      setText('')
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const save = async () => {
    const content = text.trim()
    if (!content || saving) return
    setSaving(true)
    try {
      const title = content.split('\n')[0].slice(0, 80) || 'Captura rápida'
      const id    = await createNote(title, 'inbox')
      const doc   = {
        type: 'doc' as const,
        content: content.split('\n').map(line => ({
          type: 'paragraph' as const,
          ...(line ? { content: [{ type: 'text' as const, text: line }] } : {}),
        })),
      }
      cacheContent(id, doc)
      await saveNoteContent(id, title, 'inbox', doc)
      setActiveNote(id)
      setMode('floating')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="qcap__backdrop" onClick={onClose}>
      <div className="qcap__panel" onClick={e => e.stopPropagation()}>
        <div className="qcap__header">
          <span className="qcap__title">Captura rápida</span>
          <span className="qcap__badge">→ inbox</span>
        </div>
        <textarea
          ref={inputRef}
          className="qcap__input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save() }
          }}
          placeholder="Ideia, tarefa ou nota rápida…"
          rows={4}
        />
        <div className="qcap__footer">
          <span className="qcap__hint">Ctrl+Enter para salvar · Esc para fechar</span>
          <button className="qcap__save" onClick={save} disabled={!text.trim() || saving}>
            {saving ? '…' : 'Salvar →'}
          </button>
        </div>
      </div>
    </div>
  )
}
