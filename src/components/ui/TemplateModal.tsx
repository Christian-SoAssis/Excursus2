import { useEffect } from 'react'
import { useNotesStore } from '../../store/notes'
import { useUIStore } from '../../store/ui'
import { NOTE_TEMPLATES } from '../../lib/noteTemplates'

interface Props {
  open:    boolean
  onClose: () => void
}

export function TemplateModal({ open, onClose }: Props) {
  const { createNote, setActiveNote, cacheContent, saveNoteContent } = useNotesStore()
  const { setMode } = useUIStore()

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const pick = async (templateId: string) => {
    const tpl = NOTE_TEMPLATES.find(t => t.id === templateId)
    if (!tpl) return

    const id = await createNote(tpl.title || 'Sem título', tpl.folder)
    cacheContent(id, tpl.content)
    saveNoteContent(id, tpl.title || 'Sem título', tpl.folder, tpl.content)
    setActiveNote(id)
    setMode('floating')
    onClose()
  }

  return (
    <div className="tplmodal__backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tplmodal" role="dialog" aria-modal aria-label="Escolher template">

        <div className="tplmodal__header">
          <span className="tplmodal__title">Novo de template</span>
          <button className="tplmodal__close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="tplmodal__grid">
          {NOTE_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              className="tplmodal__card"
              onClick={() => pick(tpl.id)}
            >
              <span className="tplmodal__card-icon">{tpl.icon}</span>
              <span className="tplmodal__card-label">{tpl.label}</span>
              <span className="tplmodal__card-desc">{tpl.desc}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
