import { useEffect, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import { Editor } from '../editor/Editor'
import { Sidebar } from '../Sidebar'

const PROMPT_CHIPS = [
  '· resumir',
  '· lacunas',
  '· perguntas',
  '· conectar',
  '· reescrever',
]

const MARGIN_NOTES = [
  { tag: 'fortalecer', body: 'Esta abertura define o sistema, mas falta um exemplo concreto.' },
  { tag: 'fato', body: 'Luhmann escreveu ~90.000 fichas ao longo de 30 anos.' },
  { tag: 'expandir', body: 'Posso derivar a versão ponderada por recência. Aceita inserir como sub-bloco?' },
  { tag: 'conexão', body: 'Este trecho ecoa Andy Matuschak. Quer linkar [[Evergreen Notes]]?' },
]

interface SelectionAction {
  x: number
  y: number
  text: string
}

export function AiMode() {
  const { notes, activeNoteId } = useNotesStore()
  const note = notes.find(n => n.id === activeNoteId)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [actions, setActions] = useState<SelectionAction | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const update = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) { setActions(null); return }
      const node = sel.getRangeAt(0).startContainer.parentElement
      if (!node?.closest('.ai-mode__doc')) { setActions(null); return }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      setActions({ x: rect.left + rect.width / 2, y: rect.top, text: sel.toString() })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  const runPrompt = () => {
    if (!prompt.trim()) return
    setBusy(true)
    setTimeout(() => { setBusy(false); setPrompt('') }, 900)
  }

  return (
    <div className="ai-mode">
      <Sidebar />

      <div className="ai-mode__body">
        <div className="ai-mode__row">
          {/* Main editor column */}
          <div className="ai-mode__doc doc">
            {note ? (
              <Editor noteId={note.id} />
            ) : (
              <div style={{ color: 'var(--text-faint)', padding: '40px 0' }}>
                Selecione uma nota no painel lateral
              </div>
            )}
          </div>

          {/* Margin notes column */}
          <div className="ai-mode__margin">
            {MARGIN_NOTES.map((n, i) => (
              <div key={i} className="ai-note" style={{ marginTop: i === 0 ? 48 : 96 }}>
                <div className="ai-note__tag">
                  <span className="ai-note__tag-dot" />
                  {n.tag}
                </div>
                <div>{n.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt bar */}
      <div className="ai-mode__promptbar">
        <div className="ai-mode__prompt-input">
          <svg className="ai-mode__prompt-spark" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3L13.5 9H19.5L14.5 13L16.5 19L12 15L7.5 19L9.5 13L4.5 9H10.5Z"/>
          </svg>
          <input
            ref={inputRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runPrompt()}
            placeholder='Pergunte ou peça ao documento — "resuma em 3 linhas", "expanda esta seção"...'
          />
          <button className="ai-mode__prompt-send" onClick={runPrompt} disabled={busy}>
            {busy ? '…' : 'enviar →'}
          </button>
        </div>
        <div className="ai-mode__prompt-chips">
          {PROMPT_CHIPS.map(chip => (
            <button key={chip} className="ai-mode__prompt-chip"
              onClick={() => { setPrompt(chip.replace('· ', '')); inputRef.current?.focus() }}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Selection AI actions */}
      {actions && (
        <div className="ai-actions" style={{ left: actions.x, top: actions.y }}>
          <div className="ai-actions__head">
            AI · {actions.text.length} char
          </div>
          <button>reescrever</button>
          <button>resumir</button>
          <button>expandir</button>
          <button>mudar tom</button>
        </div>
      )}
    </div>
  )
}
