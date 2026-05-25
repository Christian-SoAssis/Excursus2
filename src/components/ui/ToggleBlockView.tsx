import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef } from 'react'

export function ToggleBlockView({ node, updateAttributes, getPos, editor }: NodeViewProps) {
  const open: boolean = node.attrs.open ?? true
  const titleRef = useRef<HTMLDivElement>(null)

  // Seed the editable div once on mount.
  // Using a ref + textContent avoids React re-renders clobbering the cursor.
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.textContent = node.attrs.title ?? ''
    }
  }, []) // intentionally empty — mount only

  const toggle = () => updateAttributes({ open: !open })

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()

    // Auto-open when entering from the title
    if (!open) updateAttributes({ open: true })

    // Move TipTap cursor into the body content
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos !== undefined) {
      // pos+1 = inside the toggleBlock node → TipTap resolves to first text pos
      editor.chain().focus().setTextSelection(pos + 1).run()
    }
  }

  return (
    <NodeViewWrapper data-type="toggleBlock">
      <div className="tgl">

        {/* ── Header (always visible) ── */}
        <div className="tgl__header">
          <button
            className={`tgl__arrow${open ? ' tgl__arrow--open' : ''}`}
            contentEditable={false}
            onClick={toggle}
            aria-label={open ? 'Recolher' : 'Expandir'}
            title={open ? 'Recolher' : 'Expandir'}
          >
            ▶
          </button>

          <div
            ref={titleRef}
            className="tgl__title"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Toggle…"
            onInput={e => updateAttributes({ title: e.currentTarget.textContent ?? '' })}
            onKeyDown={handleTitleKeyDown}
          />
        </div>

        {/* ── Collapsible body ── */}
        <div className={`tgl__body${open ? '' : ' tgl__body--closed'}`}>
          <NodeViewContent className="tgl__content" />
        </div>

      </div>
    </NodeViewWrapper>
  )
}
