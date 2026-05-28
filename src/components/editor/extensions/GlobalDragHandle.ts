/**
 * GlobalDragHandle — floating ⠿ grip for any block in the editor.
 *
 * Uses Pointer Events (not native browser DnD) because:
 *   - e.preventDefault() on mousedown — needed to prevent the editor from
 *     stealing focus/selection — also cancels the native dragstart event.
 *     So native DnD never fires.
 *   - Pointer capture gives us reliable move/up events even when the cursor
 *     leaves the handle element.
 *
 * Flow:
 *   pointerdown  → snapshot the target node, capture the pointer
 *   pointermove  → after 4 px threshold, show floating preview + drop line
 *   pointerup    → dispatch a ProseMirror transaction to move the node
 *
 * Drop modes:
 *   vertical  → blue horizontal line → move block before/after another
 *   side      → blue vertical line   → create (or extend) a column layout
 */
import { Extension } from '@tiptap/core'
import { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import type { Node as PMNode } from 'prosemirror-model'

/* ── Types ──────────────────────────────────────────────────────── */

interface DragTarget { node: PMNode; pos: number }

type DropTarget =
  | { kind: 'vertical'; insertPos: number; blockStart: number; blockNode: PMNode }
  | { kind: 'side'; side: 'left' | 'right'; targetStart: number; targetNode: PMNode }

/* ── Helpers ────────────────────────────────────────────────────── */

/** Walk up the resolve chain to find the correct block to drag. */
function resolveTarget(view: EditorView, cx: number, cy: number): DragTarget | null {
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

/** px from left/right edge of a block to trigger side-drop (column) mode. */
const SIDE_ZONE = 48

/**
 * Resolve where to drop given cursor coords.
 * Returns vertical (before/after) or side (left/right column) target.
 */
function findDropTarget(view: EditorView, cx: number, cy: number): DropTarget | null {
  const hit = view.posAtCoords({ left: cx, top: cy })
  if (!hit) return null
  const $pos = view.state.doc.resolve(hit.pos)

  let blockStart = -1
  let blockNode: PMNode | null = null
  for (let d = $pos.depth; d >= 1; d--) {
    const pName = $pos.node(d - 1).type.name
    if (pName === 'doc' || pName === 'column') {
      blockStart = $pos.before(d)
      blockNode  = $pos.node(d)
      break
    }
  }
  if (blockStart < 0 || !blockNode) return null

  const domEl = domForNode(view, blockStart)
  if (!domEl) return null

  const r    = domEl.getBoundingClientRect()
  const zone = Math.min(SIDE_ZONE, r.width * 0.3)

  if (cx < r.left + zone) {
    return { kind: 'side', side: 'left', targetStart: blockStart, targetNode: blockNode }
  }
  if (cx > r.right - zone) {
    return { kind: 'side', side: 'right', targetStart: blockStart, targetNode: blockNode }
  }

  const isBefore = cy < r.top + r.height / 2
  const insertPos = isBefore ? blockStart : blockStart + blockNode.nodeSize
  return { kind: 'vertical', insertPos, blockStart, blockNode }
}

/** Move a node vertically (before/after another block). */
function performMove(
  view: EditorView,
  fromNodeStart: number,
  node: PMNode,
  toPos: number,
) {
  const nodeEnd = fromNodeStart + node.nodeSize
  if (toPos > fromNodeStart && toPos <= nodeEnd) return
  try {
    const tr = view.state.tr.delete(fromNodeStart, nodeEnd)
    tr.insert(tr.mapping.map(toPos), node)
    view.dispatch(tr)
  } catch (err) {
    console.warn('[DragHandle] move failed:', err)
  }
}

/**
 * Place `fromNode` to the left or right of `targetStart` by creating or
 * extending a ColumnList.
 *
 * Three cases:
 *   1. Target is a plain top-level block  → wrap both in a new ColumnList
 *   2. Target IS a ColumnList             → prepend / append a new Column
 *   3. Target is a block inside a Column  → insert new Column beside its Column
 */
function performSideDrop(
  view: EditorView,
  fromStart: number,
  fromNode: PMNode,
  targetStart: number,
  side: 'left' | 'right',
) {
  const { state } = view
  const { schema } = state
  const { column: colType, columnList: clType } = schema.nodes
  if (!colType || !clType) return

  const fromEnd = fromStart + fromNode.nodeSize
  if (targetStart >= fromStart && targetStart < fromEnd) return // drop onto self

  try {
    // 1. Delete the dragged node from its current position.
    const tr = state.tr.delete(fromStart, fromEnd)

    // 2. Map the target position through the deletion.
    const mappedTarget = tr.mapping.map(targetStart)
    const targetNode   = tr.doc.nodeAt(mappedTarget)
    if (!targetNode) return

    // 3. Inspect target context to decide which case we're in.
    const $t = tr.doc.resolve(mappedTarget + 1)

    // Is the target block inside a Column?
    let colDepth = -1
    for (let d = $t.depth; d >= 1; d--) {
      if ($t.node(d - 1).type.name === 'column') { colDepth = d - 1; break }
    }

    if (colDepth >= 0) {
      // ── Case 3: target is a block inside a Column ──────────────────────
      // Insert a new Column beside the Column that contains the target block.
      const clDepth = colDepth - 1          // depth of the parent ColumnList
      const clStart = $t.before(clDepth)    // pos just before the ColumnList
      const clNode  = $t.node(clDepth)      // the ColumnList node
      const colIdx  = $t.index(clDepth)     // index of the Column within ColumnList

      const newCol = colType.createAndFill(null, fromNode)
      if (!newCol) return

      const newCols: PMNode[] = []
      clNode.forEach((c, _, i) => {
        if (i === colIdx) {
          if (side === 'left') { newCols.push(newCol); newCols.push(c) }
          else                 { newCols.push(c); newCols.push(newCol) }
        } else {
          newCols.push(c)
        }
      })
      tr.replaceWith(clStart, clStart + clNode.nodeSize,
        clType.create(clNode.attrs, newCols))

    } else if (targetNode.type.name === 'columnList') {
      // ── Case 2: target IS a ColumnList → add a Column to it ────────────
      const newCol = colType.createAndFill(null, fromNode)
      if (!newCol) return
      const cols: PMNode[] = []
      targetNode.forEach(c => cols.push(c))
      if (side === 'left') cols.unshift(newCol); else cols.push(newCol)
      tr.replaceWith(mappedTarget, mappedTarget + targetNode.nodeSize,
        clType.create(targetNode.attrs, cols))

    } else {
      // ── Case 1: plain top-level block → create a new ColumnList ────────
      const newCol    = colType.createAndFill(null, fromNode)
      const targetCol = colType.createAndFill(null, targetNode)
      if (!newCol || !targetCol) return
      const [c1, c2] = side === 'left' ? [newCol, targetCol] : [targetCol, newCol]
      tr.replaceWith(mappedTarget, mappedTarget + targetNode.nodeSize,
        clType.create(null, [c1, c2]))
    }

    view.dispatch(tr)
  } catch (err) {
    console.warn('[DragHandle] side drop failed:', err)
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
    startX: number
    startY: number
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
        'background:var(--accent-electric);border-radius:2px;display:none;' +
        'transition:top .06s,left .06s,width .06s,height .06s'
      document.body.appendChild(dropLine)
    }
    return dropLine
  }

  function updateDropLine(view: EditorView, cx: number, cy: number) {
    const dl     = getDropLine()
    const target = findDropTarget(view, cx, cy)
    if (!target) { dl.style.display = 'none'; return }

    if (target.kind === 'vertical') {
      // Horizontal line above or below the reference block
      const domEl = domForNode(view, target.blockStart)
      if (!domEl) { dl.style.display = 'none'; return }
      const r     = domEl.getBoundingClientRect()
      const lineY = target.insertPos === target.blockStart ? r.top - 1 : r.bottom - 1
      dl.style.height = '2px'
      dl.style.width  = `${r.width}px`
      dl.style.top    = `${lineY}px`
      dl.style.left   = `${r.left}px`
    } else {
      // Vertical line on the left or right edge of the target block
      const domEl = domForNode(view, target.targetStart)
      if (!domEl) { dl.style.display = 'none'; return }
      const r = domEl.getBoundingClientRect()
      dl.style.height = `${r.height}px`
      dl.style.width  = '2px'
      dl.style.top    = `${r.top}px`
      dl.style.left   = target.side === 'left' ? `${r.left - 1}px` : `${r.right - 1}px`
    }
    dl.style.display = 'block'
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
    getDropLine().style.display = 'none'
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
      e.preventDefault()
      if (!activeView || activePos < 0) return
      const target = resolveTarget(activeView, hLeft + H_W, hTop + H_H / 2)
      if (!target) return
      handle!.setPointerCapture(e.pointerId)
      drag = {
        nodePos: target.pos, node: target.node,
        startX: e.clientX, startY: e.clientY, started: false,
      }
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
        if (preview) {
          preview.style.left = `${e.clientX + 12}px`
          preview.style.top  = `${e.clientY - 12}px`
        }
        updateDropLine(activeView, e.clientX, e.clientY)
      }
    })

    handle.addEventListener('pointerup', (e) => {
      if (!drag || !activeView) { cleanupDrag(); return }
      if (drag.started) {
        const dropTarget = findDropTarget(activeView, e.clientX, e.clientY)
        if (dropTarget) {
          if (dropTarget.kind === 'vertical') {
            performMove(activeView, drag.nodePos, drag.node, dropTarget.insertPos)
          } else {
            performSideDrop(
              activeView, drag.nodePos, drag.node,
              dropTarget.targetStart, dropTarget.side,
            )
          }
        }
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
