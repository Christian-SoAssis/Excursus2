import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'

export function MathBlockView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.src)
  const [src, setSrc] = useState<string>(node.attrs.src || '')
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

  const commit = () => { setEditing(false); updateAttributes({ src }) }

  return (
    <NodeViewWrapper className="math-block">
      {editing ? (
        <input
          autoFocus
          className="math-block__src"
          value={src}
          onChange={e => setSrc(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() } }}
          placeholder="LaTeX expression..."
        />
      ) : (
        <div ref={renderRef} onClick={() => setEditing(true)} style={{ cursor: 'pointer' }} />
      )}
    </NodeViewWrapper>
  )
}
