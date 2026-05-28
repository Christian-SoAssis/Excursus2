import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { refreshStorageUrl } from '../../lib/storage'

export function PdfBlockView({ node, deleteNode }: NodeViewProps) {
  const { src, name, path } = node.attrs as { src: string; name: string; path: string }
  const [resolvedSrc, setResolvedSrc] = useState(src)
  const [open, setOpen] = useState(false)

  // If we have the storage path, generate a fresh signed URL so the PDF
  // is always accessible even after the original signed URL expires or
  // when the bucket is private (public URL wouldn't work in that case).
  useEffect(() => {
    if (!path) return
    refreshStorageUrl(path).then(url => { if (url) setResolvedSrc(url) })
  }, [path])

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
