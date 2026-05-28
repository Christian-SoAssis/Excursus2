/**
 * GlobalDragHandle — floating ⠿ grip for any block in the editor.
 *
 * Uses Pointer Events (not native browser DnD) because:
 *   - e.preventDefault() on mousedown — which we need to prevent the
 *     editor from stealing focus/selection — also cancels the native
 *     dragstart event. So native DnD never fires.
 *   - Pointer capture gives us reliable move/up events even if the
 *     cursor leaves the handle element.
 *
 * Flow:
 *   pointerdown  → snapshot the target node, capture the pointer
 *   pointermove  → after 4 px threshold, show floating preview + drop line
 *   pointerup    → dispatch a ProseMirror tr.delete+insert to move the node
 */
import { Extension } from '@tiptap/core'
import { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { Node as PMNode } from 'prosemirror-model'

/* ── Helpers ────────────────────────────────────────────────────── */

interface Target { node: PMNode; pos: number }

/** Walk up the resolve chain to find the right block to drag. */
function resolveTarget(view: EditorView, cx: number, cy: number): Target | null {
  const rect = view.dom.getBoundingClientRect()
  const x = Math.min(Math.max(cx, rect.left + 2), rect.right - 2)
  const hit = view.posAtCoords({ left: x, top: cy })
  if (!hit) return null
  const $pos = view.state.doc.resolve(hit.pos)
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d - 1).type.name === 'column') {
      const node = $pos.node(d)
      if (!node || node.type.name === 'doc') return null
      return { node, pos: $pos.before(d) }
    }
  }
  if ($pos.depth < 1) return null
  const node = $pos.node(1)
  if (!node || node.type.name === 'doc') return null
  return { node, pos: $pos.before(1) }
}

/** Get the outermost block DOM element for a node position. */
function domForNode(view: EditorView, nodePos: number): HTMLElement | null {
  try {
    const { node: dn } = view.domAtPos(nodePos + 1)
    let el: Node | null = dn
    while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode
    if (!el) return null
    let e = el as HTMLElement
    while (e.parentElement) {
      const p = e.parentElement
      if (p === view.dom) break
      if (p.hasAttribute('data-node-view-content')) break
      e = p
    }
    return e
  } catch { return null }
}

/** Find where to insert (before or after a block) given cursor coords. */
function findDropPos(view: EditorView, cx: number, cy: number): number | null {
  const hit = view.posAtCoords({ left: cx, top: cy })
  if (!hit) return null
  const $pos = view.state.doc.resolve(hit.pos)
  for (let d = $pos.depth; d >= 1; d--) {
    const pName = $pos.node(d - 1).type.name
    if (pName === 'doc' || pName === 'column') {
      const blockStart = $pos.before(d)
      const blockSize  = $pos.node(d).nodeSize
      const domEl = domForNode(view, blockStart)
      if (domEl) {
        const r = domEl.getBoundingClientRect()
        return cy < r.top + r.height / 2 ? blockStart : blockStart + blockSize
      }
      return blockStart
    }
  }
  return null
}

/** Move `node` (starting at `fromNodeStart`) to `toPos` in one transaction. */
function performMove(
  view: EditorView,
  fromNodeStart: number,
  node: PMNode,
  toPos: number,
) {
  const nodeEnd = fromNodeStart + node.nodeSize
  // Drop inside self → no-op
  if (toPos > fromNodeStart && toPos <= nodeEnd) return

  try {
    const tr = view.state.tr.delete(fromNodeStart, nodeEnd)
    // Map toPos through the deletion
    const mappedTo = tr.mapping.map(toPos)
    tr.insert(mappedTo, node)
    view.dispatch(tr)
  } catch (err) {
    console.warn('[DragHandle] move failed:', err)
  }
}

/* ── Plugin factory ─────────────────────────────────────────────── */

function makeDragHandlePlugin() {
  /* Visual elements */
  let handle:   HTMLElement | null = null
  let preview:  HTMLElement | null = null
  let dropLine: HTMLElement | null = null

  /* State */
  let activePos = -1
  let activeView: EditorView | null = null
  let hLeft = -999, hTop = -999
  const H_W = 20, H_H = 24, GRACE = 28

  interface DragState {
    nodePos: number
    node: PMNode
    startX: number; startY: number
    started: boolean
  }
  let drag: DragState | null = null

  /* ── helpers ──────────────────────────────────────────────────── */

  function isNearHandle(x: number, y: number) {
    return x >= hLeft - GRACE && x <= hLeft + H_W + GRACE &&
           y >= hTop  - GRACE && y <= hTop  + H_H + GRACE
  }

  function getDropLine(): HTMLElement {
    if (!dropLine) {
      dropLine = document.createElement('div')
      dropLine.style.cssText =
        'position:fixed;pointer-events:none;z-index:9998;' +
        'height:2px;background:var(--accent-electric);border-radius:2px;' +
        'display:none;transition:top .06s,left .06s,width .06s'
      document.body.appendChild(dropLine)
    }
    return dropLine
  }

  function updateDropLine(view: EditorView, cx: number, cy: number) {
    const dl = getDropLine()
    const dropPos = findDropPos(view, cx, cy)
    if (dropPos === null) { dl.style.display = 'none'; return }

    // Find the reference DOM element for the line
    const $dp = view.state.doc.resolve(Math.max(0, dropPos - 1))
    let domEl: HTMLElement | null = null
    for (let d = $dp.depth; d >= 1; d--) {
      const pName = $dp.node(d - 1).type.name
      if (pName === 'doc' || pName === 'column') {
        domEl = domForNode(view, $dp.before(d)); break
      }
    }
    if (!domEl) { dl.style.display = 'none'; return }

    const r = domEl.getBoundingClientRect()
    const lineY = cy < r.top + r.height / 2 ? r.top - 1 : r.bottom - 1
    dl.style.display = 'block'
    dl.style.top    = `${lineY}px`
    dl.style.left   = `${r.left}px`
    dl.style.width  = `${r.width}px`
  }

  function showPreview(view: EditorView, nodePos: number, cx: number, cy: number) {
    if (preview) preview.remove()
    const src = domForNode(view, nodePos)
    if (!src) return
    preview = src.cloneNode(true) as HTMLElement
    const r = src.getBoundingClientRect()
    preview.style.cssText =
      `position:fixed;pointer-events:none;z-index:9999;` +
      `width:${r.width}px;max-height:120px;overflow:hidden;` +
      `opacity:.65;box-shadow:0 6px 24px rgba(0,0,0,.25);` +
      `border-radius:6px;border:1px solid var(--border-default);` +
      `background:var(--bg-surface);padding:4px 8px;` +
      `left:${cx + 12}px;top:${cy - 12}px`
    document.body.appendChild(preview)
  }

  function cleanupDrag() {
    preview?.remove(); preview = null
    const dl = getDropLine(); dl.style.display = 'none'
    drag = null
  }

  /* ── handle element ───────────────────────────────────────────── */

  function getHandle(): HTMLElement {
    if (handle) return handle
    handle = document.createElement('div')
    handle.className = 'global-drag-handle'
    handle.setAttribute('aria-hidden', 'true')
    handle.textContent = '⠿'
    document.body.appendChild(handle)

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault()               // prevent focus/selection change in editor
      if (!activeView || activePos < 0) return

      const target = resolveTarget(activeView, hLeft + H_W, hTop + H_H / 2)
      if (!target) return

      handle!.setPointerCapture(e.pointerId)
      drag = { nodePos: target.pos, node: target.node, startX: e.clientX, startY: e.clientY, started: false }
    })

    handle.addEventListener('pointermove', (e) => {
      if (!drag || !activeView) return
      const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY)
      if (!drag.started && dist > 4) {
        drag.started = true
        showPreview(activeView, drag.nodePos, e.clientX, e.clientY)
        handle!.style.cursor = 'grabbing'
      }
      if (drag.started) {
        if (preview) { preview.style.left = `${e.clientX + 12}px`; preview.style.top = `${e.clientY - 12}px` }
        updateDropLine(activeView, e.clientX, e.clientY)
      }
    })

    handle.addEventListener('pointerup', (e) => {
      if (!drag || !activeView) { cleanupDrag(); return }
      if (drag.started) {
        const dropPos = findDropPos(activeView, e.clientX, e.clientY)
        if (dropPos !== null) performMove(activeView, drag.nodePos, drag.node, dropPos)
      }
      cleanupDrag()
      handle!.style.cursor = 'grab'
    })

    handle.addEventListener('pointercancel', () => {
      cleanupDrag()
      handle!.style.cursor = 'grab'
    })

    return handle
  }

  /* ── ProseMirror plugin ───────────────────────────────────────── */

  return new Plugin({
    view(view) {
      activeView = view
      const h = getHandle()

      const onDocMouseMove = (e: MouseEvent) => {
        if (drag) return
        const rect = view.dom.getBoundingClientRect()
        const inEditor =
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom

        if (inEditor) {
          const target = resolveTarget(view, e.clientX, e.clientY)
          if (!target) { h.style.display = 'none'; return }
          const el = domForNode(view, target.pos)
          if (!el)     { h.style.display = 'none'; return }
          const r = el.getBoundingClientRect()
          activePos = target.pos
          hLeft = r.left - 26
          hTop  = r.top  + 4
          h.style.display = 'flex'
          h.style.top  = `${hTop}px`
          h.style.left = `${hLeft}px`
          return
        }

        if (h.style.display !== 'none' && !isNearHandle(e.clientX, e.clientY)) {
          h.style.display = 'none'
        }
      }

      document.addEventListener('mousemove', onDocMouseMove)

      return {
        destroy() {
          document.removeEventListener('mousemove', onDocMouseMove)
          handle?.remove();   handle   = null
          preview?.remove();  preview  = null
          dropLine?.remove(); dropLine = null
          activeView = null
        },
      }
    },
  })
}

/* ── TipTap Extension ───────────────────────────────────────────── */

export const GlobalDragHandle = Extension.create({
  name: 'globalDragHandle',
  addProseMirrorPlugins() { return [makeDragHandlePlugin()] },
})
