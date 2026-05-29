import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useRef } from 'react'

export function ToggleBlockView({ node, updateAttributes, getPos, editor }: NodeViewProps) {
  const open: boolean = node.attrs.open ?? true
  const titleRef = useRef<HTMLDivElement>(null)

  // Seed the editable div once on mount.
  // Using a ref + textContent avoids React re-renders clobbering the cursor.
  useEffect(() => {
    if (!titleRef.current) return
    titleRef.current.textContent = node.attrs.title ?? ''

    // If created fresh, focus the title and clear the flag.
    if (node.attrs.focusTitle) {
      titleRef.current.focus()
      // Place caret at end of title text
      const range = document.createRange()
      range.selectNodeContents(titleRef.current)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      updateAttributes({ focusTitle: false })
    }
  }, []) // intentionally empty — mount only

  // Prevent ProseMirror from stealing focus when the user clicks the title.
  //
  // React 17+ dispatches synthetic events at the root *after* native DOM
  // handlers fire, so `onMouseDown={e => e.stopPropagation()}` is too late —
  // ProseMirror's listener on `.ProseMirror` already ran and stolen focus.
  // Attaching a native listener directly to the element fires in the bubble
  // phase *before* the event reaches `.ProseMirror`, which is what we need.
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const stop = (e: MouseEvent) => e.stopPropagation()
    el.addEventListener('mousedown', stop)
    return () => el.removeEventListener('mousedown', stop)
  }, [])

  const toggle = () => updateAttributes({ open: !open })

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Auto-open when entering from the title
      if (!open) updateAttributes({ open: true })
      // Move TipTap cursor into the body content
      const pos = typeof getPos === 'function' ? getPos() : undefined
      if (pos !== undefined) {
        // pos+1 = inside the toggleBlock node → TipTap resolves to first text pos
        editor.chain().focus().setTextSelection(pos + 1).run()
      }
      return
    }

    // Backspace on an empty title → delete the entire toggle block
    if (e.key === 'Backspace' && !titleRef.current?.textContent) {
      e.preventDefault()
      const pos = typeof getPos === 'function' ? getPos() : undefined
      if (pos !== undefined) {
        editor.chain().focus()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .run()
      }
      return
    }

    // ArrowUp / Shift+Tab from the title → move cursor to preceding content
    if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
      e.preventDefault()
      const pos = typeof getPos === 'function' ? getPos() : undefined
      if (pos !== undefined && pos > 0) {
        editor.chain().focus().setTextSelection(pos).run()
      }
      return
    }

    // Tab from title → move into toggle body (same as Enter)
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      if (!open) updateAttributes({ open: true })
      const pos = typeof getPos === 'function' ? getPos() : undefined
      if (pos !== undefined) {
        editor.chain().focus().setTextSelection(pos + 1).run()
      }
    }
  }

  return (
    <NodeViewWrapper data-type="toggleBlock">
      <div className="tgl">

        {/* ── Header (always visible) ── */}
        {/* contentEditable={false} tells ProseMirror to skip this area entirely.
            The .tgl__title div with its own contentEditable becomes a native
            editable island that the browser manages independently. */}
        <div className="tgl__header" contentEditable={false}>
          <button
            className={`tgl__arrow${open ? ' tgl__arrow--open' : ''}`}
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
