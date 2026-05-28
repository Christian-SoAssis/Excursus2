import { useEffect, useMemo, useState } from 'react'

export interface SlashItem {
  type: string
  label: string
  desc: string
  kbd?: string
}

const SLASH_ITEMS: SlashItem[] = [
  { type: 'h1',        label: 'Título grande',   desc: 'Heading 1',              kbd: '#' },
  { type: 'h2',        label: 'Título médio',    desc: 'Heading 2',              kbd: '##' },
  { type: 'h3',        label: 'Título pequeno',  desc: 'Heading 3',              kbd: '###' },
  { type: 'p',         label: 'Parágrafo',       desc: 'Texto corrido',          kbd: '' },
  { type: '2col',      label: '2 Colunas',       desc: 'Layout lado a lado',     kbd: '' },
  { type: '3col',      label: '3 Colunas',       desc: 'Layout em três colunas', kbd: '' },
  { type: 'todo',      label: 'Tarefa',          desc: 'Checkbox + texto',       kbd: '[ ]' },
  { type: 'list',      label: 'Lista',           desc: 'Marcadores',             kbd: '-' },
  { type: 'quote',     label: 'Citação',         desc: 'Bloco destacado',        kbd: '>' },
  { type: 'code',      label: 'Código',          desc: 'Bloco monospace',        kbd: '```' },
  { type: 'table',     label: 'Tabela',          desc: '3×3 com cabeçalho',      kbd: '' },
  { type: 'image',     label: 'Imagem (arquivo)',desc: 'Upload do dispositivo',  kbd: '' },
  { type: 'image-url', label: 'Imagem (URL)',    desc: 'Embed por link',         kbd: '' },
  { type: 'pdf',       label: 'PDF',             desc: 'Upload e visualizador',  kbd: '' },
  { type: 'pdf-url',   label: 'PDF (URL)',       desc: 'Embed por link',         kbd: '' },
  { type: 'math',      label: 'Matemática',      desc: 'LaTeX / KaTeX',          kbd: '$$' },
  { type: 'callout',   label: 'Callout',         desc: 'Caixa de destaque',      kbd: '!' },
  { type: 'toggle',   label: 'Toggle',          desc: 'Lista colapsável',        kbd: '>' },
  { type: 'divider',   label: 'Divisor',         desc: 'Linha horizontal',       kbd: '---' },
]

interface SlashMenuProps {
  pos: { x: number; y: number }
  query: string
  onPick: (item: SlashItem) => void
  onClose: () => void
}

export function SlashMenu({ pos, query, onPick, onClose }: SlashMenuProps) {
  const [sel, setSel] = useState(0)

  const items = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return SLASH_ITEMS
    return SLASH_ITEMS.filter(it =>
      it.label.toLowerCase().includes(q) || it.type.includes(q) || it.desc.toLowerCase().includes(q)
    )
  }, [query])

  useEffect(() => { setSel(0) }, [query])

  // Auto-dismiss when nothing matches after 3+ characters
  useEffect(() => {
    if (items.length === 0 && query.length >= 3) onClose()
  }, [items.length, query, onClose])

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
    top: Math.min(pos.y, window.innerHeight - 400),
  }

  return (
    <div className="slash" style={{ position: 'fixed', ...style, zIndex: 9999 }}>
      <div className="slash__hint">Inserir bloco {query ? `· "${query}"` : ''}</div>
      {items.length === 0 && <div className="slash__hint" style={{ padding: '14px 10px' }}>Nenhum bloco encontrado</div>}
      {items.map((it, i) => (
        <button key={it.type} className="slash__item" data-selected={i === sel}
          onMouseEnter={() => setSel(i)}
          onMouseDown={e => { e.preventDefault(); onPick(it) }}>
          <span>
            <div className="slash__label">{it.label}</div>
            <div className="slash__desc">{it.desc}</div>
          </span>
          {it.kbd && <span className="slash__kbd">{it.kbd}</span>}
        </button>
      ))}
    </div>
  )
}
