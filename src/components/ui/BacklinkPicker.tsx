import { useEffect, useMemo, useState } from 'react'
import { useNotesStore } from '../../store/notes'

interface BacklinkPickerProps {
  pos: { x: number; y: number }
  query: string
  onPick: (note: { id: string; title: string }) => void
  onClose: () => void
}

export function BacklinkPicker({ pos, query, onPick, onClose }: BacklinkPickerProps) {
  const notes = useNotesStore(s => s.notes)
  const [sel, setSel] = useState(0)

  const items = useMemo(() => {
    const q = query.toLowerCase()
    return notes.filter(n => !q || n.title.toLowerCase().includes(q)).slice(0, 7)
  }, [notes, query])

  useEffect(() => { setSel(0) }, [query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(items.length - 1, s + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
      else if (e.key === 'Enter') { e.preventDefault(); if (items[sel]) onPick(items[sel]) }
      else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [items, sel, onPick, onClose])

  const style = {
    left: Math.min(pos.x, window.innerWidth - 340),
    top: Math.min(pos.y, window.innerHeight - 320),
  }

  return (
    <div className="bl-picker" style={{ position: 'fixed', ...style, zIndex: 9999 }}>
      <div className="bl-picker__hint">Link para nota {query ? `"${query}"` : ''}</div>
      {items.length === 0 && (
        <button className="bl-picker__item"
          onMouseDown={e => { e.preventDefault(); onPick({ id: 'new', title: query || 'Nova nota' }) }}>
          Criar "{query || 'nova nota'}"
        </button>
      )}
      {items.map((n, i) => (
        <button key={n.id} className="bl-picker__item" data-selected={i === sel}
          onMouseEnter={() => setSel(i)}
          onMouseDown={e => { e.preventDefault(); onPick(n) }}>
          <span className="bl-picker__dot" />
          <span className="bl-picker__title">{n.title}</span>
          <span className="bl-picker__path">{n.folder}</span>
        </button>
      ))}
    </div>
  )
}
