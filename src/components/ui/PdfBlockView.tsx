import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useState } from 'react'
import { createPortal } from 'react-dom'

export function PdfBlockView({ node, deleteNode }: NodeViewProps) {
  const { src, name } = node.attrs as { src: string; name: string }
  const [open, setOpen] = useState(false)

  return (
    <NodeViewWrapper>
      <div className="pdf-block" contentEditable={false}>
        <span className="pdf-block__icon">PDF</span>
        <span className="pdf-block__name">{name}</span>
        <button className="pdf-block__open" onClick={() => setOpen(true)}>Abrir</button>
        <button className="pdf-block__del" onClick={deleteNode} title="Remover">×</button>
      </div>

      {open && createPortal(
        <div className="pdf-overlay" onClick={() => setOpen(false)}>
          <div className="pdf-viewer" onClick={e => e.stopPropagation()}>
            <div className="pdf-viewer__head">
              <span className="pdf-viewer__title">{name}</span>
              <a className="pdf-viewer__download" href={src} target="_blank" rel="noreferrer" title="Abrir em nova aba">↗</a>
              <button className="pdf-viewer__close" onClick={() => setOpen(false)}>×</button>
            </div>
            <iframe src={src} className="pdf-viewer__frame" title={name} />
          </div>
        </div>,
        document.body,
      )}
    </NodeViewWrapper>
  )
}
