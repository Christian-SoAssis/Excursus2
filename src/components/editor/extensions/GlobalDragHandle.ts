/**
 * GlobalDragHandle — ProseMirror plugin that shows a ⠿ drag grip
 * on the left edge of the hovered block.
 *
 * How the drag actually works
 * ───────────────────────────
 * The handle lives in document.body (outside view.dom). To make
 * ProseMirror handle the DnD natively we proxy the handle's
 * dragstart event onto view.dom with the *same* DataTransfer object.
 * PM's own dragstart handler then:
 *   1. sees the NodeSelection we set on mousedown
 *   2. calls _serializeForClipboard (adds the data-pm-slice metadata
 *      that PM's drop handler needs to reconstruct the node correctly)
 *   3. writes to the shared DataTransfer
 *   4. sets view.dragging with the internal Dragging instance
 *
 * Without this proxy, a manual DOMSerializer-based approach produces
 * HTML that PM treats as an external paste, breaking the drop.
 *
 * Grace zone (visibility fix)
 * ───────────────────────────
 * Listening on document (not view.dom) keeps the handle visible while
 * the cursor travels from the editor toward the handle.
 */
import { Extension } from '@tiptap/core'
import { Plugin, NodeSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { Node as PMNode } from 'prosemirror-model'

/* ── Helpers ────────────────────────────────────────────────────── */

function resolveTarget(
  view: EditorView,
  clientX: number,
  clientY: number,
): { node: PMNode; pos: number } | null {
  const rect = view.dom.getBoundingClientRect()
  const x = Math.min(Math.max(clientX, rect.left + 2), rect.right - 2)

  const hit = view.posAtCoords({ left: x, top: clientY })
  if (!hit) return null

  const $pos = view.state.doc.resolve(hit.pos)

  // If inside a column → target the direct block child of that column
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d - 1).type.name === 'column') {
      const node = $pos.node(d)
      if (!node || node.type.name === 'doc') return null
      return { node, pos: $pos.before(d) }
    }
  }

  // Otherwise → top-level block (depth 1)
  if ($pos.depth < 1) return null
  const node = $pos.node(1)
  if (!node || node.type.name === 'doc') return null
  return { node, pos: $pos.before(1) }
}

function domForNode(view: EditorView, nodePos: number): HTMLElement | null {
  try {
    const { node: domNode } = view.domAtPos(nodePos + 1)
    let el: Node | null = domNode
    while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode
    if (!el) return null
    let element = el as HTMLElement
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

  // Cached position for the grace-zone proximity check
  let hLeft = -999
  let hTop  = -999
  const H_W    = 20   // handle width  (matches CSS)
  const H_H    = 24   // handle height (matches CSS)
  const GRACE  = 28   // px grace zone around the handle

  function isNearHandle(x: number, y: number) {
    return (
      x >= hLeft - GRACE && x <= hLeft + H_W + GRACE &&
      y >= hTop  - GRACE && y <= hTop  + H_H + GRACE
    )
  }

  function getHandle(): HTMLElement {
    if (handle) return handle

    handle = document.createElement('div')
    handle.className = 'global-drag-handle'
    handle.setAttribute('draggable', 'true')
    handle.setAttribute('aria-hidden', 'true')
    handle.textContent = '⠿'
    document.body.appendChild(handle)

    /* ── mousedown: select the target node ────────────────────────
       e.preventDefault() stops the editor from blurring, but we
       dispatch the NodeSelection transaction immediately so the
       selection is updated before dragstart fires.             */
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      if (!activeView || activePos < 0) return
      try {
        const { state, dispatch } = activeView
        dispatch(state.tr.setSelection(NodeSelection.create(state.doc, activePos)))
      } catch { /* node may not support NodeSelection */ }
    })

    /* ── dragstart: proxy onto view.dom ───────────────────────────
       By dispatching onto view.dom with the *same* DataTransfer,
       ProseMirror's native dragstart handler runs, serializes the
       NodeSelection properly (data-pm-slice attribute included),
       and sets view.dragging with its internal Dragging object.  */
    handle.addEventListener('dragstart', (e) => {
      if (!activeView || activePos < 0 || !e.dataTransfer) return
      dragging = true

      activeView.dom.dispatchEvent(
        new DragEvent('dragstart', {
          bubbles: false,   // don't re-bubble to avoid loops
          cancelable: true,
          dataTransfer: e.dataTransfer,  // shared reference — PM writes to this
          clientX: e.clientX,
          clientY: e.clientY,
        }),
      )
    })

    /* ── dragend: clean up view.dragging if drop was cancelled ──── */
    handle.addEventListener('dragend', () => {
      dragging = false
      if (activeView) {
        ;(activeView as unknown as Record<string, unknown>).dragging = null
      }
    })

    return handle
  }

  return new Plugin({
    view(view) {
      activeView = view
      const h = getHandle()

      /* Listen on document so the handle stays visible while the
         cursor travels from the editor toward the handle element. */
      const onDocMouseMove = (e: MouseEvent) => {
        if (dragging) return

        const rect = view.dom.getBoundingClientRect()
        const inEditor =
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom

        if (inEditor) {
          const target = resolveTarget(view, e.clientX, e.clientY)
          if (!target) { h.style.display = 'none'; return }

          const domEl = domForNode(view, target.pos)
          if (!domEl) { h.style.display = 'none'; return }

          const domRect = domEl.getBoundingClientRect()
          activePos = target.pos
          hLeft = domRect.left - 26
          hTop  = domRect.top  + 4

          h.style.display = 'flex'
          h.style.top  = `${hTop}px`
          h.style.left = `${hLeft}px`
          return
        }

        // Outside the editor — only hide when far from the handle
        if (h.style.display !== 'none' && !isNearHandle(e.clientX, e.clientY)) {
          h.style.display = 'none'
        }
      }

      document.addEventListener('mousemove', onDocMouseMove)

      return {
        destroy() {
          document.removeEventListener('mousemove', onDocMouseMove)
          handle?.remove()
          handle = null
          activeView = null
        },
      }
    },
  })
}

/* ── TipTap Extension ───────────────────────────────────────────── */

export const GlobalDragHandle = Extension.create({
  name: 'globalDragHandle',
  addProseMirrorPlugins() {
    return [makeDragHandlePlugin()]
  },
})
