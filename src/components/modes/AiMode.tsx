import { useEffect, useRef, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { toast } from 'sonner'
import { useNotesStore } from '../../store/notes'
import { useAiStore } from '../../store/ai'
import {
  runAI, saveAiKeys, fetchAiKeyStatus,
  AI_MODELS, modelProvider,
} from '../../lib/ai-providers'
import type { AICallConfig } from '../../lib/ai-providers'
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

interface SelectionAction { x: number; y: number; text: string }

/* ── Setup screen ─────────────────────────────────────────────────── */
function SetupScreen({ onConfigured }: { onConfigured: () => void }) {
  const { selectedModel, openaiModel, setOpenaiModel, customBaseUrl, setCustomBaseUrl, customModel, setCustomModel, setKeyStatus } = useAiStore()
  const meta      = AI_MODELS.find(m => m.id === selectedModel)
  const provider  = meta?.provider ?? 'google'

  const [key, setKey]         = useState('')
  const [oaiModel, setOaiMdl] = useState(openaiModel || 'gpt-4o-mini')
  const [cusUrl, setCusUrl]   = useState(customBaseUrl)
  const [cusMdl, setCusMdl]   = useState(customModel)
  const [saving, setSaving]   = useState(false)

  const canSave =
    (provider === 'google' && !!key.trim()) ||
    (provider === 'openai' && !!key.trim()) ||
    (provider === 'custom' && !!(key.trim() && cusUrl.trim() && cusMdl.trim()))

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      // Persiste config não-sensível no store
      if (provider === 'openai') setOpenaiModel(oaiModel.trim())
      if (provider === 'custom') { setCustomBaseUrl(cusUrl.trim()); setCustomModel(cusMdl.trim()) }

      // Envia chave à Edge Function (nunca passa pelo localStorage)
      await saveAiKeys({
        ...(provider === 'google' && { geminiKey: key.trim() }),
        ...(provider === 'openai' && { openaiKey: key.trim() }),
        ...(provider === 'custom' && { customKey: key.trim() }),
      })

      // Atualiza status booleano no store (não a chave em si)
      setKeyStatus({ [provider]: true } as Record<string, boolean>)
      onConfigured()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar chave')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ai-mode__setup-wrap">
      <div className="ai-mode__setup">
        <p className="ai-mode__setup-title">Configure o {meta?.label ?? 'modelo de IA'}</p>

        {provider === 'google' && (
          <>
            <p className="ai-mode__setup-desc">
              Insira sua chave do <strong>Google AI Studio</strong> para usar o{' '}
              <strong>{meta?.label}</strong>. Chaves do AI Studio são gratuitas.
              A chave é armazenada de forma segura no servidor — nunca no browser.
            </p>
            <div className="ai-mode__setup-row">
              <input className="twk-field" type="password" value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSave) save() }}
                placeholder="AIza…" autoFocus />
              <button className="ai-mode__prompt-send"
                style={{ borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: '13px' }}
                onClick={save} disabled={!canSave || saving}>
                {saving ? '…' : 'Salvar'}
              </button>
            </div>
            <a className="ai-mode__setup-link" href="https://aistudio.google.com/apikey"
              target="_blank" rel="noopener noreferrer">
              Obter chave gratuita em aistudio.google.com →
            </a>
          </>
        )}

        {provider === 'openai' && (
          <>
            <p className="ai-mode__setup-desc">
              Insira sua <strong>OpenAI API key</strong> e o modelo desejado.
              A chave é armazenada de forma segura no servidor.
            </p>
            <div className="ai-mode__setup-col">
              <input className="twk-field" type="text" value={oaiModel}
                onChange={e => setOaiMdl(e.target.value)}
                placeholder="gpt-4o-mini" />
              <input className="twk-field" type="password" value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSave) save() }}
                placeholder="sk-…" autoFocus />
              <button className="ai-mode__prompt-send"
                style={{ borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: '13px', alignSelf: 'flex-start' }}
                onClick={save} disabled={!canSave || saving}>
                {saving ? '…' : 'Salvar'}
              </button>
            </div>
            <a className="ai-mode__setup-link" href="https://platform.openai.com/api-keys"
              target="_blank" rel="noopener noreferrer">
              Criar chave em platform.openai.com →
            </a>
          </>
        )}

        {provider === 'custom' && (
          <>
            <p className="ai-mode__setup-desc">
              Configure qualquer API compatível com OpenAI — Groq, Mistral, Together AI…
              A chave é armazenada de forma segura no servidor.
            </p>
            <div className="ai-mode__setup-col">
              <input className="twk-field" type="text" value={cusUrl}
                onChange={e => setCusUrl(e.target.value)}
                placeholder="https://api.groq.com/openai/v1" autoFocus />
              <input className="twk-field" type="text" value={cusMdl}
                onChange={e => setCusMdl(e.target.value)}
                placeholder="llama-3.3-70b-versatile" />
              <input className="twk-field" type="password" value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canSave) save() }}
                placeholder="API key…" />
              <button className="ai-mode__prompt-send"
                style={{ borderRadius: 'var(--radius-sm)', padding: '7px 16px', fontSize: '13px', alignSelf: 'flex-start' }}
                onClick={save} disabled={!canSave || saving}>
                {saving ? '…' : 'Salvar'}
              </button>
            </div>
          </>
        )}

        <p className="ai-mode__setup-hint">
          Troque o modelo em <strong>Configurações → Inteligência Artificial</strong>.
        </p>
      </div>
    </div>
  )
}

/* ── Main mode ────────────────────────────────────────────────────── */
export function AiMode() {
  const { notes, activeNoteId, contentCache } = useNotesStore()
  const note = notes.find(n => n.id === activeNoteId)

  const {
    selectedModel, openaiModel, customBaseUrl, customModel,
    keyStatus, keyStatusLoaded, setKeyStatus, setKeyStatusLoaded,
    annotations, addAnnotation, removeAnnotation, clearAnnotations,
    loading, setLoading,
  } = useAiStore()

  const cfg: AICallConfig = { selectedModel, openaiModel, customBaseUrl, customModel }

  const [prompt,       setPrompt]  = useState('')
  const [actions,      setActions] = useState<SelectionAction | null>(null)
  const [configured,   setConfigured] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Determina se o provedor atual tem chave configurada
  const provider = modelProvider(selectedModel)
  const hasKey   = keyStatus[provider]

  // Verifica o status das chaves no servidor uma vez por sessão
  useEffect(() => {
    if (keyStatusLoaded) return
    fetchAiKeyStatus()
      .then(status => {
        setKeyStatus(status)
        setKeyStatusLoaded(true)
      })
      .catch(() => {
        // Se falhar, confia no cache do localStorage (keyStatus atual)
        setKeyStatusLoaded(true)
      })
  }, [])

  // Sincroniza `configured` com o status real
  useEffect(() => {
    setConfigured(hasKey)
  }, [hasKey])

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

  const run = async (system: string, user: string, tag: string) => {
    setLoading(true)
    try {
      const result = await runAI(cfg, system, user)
      addAnnotation(tag, result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao chamar a IA'
      toast.error(msg)
      // Se o erro indica chave ausente, força re-configuração
      if (msg.toLowerCase().includes('não configurada') || msg.toLowerCase().includes('not configured')) {
        setKeyStatus({ [provider]: false } as Record<string, boolean>)
        setConfigured(false)
      }
    } finally {
      setLoading(false)
    }
  }

  const runPrompt = async () => {
    if (!prompt.trim() || loading) return
    const noteText = note ? extractText(contentCache[note.id] ?? { type: 'doc' }) : ''
    const userMsg  = noteText ? `Nota:\n${noteText}\n\n---\nPedido: ${prompt}` : prompt
    await run(SYSTEM_PROMPT, userMsg, 'resposta')
    setPrompt('')
  }

  const runSelectionAction = async (action: 'reescrever' | 'resumir' | 'expandir' | 'tom') => {
    if (!actions?.text || loading) return
    const selectedText = actions.text
    setActions(null)
    const config: Record<typeof action, { msg: string; tag: string }> = {
      reescrever: { msg: `Reescreva o texto a seguir de forma mais clara e concisa:\n\n${selectedText}`, tag: 'reescrita' },
      resumir:    { msg: `Resuma em 2–3 frases:\n\n${selectedText}`,                                    tag: 'resumo'    },
      expandir:   { msg: `Expanda esta ideia com mais detalhes e exemplos:\n\n${selectedText}`,         tag: 'expansão'  },
      tom:        { msg: `Reescreva em tom mais formal e objetivo:\n\n${selectedText}`,                 tag: 'tom'       },
    }
    const { msg, tag } = config[action]
    await run(SYSTEM_PROMPT, msg, tag)
  }

  const activeModelMeta = AI_MODELS.find(m => m.id === selectedModel)

  // Aguarda verificação inicial antes de mostrar setup ou modo
  if (!keyStatusLoaded) {
    return (
      <div className="ai-mode">
        <Sidebar />
        <div className="ai-mode__setup-wrap">
          <div className="ai-mode__setup">
            <p className="ai-mode__setup-desc" style={{ color: 'var(--text-faint)' }}>Verificando configuração…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="ai-mode">
        <Sidebar />
        <SetupScreen onConfigured={() => setConfigured(true)} />
      </div>
    )
  }

  return (
    <div className="ai-mode">
      <Sidebar />

      <div className="ai-mode__body">
        <div className="ai-mode__row">
          <div className="ai-mode__doc doc">
            {note ? <Editor noteId={note.id} /> : (
              <div style={{ color: 'var(--text-faint)', padding: '40px 0' }}>
                Selecione uma nota no painel lateral
              </div>
            )}
          </div>

          <div className="ai-mode__margin">
            <div className="ai-mode__margin-header">
              <span>IA · {activeModelMeta?.label ?? selectedModel} · {annotations.length}</span>
              {annotations.length > 0 && (
                <button className="ai-mode__margin-clear" onClick={clearAnnotations}>Limpar</button>
              )}
            </div>

            {loading && <div className="ai-note--loading">gerando…</div>}

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

      <div className="ai-mode__promptbar">
        <div className="ai-mode__prompt-input">
          <svg className="ai-mode__prompt-spark" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3L13.5 9H19.5L14.5 13L16.5 19L12 15L7.5 19L9.5 13L4.5 9H10.5Z"/>
          </svg>
          <input ref={inputRef} value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runPrompt()}
            placeholder='Pergunte ou peça ao documento — "resuma em 3 linhas", "expanda esta seção"...'
            disabled={loading} />
          <button className="ai-mode__prompt-send"
            onClick={runPrompt} disabled={loading || !prompt.trim()}>
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

      {actions && (
        <div className="ai-actions" style={{ left: actions.x, top: actions.y }}>
          <div className="ai-actions__head">IA · {actions.text.length} char</div>
          <button onClick={() => runSelectionAction('reescrever')}>reescrever</button>
          <button onClick={() => runSelectionAction('resumir')}>resumir</button>
          <button onClick={() => runSelectionAction('expandir')}>expandir</button>
          <button onClick={() => runSelectionAction('tom')}>mudar tom</button>
        </div>
      )}
    </div>
  )
}
