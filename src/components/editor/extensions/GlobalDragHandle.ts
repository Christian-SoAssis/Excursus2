/**
 * GlobalDragHandle — a ProseMirror plugin that renders a ⠿ grip icon
 * to the left of whichever block the mouse is hovering over.
 *
 * Supports:
 *  • Top-level blocks (paragraphs, headings, etc.)
 *  • Blocks inside columns  (drag between columns or to top-level)
 *  • Any custom node (PDF, callout, math, toggle, table…)
 *
 * No TipTap Pro required. Works with prosemirror-view's public API.
 */
import { Extension } from '@tiptap/core'
import { Plugin, NodeSelection } from 'prosemirror-state'
import { DOMSerializer } from 'prosemirror-model'
import type { EditorView } from 'prosemirror-view'
import type { Node as PMNode } from 'prosemirror-model'

/* ── Helpers ────────────────────────────────────────────────────── */

/**
 * Walk the document's ancestor chain to find the "draggable" node:
 * - If the cursor is inside a column, target the direct child of that column
 *   (the block, e.g. paragraph, pdf, heading inside the column).
 * - Otherwise target the top-level block (depth 1).
 */
function resolveTarget(
  view: EditorView,
  clientX: number,
  clientY: number,
): { node: PMNode; pos: number } | null {
  const rect = view.dom.getBoundingClientRect()
  // Clamp X so posAtCoords always lands inside the editor
  const x = Math.min(Math.max(clientX, rect.left + 2), rect.right - 2)

  const hit = view.posAtCoords({ left: x, top: clientY })
  if (!hit) return null

  const $pos = view.state.doc.resolve(hit.pos)

  // Walk up: find the first ancestor whose *parent* is 'column'
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d - 1).type.name === 'column') {
      const pos = $pos.before(d)
      const node = $pos.node(d)
      if (node.type.name === 'doc') return null
      return { node, pos }
    }
  }

  // Fallback: top-level block (depth 1 from doc)
  if ($pos.depth < 1) return null
  const pos = $pos.before(1)
  const node = $pos.node(1)
  if (!node || node.type.name === 'doc') return null
  return { node, pos }
}

/**
 * Return the outermost HTMLElement that ProseMirror/TipTap uses to
 * represent the node at `nodePos` in the DOM.
 */
function domForNode(view: EditorView, nodePos: number): HTMLElement | null {
  try {
    const { node: domNode } = view.domAtPos(nodePos + 1)

    // Ensure we have an Element (not a text node)
    let el: Node | null = domNode
    while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode
    if (!el) return null

    let element = el as HTMLElement
    // Walk up until we reach a direct child of the editor root
    // OR until the parent is a NodeViewContent container
    while (element.parentElement) {
      const parent = element.parentElement
      if (parent === view.dom) break
      if (parent.hasAttribute('data-node-view-content')) break
      element = parent
    }
    return element
  } catch {
    return null
  }
}

/* ── Plugin factory ─────────────────────────────────────────────── */

function makeDragHandlePlugin() {
  let handle: HTMLElement | null = null
  let activePos = -1
  let activeView: EditorView | null = null
  let dragging = false
  let overHandle = false   // mouse is hovering the handle itself

  function getHandle(): HTMLElement {
    if (handle) return handle

    handle = document.createElement('div')
    handle.className = 'global-drag-handle'
    handle.setAttribute('draggable', 'true')
    handle.setAttribute('aria-hidden', 'true')
    handle.textContent = '⠿'
    document.body.appendChild(handle)

    /* ── mousedown: create NodeSelection so PM knows what to drag ── */
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      if (!activeView || activePos < 0) return
      try {
        const { state, dispatch } = activeView
        const sel = NodeSelection.create(state.doc, activePos)
        dispatch(state.tr.setSelection(sel))
      } catch {
        // node might not support NodeSelection — ignore
      }
    })

    /* ── dragstart: hand the slice over to ProseMirror's drop handler */
    handle.addEventListener('dragstart', (e) => {
      if (!activeView || activePos < 0 || !e.dataTransfer) return
      dragging = true

      const { state } = activeView
      const slice = state.selection.content()

      // Serialize the slice to HTML using ProseMirror's own DOM serializer
      const container = document.createElement('div')
      DOMSerializer
        .fromSchema(state.schema)
        .serializeFragment(slice.content, { document }, container)

      e.dataTransfer.clearData()
      e.dataTransfer.setData('text/html', container.innerHTML)
      e.dataTransfer.setData(
        'text/plain',
        slice.content.textBetween(0, slice.content.size, '\n'),
      )
      e.dataTransfer.effectAllowed = 'move'

      // Register with ProseMirror's internal drop handler
      // (it reads view.dragging to obtain the slice on drop)
      ;(activeView as unknown as Record<string, unknown>).dragging = {
        slice,
        move: true,
      }
    })

    handle.addEventListener('dragend', () => {
      dragging = false
      if (activeView) {
        ;(activeView as unknown as Record<string, unknown>).dragging = null
      }
    })

    handle.addEventListener('mouseenter', () => { overHandle = true })
    handle.addEventListener('mouseleave', () => { overHandle = false })

    return handle
  }

  return new Plugin({
    view(view) {
      activeView = view
      const h = getHandle()

      const onMouseMove = (e: MouseEvent) => {
        if (dragging || overHandle) return

        const editorRect = view.dom.getBoundingClientRect()
        // Hide when far outside the editor horizontally
        if (e.clientX > editorRect.right + 20 || e.clientX < editorRect.left - 60) {
          h.style.display = 'none'
          return
        }

        const target = resolveTarget(view, e.clientX, e.clientY)
        if (!target) {
          h.style.display = 'none'
          return
        }

        const domEl = domForNode(view, target.pos)
        if (!domEl) {
          h.style.display = 'none'
          return
        }

        const domRect = domEl.getBoundingClientRect()
        activePos = target.pos

        h.style.display = 'flex'
        // Centre the handle vertically on the block's first line
        h.style.top  = `${domRect.top + 4}px`
        h.style.left = `${domRect.left - 26}px`
      }

      const onMouseLeave = () => {
        if (!overHandle && !dragging) h.style.display = 'none'
      }

      view.dom.addEventListener('mousemove', onMouseMove)
      view.dom.addEventListener('mouseleave', onMouseLeave)

      return {
        destroy() {
          view.dom.removeEventListener('mousemove', onMouseMove)
          view.dom.removeEventListener('mouseleave', onMouseLeave)
          handle?.remove()
          handle = null
          activeView = null
        },
      }
    },
  })
}

/* ── TipTap Extension wrapper ───────────────────────────────────── */

export const GlobalDragHandle = Extension.create({
  name: 'globalDragHandle',

  addProseMirrorPlugins() {
    return [makeDragHandlePlugin()]
  },
})
