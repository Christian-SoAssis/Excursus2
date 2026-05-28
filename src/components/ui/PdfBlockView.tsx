import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { refreshStorageUrl } from '../../lib/storage'

export function PdfBlockView({ node, deleteNode }: NodeViewProps) {
  const { src, name, path } = node.attrs as { src: string; name: string; path: string }
  const [resolvedSrc, setResolvedSrc] = useState(src)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // If we have the storage path, generate a fresh signed URL so the PDF is
  // always accessible even when the bucket is private or the URL has expired.
  useEffect(() => {
    if (!path) return
    refreshStorageUrl(path).then(url => { if (url) setResolvedSrc(url) })
  }, [path])

  return (
    <NodeViewWrapper>
      {/* pdf-block-wrap is a single block; drag handle lives inside pdf-block */}
      <div className={`pdf-block-wrap${expanded ? ' pdf-block-wrap--open' : ''}`} contentEditable={false}>

        {/* ── Header row ──────────────────────────────────────────── */}
        <div className="pdf-block">
          {/* Drag handle — ProseMirror picks this up because of data-drag-handle */}
          <span className="pdf-block__handle" data-drag-handle title="Arrastar">⠿</span>

          <span className="pdf-block__icon">PDF</span>
          <span className="pdf-block__name">{name}</span>

          {/* Toggle inline view */}
          <button
            className="pdf-block__toggle"
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Recolher visualização' : 'Visualizar no editor'}
          >
            {expanded ? '↑ Recolher' : '↓ Embutir'}
          </button>

          {/* Open full-screen modal */}
          <button className="pdf-block__open" onClick={() => setOpen(true)}>Abrir ↗</button>

          {/* Delete node */}
          <button className="pdf-block__del" onClick={deleteNode} title="Remover">×</button>
        </div>

        {/* ── Inline viewer (resizable) ────────────────────────── */}
        {expanded && (
          <div className="pdf-block__inline">
            <iframe
              src={resolvedSrc}
              title={name}
              className="pdf-block__inline-frame"
            />
          </div>
        )}
      </div>

      {/* ── Full-screen modal ────────────────────────────────────── */}
      {open && createPortal(
        <div className="pdf-overlay" onClick={() => setOpen(false)}>
          <div className="pdf-viewer" onClick={e => e.stopPropagation()}>
            <div className="pdf-viewer__head">
              <span className="pdf-viewer__title">{name}</span>
              <a className="pdf-viewer__download" href={resolvedSrc} target="_blank" rel="noreferrer" title="Abrir em nova aba">↗</a>
              <button className="pdf-viewer__close" onClick={() => setOpen(false)}>×</button>
            </div>
            <iframe src={resolvedSrc} className="pdf-viewer__frame" title={name} />
          </div>
        </div>,
        document.body,
      )}
    </NodeViewWrapper>
  )
}
