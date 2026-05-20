import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

export function MathBlockView({ node, updateAttributes }: NodeViewProps) {
  const src = node.attrs.src as string          // always in sync with ProseMirror
  const [editing, setEditing] = useState(!src)
  const [draft, setDraft] = useState(src)       // local copy only while editing
  const renderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing || !renderRef.current) return
    import('katex').then(({ default: katex }) => {
      try {
        katex.render(src || '\\,', renderRef.current!, { displayMode: true, throwOnError: false })
      } catch {
        if (renderRef.current) renderRef.current.textContent = src
      }
    })
  }, [src, editing])

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
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } }}
          placeholder="Expressão LaTeX..."
        />
      ) : (
        <div ref={renderRef} onClick={startEditing} style={{ cursor: 'pointer' }} />
      )}
    </NodeViewWrapper>
  )
}
