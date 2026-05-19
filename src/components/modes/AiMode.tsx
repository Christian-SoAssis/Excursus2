import { useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { toast } from 'sonner'
import { useNotesStore } from '../../store/notes'
import { useAiStore } from '../../store/ai'
import { geminiGenerate } from '../../lib/gemini'
import { Editor } from '../editor/Editor'
import { Sidebar } from '../Sidebar'

const SYSTEM_PROMPT =
  'Você é um assistente de escrita integrado a um app de notas chamado Excursus. ' +
  'Responda sempre no mesmo idioma do texto da nota. ' +
  'Seja conciso e direto. Não use formatação markdown.'

const PROMPT_CHIPS = [
  '· resumir',
  '· lacunas',
  '· perguntas',
  '· conectar',
  '· reescrever',
]

function extractText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(extractText).join(' ')
}

interface SelectionAction {
  x: number
  y: number
  text: string
}

export function AiMode() {
  const { notes, activeNoteId, contentCache } = useNotesStore()
  const note = notes.find(n => n.id === activeNoteId)

  const {
    apiKey, setApiKey,
    annotations, addAnnotation, removeAnnotation, clearAnnotations,
    loading, setLoading,
  } = useAiStore()

  const [prompt, setPrompt] = useState('')
  const [actions, setActions] = useState<SelectionAction | null>(null)
  const [setupKey, setSetupKey] = useState('')
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

  const runPrompt = async () => {
    if (!prompt.trim() || !apiKey || loading) return
    const noteText = note ? extractText(contentCache[note.id] ?? { type: 'doc' }) : ''
    const userMsg = noteText
      ? `Nota:\n${noteText}\n\n---\nPedido: ${prompt}`
      : prompt
    setLoading(true)
    try {
      const result = await geminiGenerate(apiKey, SYSTEM_PROMPT, userMsg)
      addAnnotation('resposta', result)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao chamar Gemini')
    } finally {
      setLoading(false)
      setPrompt('')
    }
  }

  const runSelectionAction = async (action: 'reescrever' | 'resumir' | 'expandir' | 'tom') => {
    if (!actions?.text || !apiKey || loading) return
    const selectedText = actions.text
    setActions(null)

    const config: Record<typeof action, { msg: string; tag: string }> = {
      reescrever: { msg: `Reescreva o texto a seguir de forma mais clara e concisa:\n\n${selectedText}`, tag: 'reescrita' },
      resumir:    { msg: `Resuma em 2–3 frases:\n\n${selectedText}`, tag: 'resumo' },
      expandir:   { msg: `Expanda esta ideia com mais detalhes e exemplos:\n\n${selectedText}`, tag: 'expansão' },
      tom:        { msg: `Reescreva em tom mais formal e objetivo:\n\n${selectedText}`, tag: 'tom' },
    }

    const { msg, tag } = config[action]
    setLoading(true)
    try {
      const result = await geminiGenerate(apiKey, SYSTEM_PROMPT, msg)
      addAnnotation(tag, result)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao chamar Gemini')
    } finally {
      setLoading(false)
    }
  }

  // Setup screen when no API key configured
  if (!apiKey) {
    return (
      <div className="ai-mode">
        <Sidebar />
        <div className="ai-mode__setup-wrap">
          <div className="ai-mode__setup">
            <p className="ai-mode__setup-title">Configure o Gemini</p>
            <p className="ai-mode__setup-desc">
              Insira sua chave de API do Google Gemini para ativar o assistente de escrita.
              O modelo <strong>gemini-2.0-flash</strong> é gratuito e não requer cartão de crédito.
            </p>
            <div className="ai-mode__setup-row">
              <input
                className="twk-field"
                type="password"
                value={setupKey}
                onChange={e => setSetupKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && setupKey.trim()) setApiKey(setupKey.trim()) }}
                placeholder="AIza..."
                autoFocus
              />
              <button
                className="ai-mode__prompt-send"
                style={{ borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: '13px' }}
                onClick={() => { if (setupKey.trim()) setApiKey(setupKey.trim()) }}
              >
                Salvar
              </button>
            </div>
            <span className="ai-mode__setup-link">
              Obtenha sua chave gratuita em aistudio.google.com
            </span>
          </div>
        </div>
      </div>
    )
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

          {/* Margin annotations column */}
          <div className="ai-mode__margin">
            <div className="ai-mode__margin-header">
              <span>IA · {annotations.length}</span>
              {annotations.length > 0 && (
                <button className="ai-mode__margin-clear" onClick={clearAnnotations}>
                  Limpar
                </button>
              )}
            </div>

            {loading && (
              <div className="ai-note--loading">gerando…</div>
            )}

            {annotations.length === 0 && !loading && (
              <div className="ai-mode__margin-empty">
                Pergunte ou selecione texto<br />para ver sugestões
              </div>
            )}

            {annotations.map(a => (
              <div key={a.id} className="ai-note" style={{ marginBottom: 12 }}>
                <button className="ai-note__dismiss" onClick={() => removeAnnotation(a.id)}>×</button>
                <div className="ai-note__tag">
                  <span className="ai-note__tag-dot" />
                  {a.tag}
                </div>
                <div>{a.body}</div>
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
            disabled={loading}
          />
          <button className="ai-mode__prompt-send" onClick={runPrompt} disabled={loading || !prompt.trim()}>
            {loading ? '…' : 'enviar →'}
          </button>
        </div>
        <div className="ai-mode__prompt-chips">
          {PROMPT_CHIPS.map(chip => (
            <button key={chip} className="ai-mode__prompt-chip"
              onClick={() => { setPrompt(chip.replace('· ', '')); inputRef.current?.focus() }}
              disabled={loading}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Selection AI actions */}
      {actions && (
        <div className="ai-actions" style={{ left: actions.x, top: actions.y }}>
          <div className="ai-actions__head">
            IA · {actions.text.length} char
          </div>
          <button onClick={() => runSelectionAction('reescrever')}>reescrever</button>
          <button onClick={() => runSelectionAction('resumir')}>resumir</button>
          <button onClick={() => runSelectionAction('expandir')}>expandir</button>
          <button onClick={() => runSelectionAction('tom')}>mudar tom</button>
        </div>
      )}
    </div>
  )
}
