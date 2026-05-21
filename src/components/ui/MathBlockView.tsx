import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import katex from 'katex'
import { useMemo, useState } from 'react'

export function MathBlockView({ node, updateAttributes }: NodeViewProps) {
  const src = (node.attrs.src ?? '') as string
  const [editing, setEditing] = useState(!src)
  const [draft, setDraft] = useState(src)

  // renderToString is synchronous — no useEffect, no async, no race conditions
  const html = useMemo(() => {
    if (!src) return ''
    try {
      return katex.renderToString(src, { displayMode: true, throwOnError: false, output: 'html' })
    } catch {
      return `<span style="color:var(--accent-terracotta);font-family:var(--font-mono);font-size:13px">${src}</span>`
    }
  }, [src])

  const startEditing = () => { setDraft(src); setEditing(true) }
  const commit = () => { updateAttributes({ src: draft }); setEditing(false) }

  return (
    <NodeViewWrapper className="math-block">
      {editing ? (
        <input
          autoFocus
          className="math-block__src"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setEditing(false) }
          }}
          placeholder="Expressão LaTeX..."
        />
      ) : (
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html || '<span style="opacity:.35;font-size:13px">Clique para editar LaTeX…</span>' }}
          onClick={startEditing}
          style={{ cursor: 'pointer' }}
        />
      )}
    </NodeViewWrapper>
  )
}
