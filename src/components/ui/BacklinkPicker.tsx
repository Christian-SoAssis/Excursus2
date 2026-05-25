import { useEffect, useMemo, useState } from 'react'
import { useNotesStore } from '../../store/notes'

interface SuggestionHint {
  id:    string
  title: string
  score: number
}

interface BacklinkPickerProps {
  pos:         { x: number; y: number }
  query:       string
  suggestions?: SuggestionHint[]
  onPick:      (note: { id: string; title: string }) => void
  onClose:     () => void
}

export function BacklinkPicker({ pos, query, suggestions = [], onPick, onClose }: BacklinkPickerProps) {
  const notes = useNotesStore(s => s.notes)
  const [sel, setSel] = useState(0)

  // Only show suggested section when the query is still empty (user just typed [[)
  const showSuggestions = query === '' && suggestions.length > 0

  const filteredNotes = useMemo(() => {
    const q    = query.toLowerCase()
    const base = notes.filter(n => !q || n.title.toLowerCase().includes(q)).slice(0, 7)
    if (showSuggestions) {
      // deduplicate — don't show a note already in the suggestions list
      const sugIds = new Set(suggestions.map(s => s.id))
      return base.filter(n => !sugIds.has(n.id))
    }
    return base
  }, [notes, query, showSuggestions, suggestions])

  // Flat ordered list used for keyboard navigation
  const allItems = useMemo(() => [
    ...(showSuggestions ? suggestions.map(s => ({ id: s.id, title: s.title, folder: '', score: s.score })) : []),
    ...filteredNotes.map(n => ({ id: n.id, title: n.title, folder: n.folder ?? '', score: 0 })),
  ], [filteredNotes, showSuggestions, suggestions])

  useEffect(() => { setSel(0) }, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if      (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(allItems.length - 1, s + 1)) }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
      else if (e.key === 'Enter')     { e.preventDefault(); if (allItems[sel]) onPick(allItems[sel]) }
      else if (e.key === 'Escape')    { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [allItems, sel, onPick, onClose])

  const style = {
    left: Math.min(pos.x, window.innerWidth  - 340),
    top:  Math.min(pos.y, window.innerHeight - 320),
  }

  return (
    <div className="bl-picker" style={{ position: 'fixed', ...style, zIndex: 9999 }}>
      <div className="bl-picker__hint">Link para nota {query ? `"${query}"` : ''}</div>

      {/* ── Suggested section (only when query is empty) ── */}
      {showSuggestions && (
        <>
          <div className="bl-picker__section">◎ Sugeridas</div>
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              className="bl-picker__item bl-picker__item--suggested"
              data-selected={i === sel || undefined}
              onMouseEnter={() => setSel(i)}
              onMouseDown={e => { e.preventDefault(); onPick(s) }}
            >
              <span className="bl-picker__dot bl-picker__dot--electric" />
              <span className="bl-picker__title">{s.title}</span>
              <span className="bl-picker__score">{Math.round(s.score * 100)}%</span>
            </button>
          ))}
          {filteredNotes.length > 0 && <div className="bl-picker__sep" />}
        </>
      )}

      {/* ── All notes (search results) ── */}
      {filteredNotes.length === 0 && !showSuggestions && (
        <button
          className="bl-picker__item"
          onMouseDown={e => { e.preventDefault(); onPick({ id: 'new', title: query || 'Nova nota' }) }}
        >
          Criar "{query || 'nova nota'}"
        </button>
      )}
      {filteredNotes.map((n, i) => {
        const idx = showSuggestions ? suggestions.length + i : i
        return (
          <button
            key={n.id}
            className="bl-picker__item"
            data-selected={idx === sel || undefined}
            onMouseEnter={() => setSel(idx)}
            onMouseDown={e => { e.preventDefault(); onPick(n) }}
          >
            <span className="bl-picker__dot" />
            <span className="bl-picker__title">{n.title}</span>
            <span className="bl-picker__path">{n.folder}</span>
          </button>
        )
      })}
    </div>
  )
}
