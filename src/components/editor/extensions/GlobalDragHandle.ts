/**
 * GlobalDragHandle — ProseMirror plugin that shows a ⠿ drag grip
 * on the left edge of the hovered block.
 *
 * Key fix: mouse-tracking is done on `document`, not `view.dom`.
 * This means the handle stays visible while the cursor moves from
 * inside the editor toward the handle (which lives outside view.dom).
 * The handle only hides when the cursor is far from both the editor
 * AND the handle's current position.
 */
import { Extension } from '@tiptap/core'
import { Plugin, NodeSelection } from 'prosemirror-state'
import { DOMSerializer } from 'prosemirror-model'
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

  // Cache the handle's fixed-position coords so we can check proximity
  // without calling getBoundingClientRect on every mousemove.
  let hLeft = -999
  let hTop  = -999
  const H_W = 20   // handle width  (must match CSS)
  const H_H = 24   // handle height (must match CSS)
  const GRACE = 28 // px of grace zone around the handle

  function isNearHandle(x: number, y: number): boolean {
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

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      if (!activeView || activePos < 0) return
      try {
        const { state, dispatch } = activeView
        dispatch(state.tr.setSelection(NodeSelection.create(state.doc, activePos)))
      } catch { /* node may not support NodeSelection */ }
    })

    handle.addEventListener('dragstart', (e) => {
      if (!activeView || activePos < 0 || !e.dataTransfer) return
      dragging = true
      const { state } = activeView
      const slice = state.selection.content()

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

    return handle
  }

  return new Plugin({
    view(view) {
      activeView = view
      const h = getHandle()

      // ── Global mouse tracking ────────────────────────────────────
      // Listening on `document` (not view.dom) means the handler
      // fires even while the cursor is in the strip between the
      // editor's left edge and the handle, so the handle never
      // disappears prematurely.
      const onDocMouseMove = (e: MouseEvent) => {
        if (dragging) return

        const rect = view.dom.getBoundingClientRect()
        const inEditor =
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom

        if (inEditor) {
          // Update handle to track the hovered block
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

        // Outside editor — hide only if the cursor is not in the
        // grace zone around the handle's last known position.
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
