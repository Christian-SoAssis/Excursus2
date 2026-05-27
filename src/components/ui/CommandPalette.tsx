import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import type { JSONContent } from '@tiptap/react'
import { useNotesStore } from '../../store/notes'
import { useUIStore } from '../../store/ui'
import { openOrCreateDailyNote } from '../../lib/dailyNote'

// ── Text extraction ──────────────────────────────────────────────
function extractText(node: JSONContent | undefined): string {
  if (!node) return ''
  if (node.text) return node.text
  if (node.content) return node.content.map(extractText).join(' ')
  return ''
}

// ── Types ────────────────────────────────────────────────────────
type NoteItem   = { kind: 'note';   id: string; title: string; folder: string; snippet?: string }
type ActionItem = { kind: 'action'; id: string; label: string; icon: string; onSelect: () => void }
type ResultItem = NoteItem | ActionItem

// ── Props ────────────────────────────────────────────────────────
interface Props {
  open:            boolean
  onClose:         () => void
  onOpenTemplates: () => void
}

// ── Component ────────────────────────────────────────────────────
export function CommandPalette({ open, onClose, onOpenTemplates }: Props) {
  const { notes, contentCache, createNote, setActiveNote } = useNotesStore()
  const { setMode }                                         = useUIStore()

  const [query,  setQuery]  = useState('')
  const [cursor, setCursor] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  // ── Reset & focus on open ──────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  // ── Action registry ───────────────────────────────────────────
  const actions = useMemo<ActionItem[]>(() => [
    {
      kind: 'action', id: 'new-note', label: 'Nova nota', icon: '+',
      onSelect: () => {
        createNote().then(id => { setActiveNote(id); setMode('floating') })
        onClose()
      },
    },
    {
      kind: 'action', id: 'daily-note', label: 'Nota de hoje', icon: '📅',
      onSelect: () => { openOrCreateDailyNote(); onClose() },
    },
    {
      kind: 'action', id: 'from-template', label: 'Novo de template…', icon: '⊟',
      onSelect: () => { onClose(); onOpenTemplates() },
    },
    { kind: 'action', id: 'm-home',    label: 'Ir para Hoje',     icon: '◎', onSelect: () => { setMode('home');     onClose() } },
    { kind: 'action', id: 'm-float',   label: 'Ir para Floating',  icon: '☰', onSelect: () => { setMode('floating'); onClose() } },
    { kind: 'action', id: 'm-spatial', label: 'Ir para Spatial',   icon: '⊞', onSelect: () => { setMode('spatial'); onClose() } },
    { kind: 'action', id: 'm-graph',   label: 'Ir para Grafo',     icon: '◉', onSelect: () => { setMode('graph');   onClose() } },
    { kind: 'action', id: 'm-ai',      label: 'Ir para IA',        icon: '✦', onSelect: () => { setMode('ai');      onClose() } },
  ], [createNote, setActiveNote, setMode, onClose, onOpenTemplates])

  // ── Results ───────────────────────────────────────────────────
  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase()

    if (!q) {
      // Default: show top actions only
      return actions.slice(0, 6)
    }

    // Notes — title match first, then body match
    const noteResults: NoteItem[] = []
    for (const note of notes) {
      const titleMatch = note.title.toLowerCase().includes(q)
      const cached     = contentCache[note.id]
      const bodyText   = cached ? extractText(cached).toLowerCase() : ''
      const bodyMatch  = !titleMatch && bodyText.includes(q)

      if (!titleMatch && !bodyMatch) continue

      let snippet: string | undefined
      if (bodyMatch) {
        const idx   = bodyText.indexOf(q)
        const start = Math.max(0, idx - 35)
        const end   = Math.min(bodyText.length, idx + q.length + 55)
        snippet = (start > 0 ? '…' : '') + bodyText.slice(start, end).trim() + (end < bodyText.length ? '…' : '')
      }

      noteResults.push({ kind: 'note', id: note.id, title: note.title, folder: note.folder, snippet })
    }

    // Sort: title matches before body-only matches
    noteResults.sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(q)
      const bTitle = b.title.toLowerCase().includes(q)
      if (aTitle && !bTitle) return -1
      if (!aTitle && bTitle) return 1
      return 0
    })

    const filteredActions = actions.filter(a => a.label.toLowerCase().includes(q))

    return [...noteResults.slice(0, 8), ...filteredActions]
  }, [query, notes, contentCache, actions])

  useEffect(() => { setCursor(0) }, [query])

  // ── Execute item ──────────────────────────────────────────────
  const execute = useCallback((item: ResultItem) => {
    if (item.kind === 'action') {
      item.onSelect()
    } else {
      setActiveNote(item.id)
      setMode('floating')
      onClose()
    }
  }, [setActiveNote, setMode, onClose])

  // ── Keyboard navigation ───────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor(c => Math.min(c + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor(c => Math.max(c - 1, 0))
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = results[cursor]
        if (item) execute(item)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, cursor, results, execute, onClose])

  // ── Auto-scroll active row ────────────────────────────────────
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  return (
    <div className="cmdpal__backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cmdpal" role="dialog" aria-modal aria-label="Paleta de comandos">

        {/* Search input */}
        <div className="cmdpal__search">
          <span className="cmdpal__search-icon" aria-hidden>⌕</span>
          <input
            ref={inputRef}
            className="cmdpal__input"
            placeholder="Buscar notas ou ações…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button className="cmdpal__clear" onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Limpar">
              ✕
            </button>
          )}
        </div>

        {/* Results list */}
        <div className="cmdpal__list" ref={listRef} role="listbox">
          {results.length === 0 && (
            <div className="cmdpal__empty">Nenhum resultado para "{query}"</div>
          )}
          {results.map((item, i) => (
            <button
              key={item.id}
              data-idx={i}
              role="option"
              aria-selected={i === cursor}
              className={`cmdpal__item cmdpal__item--${item.kind}${i === cursor ? ' cmdpal__item--active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => execute(item)}
            >
              {item.kind === 'note' ? (
                <>
                  <span className="cmdpal__item-icon" aria-hidden>☰</span>
                  <span className="cmdpal__item-body">
                    <span className="cmdpal__item-title">{item.title}</span>
                    {item.snippet && (
                      <span className="cmdpal__item-snippet">{item.snippet}</span>
                    )}
                  </span>
                  <span className="cmdpal__item-badge">{item.folder}</span>
                </>
              ) : (
                <>
                  <span className="cmdpal__item-icon" aria-hidden>{item.icon}</span>
                  <span className="cmdpal__item-body">
                    <span className="cmdpal__item-title">{item.label}</span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Footer hints */}
        <div className="cmdpal__footer" aria-hidden>
          <span><kbd>↑↓</kbd> navegar</span>
          <span><kbd>↵</kbd> abrir</span>
          <span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
