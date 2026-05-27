import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import { Editor } from '../editor/Editor'
import { getGraph, type GraphEdge } from '../../lib/db'

const FOLDER_COLOR: Record<string, string> = {
  inbox:        'var(--accent-terracotta)',
  método:       'var(--accent-terracotta)',
  técnico:      'var(--accent-emerald)',
  pessoas:      'var(--accent-electric)',
  ferramentas:  'var(--accent-amber)',
}
const FOLDER_LABEL: Record<string, string> = {
  inbox:        'Inbox',
  método:       'Método',
  técnico:      'Técnico',
  pessoas:      'Pessoas',
  ferramentas:  'Ferramentas',
}

// Card background colour options
const CARD_COLOR_OPTIONS = [
  { key: '',         label: 'padrão',   bg: '',                          dot: 'transparent'  },
  { key: 'clay',     label: 'argila',   bg: 'rgba(220,  90,  70, 0.12)', dot: '#DC5A46'      },
  { key: 'cobalt',   label: 'cobalto',  bg: 'rgba( 60, 120, 220, 0.12)', dot: '#3C78DC'      },
  { key: 'sage',     label: 'sálvia',   bg: 'rgba( 70, 185, 120, 0.12)', dot: '#46B978'      },
  { key: 'honey',    label: 'mel',      bg: 'rgba(210, 165,  50, 0.12)', dot: '#D2A532'      },
  { key: 'lavender', label: 'lavanda',  bg: 'rgba(155,  95, 210, 0.12)', dot: '#9B5FD2'      },
] as const

interface EdgePath { d: string }
interface DragState {
  id: string
  startClientX: number; startClientY: number
  startPosX:    number; startPosY:    number
}
interface ResizeState {
  id: string
  startClientX: number; startClientY: number
  startW: number;       startH: number
}
interface NodeSize { w: number; h: number }

const SIZES_KEY       = 'excursus-spatial-sizes'
const CARD_COLORS_KEY = 'excursus-spatial-card-colors'
const FLOW_NODE_W = 320, FLOW_NODE_H = 260, FLOW_H_GAP = 140, FLOW_V_GAP = 56
const GRID_COLS   = 3,   GRID_H_GAP  =  60, GRID_V_GAP  =  48

// Minimap fixed dimensions
const MM_W = 160, MM_H = 96

function loadSizes(): Record<string, NodeSize> {
  try { return JSON.parse(localStorage.getItem(SIZES_KEY) || '{}') } catch { return {} }
}
function loadCardColors(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CARD_COLORS_KEY) || '{}') } catch { return {} }
}

export function SpatialMode() {
  const { notes, activeNoteId, setActiveNote, moveNote, createNote, saveNoteContent, contentCache } = useNotesStore()

  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft,    setTitleDraft]    = useState('')
  const [zoom,          setZoom]          = useState(0.75)
  const [pan,           setPan]           = useState({ x: 0, y: 0 })
  const [draggingId,    setDraggingId]    = useState<string | null>(null)
  const [resizingId,    setResizingId]    = useState<string | null>(null)
  const [panStart,      setPanStart]      = useState<{ x: number; y: number } | null>(null)
  const [edges,         setEdges]         = useState<GraphEdge[]>([])
  const [localSizes,    setLocalSizes]    = useState<Record<string, NodeSize>>(loadSizes)
  const [folderFilter,  setFolderFilter]  = useState<string | null>(null)
  const [stageSize,     setStageSize]     = useState({ w: 1200, h: 700 })

  // Card colours
  const [cardColors,    setCardColors]    = useState<Record<string, string>>(loadCardColors)
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  // Lasso multi-selection
  const [lassoMode,   setLassoMode]   = useState(false)
  const [lassoRect,   setLassoRect]   = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Refs
  const stageRef     = useRef<HTMLDivElement>(null)
  const dragRef      = useRef<DragState | null>(null)
  const resizeRef    = useRef<ResizeState | null>(null)
  const multiDragRef = useRef<{ startPositions: Record<string, { x: number; y: number }> } | null>(null)
  const zoomRef      = useRef(zoom)
  const activePtrs   = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchDistRef = useRef<number | null>(null)
  // Fresh-value refs (for use in stale closures)
  const visibleNotesRef = useRef<ReturnType<typeof Array.prototype.filter>>([])
  const localSizesRef   = useRef<Record<string, NodeSize>>({})

  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { try { localStorage.setItem(SIZES_KEY,       JSON.stringify(localSizes))  } catch {} }, [localSizes])
  useEffect(() => { try { localStorage.setItem(CARD_COLORS_KEY, JSON.stringify(cardColors))  } catch {} }, [cardColors])
  useEffect(() => { getGraph().then(g => setEdges(g.edges.filter(e => e.kind === 'explicit'))) }, [notes])

  // Stage resize observer (needed for minimap viewport rect)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setStageSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Close colour picker on outside click
  useEffect(() => {
    if (!colorPickerId) return
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.spatial__color-picker') &&
          !(e.target as HTMLElement).closest('.spatial__node__bar-color')) {
        setColorPickerId(null)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [colorPickerId])

  // ESC: exit lasso / clear selection / close picker
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setLassoMode(false); setSelectedIds(new Set()); setLassoRect(null); setColorPickerId(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  /* ── Derived: folders + visible notes ── */
  const folders = useMemo(() => [...new Set(notes.map(n => n.folder))], [notes])
  const folderCounts = useMemo(() => {
    const c: Record<string, number> = {}
    notes.forEach(n => { c[n.folder] = (c[n.folder] ?? 0) + 1 })
    return c
  }, [notes])
  const visibleNotes = useMemo(
    () => folderFilter ? notes.filter(n => n.folder === folderFilter) : notes,
    [notes, folderFilter]
  )

  // Keep refs in sync
  useEffect(() => { visibleNotesRef.current = visibleNotes }, [visibleNotes])
  useEffect(() => { localSizesRef.current   = localSizes   }, [localSizes])

  /* ── Edge paths ── */
  const edgePaths: EdgePath[] = useMemo(() => {
    const visIds = new Set(visibleNotes.map(n => n.id))
    return edges
      .filter(e => visIds.has(e.aId) && visIds.has(e.bId))
      .map(edge => {
        const A = visibleNotes.find(n => n.id === edge.aId)
        const B = visibleNotes.find(n => n.id === edge.bId)
        if (!A || !B) return null
        const aw = localSizes[A.id]?.w ?? A.posW
        const bw = localSizes[B.id]?.w ?? B.posW
        const ax = A.posX + aw / 2, ay = A.posY + 40
        const bx = B.posX + bw / 2, by = B.posY + 40
        const dx = (bx - ax) * 0.4
        return { d: `M ${ax} ${ay} C ${ax+dx} ${ay}, ${bx-dx} ${by}, ${bx} ${by}` }
      }).filter((p): p is EdgePath => p !== null)
  }, [visibleNotes, edges, localSizes])

  /* ── Minimap ── */
  const minimapBounds = useMemo(() => {
    if (!visibleNotes.length) return { minX: 0, minY: 0, maxX: 2000, maxY: 1200 }
    const pad = 80
    const xs = visibleNotes.flatMap(n => { const nw = localSizes[n.id]?.w ?? n.posW; return [n.posX, n.posX + nw] })
    const ys = visibleNotes.flatMap(n => { const nh = localSizes[n.id]?.h ?? 200;    return [n.posY, n.posY + nh] })
    return { minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad, maxX: Math.max(...xs) + pad, maxY: Math.max(...ys) + pad }
  }, [visibleNotes, localSizes])

  const minimapScale = useMemo(() => {
    const sx = MM_W / (minimapBounds.maxX - minimapBounds.minX)
    const sy = MM_H / (minimapBounds.maxY - minimapBounds.minY)
    return Math.min(sx, sy)
  }, [minimapBounds])

  const onMinimapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect()
    const cx = (e.clientX - svgRect.left) / minimapScale + minimapBounds.minX
    const cy = (e.clientY - svgRect.top)  / minimapScale + minimapBounds.minY
    setPan({ x: -cx * zoom + stageSize.w / 2, y: -cy * zoom + stageSize.h / 2 })
  }, [minimapScale, minimapBounds, zoom, stageSize])

  /* ── pan (1 finger) + pinch-to-zoom (2 fingers) ── */
  const onStageDown = (e: React.PointerEvent) => {
    if (e.target !== stageRef.current && !(e.target as HTMLElement).classList.contains('spatial__grid')) return
    activePtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (lassoMode && activePtrs.current.size === 1) {
      // ── Lasso: capture current pan/zoom so move/up handlers don't go stale ──
      const capPan = pan, capZoom = zoom
      const stageRect = stageRef.current!.getBoundingClientRect()
      const startCx = (e.clientX - stageRect.left - capPan.x) / capZoom
      const startCy = (e.clientY - stageRect.top  - capPan.y) / capZoom
      setLassoRect({ x1: startCx, y1: startCy, x2: startCx, y2: startCy })

      const move = (ev: PointerEvent) => {
        const sr = stageRef.current!.getBoundingClientRect()
        const cx = (ev.clientX - sr.left - capPan.x) / capZoom
        const cy = (ev.clientY - sr.top  - capPan.y) / capZoom
        setLassoRect({ x1: startCx, y1: startCy, x2: cx, y2: cy })
      }
      const up = (ev: PointerEvent) => {
        const sr  = stageRef.current!.getBoundingClientRect()
        const cx  = (ev.clientX - sr.left - capPan.x) / capZoom
        const cy  = (ev.clientY - sr.top  - capPan.y) / capZoom
        const r   = { x1: startCx, y1: startCy, x2: cx, y2: cy }
        const rx1 = Math.min(r.x1, r.x2), rx2 = Math.max(r.x1, r.x2)
        const ry1 = Math.min(r.y1, r.y2), ry2 = Math.max(r.y1, r.y2)
        const inside = visibleNotesRef.current.filter((n: typeof visibleNotes[number]) => {
          const nw = localSizesRef.current[n.id]?.w ?? n.posW
          const nh = localSizesRef.current[n.id]?.h ?? 200
          return n.posX < rx2 && n.posX + nw > rx1 && n.posY < ry2 && n.posY + nh > ry1
        })
        setSelectedIds(new Set(inside.map((n: typeof visibleNotes[number]) => n.id)))
        setLassoRect(null)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      return
    }

    if (activePtrs.current.size === 1) {
      setSelectedIds(new Set())   // clear selection on empty-space click
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  useEffect(() => {
    if (!panStart) return
    const move = (e: PointerEvent) => {
      activePtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pts = Array.from(activePtrs.current.values())
      if (pts.length >= 2) {
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
        if (pinchDistRef.current !== null) {
          const ratio = dist / pinchDistRef.current
          setZoom(z => Math.max(0.3, Math.min(1.6, z * ratio)))
        }
        pinchDistRef.current = dist
      } else {
        setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
      }
    }
    const up = (e: PointerEvent) => {
      activePtrs.current.delete(e.pointerId)
      if (activePtrs.current.size < 2) pinchDistRef.current = null
      if (activePtrs.current.size === 0) setPanStart(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup',   up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [panStart])

  /* ── wheel zoom ── */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom(z => Math.max(0.3, Math.min(1.6, z - e.deltaY * 0.002)))
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* ── node drag (with multi-drag support) ── */
  const onNodeDown = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest('[contenteditable]')) return
    if ((e.target as HTMLElement).closest('.spatial__node__resize')) return
    const note = notes.find(n => n.id === id)
    if (!note) return

    if (selectedIds.has(id) && selectedIds.size > 1) {
      // Multi-drag: record start positions of all selected notes
      const startPositions: Record<string, { x: number; y: number }> = {}
      for (const selId of selectedIds) {
        const selNote = notes.find(n => n.id === selId)
        if (selNote) startPositions[selId] = { x: selNote.posX, y: selNote.posY }
      }
      multiDragRef.current = { startPositions }
    } else {
      if (!selectedIds.has(id)) setSelectedIds(new Set())
      multiDragRef.current = null
    }

    dragRef.current = {
      id,
      startClientX: e.clientX, startClientY: e.clientY,
      startPosX: note.posX,    startPosY: note.posY,
    }
    setDraggingId(id)
    e.stopPropagation(); e.preventDefault()
  }

  const onResizeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); e.preventDefault()
    const note = notes.find(n => n.id === id)!
    const sz   = localSizes[id]
    resizeRef.current = {
      id,
      startClientX: e.clientX, startClientY: e.clientY,
      startW: sz?.w ?? note.posW ?? FLOW_NODE_W,
      startH: sz?.h ?? 200,
    }
    setResizingId(id)
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragRef.current) {
        const { id, startClientX, startClientY, startPosX, startPosY } = dragRef.current
        const z  = zoomRef.current
        const dx = (e.clientX - startClientX) / z
        const dy = (e.clientY - startClientY) / z
        if (multiDragRef.current) {
          for (const [selId, sp] of Object.entries(multiDragRef.current.startPositions))
            moveNote(selId, sp.x + dx, sp.y + dy, true)
        } else {
          moveNote(id, startPosX + dx, startPosY + dy, true)
        }
      }
      if (resizeRef.current) {
        const { id, startClientX, startClientY, startW, startH } = resizeRef.current
        const z    = zoomRef.current
        const newW = Math.max(240, startW + (e.clientX - startClientX) / z)
        const newH = Math.max(100, startH + (e.clientY - startClientY) / z)
        setLocalSizes(s => ({ ...s, [id]: { w: newW, h: newH } }))
      }
    }
    const up = (e: PointerEvent) => {
      if (dragRef.current) {
        const { id, startClientX, startClientY, startPosX, startPosY } = dragRef.current
        const z  = zoomRef.current
        const dx = (e.clientX - startClientX) / z
        const dy = (e.clientY - startClientY) / z
        if (multiDragRef.current) {
          for (const [selId, sp] of Object.entries(multiDragRef.current.startPositions))
            moveNote(selId, sp.x + dx, sp.y + dy, false)
          multiDragRef.current = null
        } else {
          moveNote(id, startPosX + dx, startPosY + dy, false)
        }
        dragRef.current = null; setDraggingId(null)
      }
      if (resizeRef.current) { resizeRef.current = null; setResizingId(null) }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup',   up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [moveNote])

  /* ── double-click creates note ── */
  const onStageDblClick = async (e: React.MouseEvent) => {
    if (e.target !== stageRef.current && !(e.target as HTMLElement).classList.contains('spatial__grid')) return
    const stage = stageRef.current!.getBoundingClientRect()
    const x = (e.clientX - stage.left - pan.x) / zoom
    const y = (e.clientY - stage.top  - pan.y) / zoom
    await createNote('Sem título', 'inbox', x, y)
  }

  /* ── Flow layout ── */
  const handleFlowLayout = useCallback(() => {
    const visIds   = new Set(visibleNotes.map(n => n.id))
    const visEdges = edges.filter(e => visIds.has(e.aId) && visIds.has(e.bId))

    if (visEdges.length > 0) {
      const out = new Map<string, string[]>(); const inc = new Map<string, number>()
      for (const n of visibleNotes) { out.set(n.id, []); inc.set(n.id, 0) }
      for (const e of visEdges) { out.get(e.aId)?.push(e.bId); inc.set(e.bId, (inc.get(e.bId) ?? 0) + 1) }
      const level = new Map<string, number>(); const queue: string[] = []
      for (const n of visibleNotes) { if ((inc.get(n.id) ?? 0) === 0) { level.set(n.id, 0); queue.push(n.id) } }
      if (queue.length === 0) visibleNotes.forEach(n => { level.set(n.id, 0); queue.push(n.id) })
      let qi = 0
      while (qi < queue.length) {
        const id = queue[qi++]; const l = level.get(id)!
        for (const next of out.get(id) ?? []) {
          if (!level.has(next) || level.get(next)! < l + 1) {
            const isNew = !level.has(next); level.set(next, l + 1); if (isNew) queue.push(next)
          }
        }
      }
      for (const n of visibleNotes) { if (!level.has(n.id)) level.set(n.id, 0) }
      const byLevel = new Map<number, string[]>()
      for (const [id, l] of level) { if (!byLevel.has(l)) byLevel.set(l, []); byLevel.get(l)!.push(id) }
      const maxColH = Math.max(...Array.from(byLevel.values()).map(ids => ids.length * FLOW_NODE_H + (ids.length - 1) * FLOW_V_GAP), 0)
      for (const [l, ids] of byLevel) {
        const colH = ids.length * FLOW_NODE_H + (ids.length - 1) * FLOW_V_GAP
        const startY = 80 + (maxColH - colH) / 2
        ids.forEach((id, i) => moveNote(id, 80 + l * (FLOW_NODE_W + FLOW_H_GAP), startY + i * (FLOW_NODE_H + FLOW_V_GAP), false))
      }
    } else {
      const folderList = [...new Set(visibleNotes.map(n => n.folder))]; let groupX = 80
      for (const folder of folderList) {
        const group = visibleNotes.filter(n => n.folder === folder)
        group.forEach((n, i) => moveNote(n.id, groupX + (i % GRID_COLS) * (FLOW_NODE_W + GRID_H_GAP), 80 + Math.floor(i / GRID_COLS) * (FLOW_NODE_H + GRID_V_GAP), false))
        groupX += Math.min(group.length, GRID_COLS) * (FLOW_NODE_W + GRID_H_GAP) + 140
      }
    }
  }, [visibleNotes, edges, moveNote])

  // ── Helpers ──
  const cardBg = (id: string) => CARD_COLOR_OPTIONS.find(o => o.key === (cardColors[id] ?? ''))?.bg ?? ''

  // Minimap viewport rect (in minimap pixel space)
  const vpLeft   = (-pan.x / zoom - minimapBounds.minX) * minimapScale
  const vpTop    = (-pan.y / zoom - minimapBounds.minY) * minimapScale
  const vpWidth  = (stageSize.w   / zoom) * minimapScale
  const vpHeight = (stageSize.h   / zoom) * minimapScale

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="spatial" ref={stageRef} onPointerDown={onStageDown} onDoubleClick={onStageDblClick}>
      <div className="spatial__grid" />

      {/* Folder filter bar */}
      <div className="spatial__filterbar" onPointerDown={e => e.stopPropagation()}>
        <button className="spatial__filter-chip" data-active={folderFilter === null || undefined} onClick={() => setFolderFilter(null)}>
          todas <span>{notes.length}</span>
        </button>
        {folders.map(f => (
          <button key={f} className="spatial__filter-chip" data-active={folderFilter === f || undefined}
            onClick={() => setFolderFilter(folderFilter === f ? null : f)}>
            <span className="spatial__filter-chip-dot" style={{ background: FOLDER_COLOR[f] ?? 'var(--accent-terracotta)' }} />
            {FOLDER_LABEL[f] ?? f} <span>{folderCounts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="spatial__canvas" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>

        {/* Edge SVG */}
        <svg className="spatial__edges" style={{ width: 6000, height: 4000, position: 'absolute', top: 0, left: 0 }}>
          {edgePaths.map((p, i) => <path key={i} d={p.d} />)}
        </svg>

        {/* Lasso selection rect (inside canvas → auto-scaled) */}
        {lassoRect && (
          <div className="spatial__lasso" style={{
            left:   Math.min(lassoRect.x1, lassoRect.x2),
            top:    Math.min(lassoRect.y1, lassoRect.y2),
            width:  Math.abs(lassoRect.x2 - lassoRect.x1),
            height: Math.abs(lassoRect.y2 - lassoRect.y1),
          }} />
        )}

        {/* Note cards */}
        {visibleNotes.map(note => {
          const sz       = localSizes[note.id]
          const w        = sz?.w ?? note.posW
          const h        = sz?.h ?? 200
          const isActive = activeNoteId   === note.id
          const isDrag   = draggingId     === note.id
          const isResize = resizingId     === note.id
          const isSel    = selectedIds.has(note.id)
          const bg       = cardBg(note.id)
          const curColor = CARD_COLOR_OPTIONS.find(o => o.key === (cardColors[note.id] ?? ''))

          return (
            <div key={note.id}
              className={[
                'spatial__node',
                isActive ? 'spatial__node--focused'  : '',
                isDrag   ? 'spatial__node--dragging' : '',
                isResize ? 'spatial__node--resizing' : '',
                isSel    ? 'spatial__node--selected' : '',
                'spatial__node--sized',
              ].filter(Boolean).join(' ')}
              style={{ left: note.posX, top: note.posY, width: w, height: h, position: 'absolute',
                ...(bg ? { background: bg } : {}) }}
              onPointerDown={e => onNodeDown(e, note.id)}
              onClick={() => setActiveNote(note.id)}
            >
              <div className="spatial__node__bar">
                {editingTitleId === note.id ? (
                  <input
                    className="spatial__node__bar-title spatial__node__bar-title--input"
                    value={titleDraft} autoFocus
                    onChange={e => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      const t = titleDraft.trim() || 'Sem título'
                      const content = contentCache[note.id] ?? { type: 'doc', content: [] }
                      saveNoteContent(note.id, t, note.folder, content)
                      setEditingTitleId(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingTitleId(null)
                      e.stopPropagation()
                    }}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="spatial__node__bar-title" title="Duplo clique para editar"
                    onDoubleClick={e => { e.stopPropagation(); setEditingTitleId(note.id); setTitleDraft(note.title) }}>
                    {note.title}
                  </span>
                )}
                <span className="spatial__node__bar-folder">{note.folder}</span>

                {/* Colour picker button */}
                <button
                  className="spatial__node__bar-color"
                  title="Cor do card"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setColorPickerId(colorPickerId === note.id ? null : note.id) }}
                >
                  <span className="spatial__node__bar-color-dot"
                    style={{ background: curColor?.dot ?? 'var(--text-faint)' }} />
                </button>

                {/* Colour picker popup */}
                {colorPickerId === note.id && (
                  <div className="spatial__color-picker" onPointerDown={e => e.stopPropagation()}>
                    {CARD_COLOR_OPTIONS.map(opt => (
                      <button key={opt.key}
                        className="spatial__color-swatch"
                        data-active={cardColors[note.id] === opt.key || (!cardColors[note.id] && !opt.key) || undefined}
                        title={opt.label}
                        onClick={e => {
                          e.stopPropagation()
                          setCardColors(c => {
                            if (!opt.key) { const n = { ...c }; delete n[note.id]; return n }
                            return { ...c, [note.id]: opt.key }
                          })
                          setColorPickerId(null)
                        }}
                        style={{ background: opt.bg || 'var(--bg-base)', border: '1px solid var(--border-strong)' }}
                      />
                    ))}
                  </div>
                )}

                <span className="spatial__node__bar-grip">⠿</span>
              </div>

              <div className="spatial__node__body">
                <Editor noteId={note.id} />
              </div>
              <div className="spatial__node__resize" onPointerDown={e => onResizeDown(e, note.id)}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M9 1L1 9M9 5L5 9M9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hint bar */}
      <div className="spatial__hint">
        <span className="spatial__hint--desktop"><kbd>scroll</kbd> pan · <kbd>⌘ scroll</kbd> zoom · arraste · dbl-click cria{lassoMode ? ' · ESC cancela lasso' : ''}</span>
        <span className="spatial__hint--mobile">1 dedo pan · 2 dedos zoom · segure card para mover</span>
      </div>

      {/* Zoom + tool controls */}
      <div className="spatial__zoom">
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
        <div className="spatial__zoom-label">{Math.round(zoom * 100)}%</div>
        <button onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}>+</button>
        <button onClick={() => { setZoom(0.75); setPan({ x: 0, y: 0 }) }}>↺</button>
        <div className="spatial__zoom-sep" />
        <button
          className={`spatial__zoom-flow${lassoMode ? ' spatial__zoom-flow--active' : ''}`}
          title={lassoMode ? 'Sair do modo lasso (ESC)' : 'Lasso: selecionar múltiplas notas'}
          onClick={() => { setLassoMode(m => !m); if (lassoMode) { setSelectedIds(new Set()); setLassoRect(null) } }}
        >
          {lassoMode
            ? `⬚ Lasso ${selectedIds.size > 0 ? `(${selectedIds.size})` : '·'}`
            : '⬚ Lasso'}
        </button>
        <div className="spatial__zoom-sep" />
        <button className="spatial__zoom-flow" onClick={handleFlowLayout}
          title="Organizar: por links (se houver) ou por pasta">
          ⊞ Organizar
        </button>
      </div>

      {/* Minimap */}
      <div className="spatial__minimap" onPointerDown={e => e.stopPropagation()}>
        <svg width={MM_W} height={MM_H} style={{ display: 'block', cursor: 'crosshair' }}
          onClick={onMinimapClick}>
          {/* Note rects */}
          {visibleNotes.map(note => {
            const nw = localSizes[note.id]?.w ?? note.posW
            const nh = localSizes[note.id]?.h ?? 200
            const mx = (note.posX - minimapBounds.minX) * minimapScale
            const my = (note.posY - minimapBounds.minY) * minimapScale
            const mw = Math.max(2, nw * minimapScale)
            const mh = Math.max(2, nh * minimapScale)
            const fc = FOLDER_COLOR[note.folder] ?? 'var(--accent-terracotta)'
            return (
              <rect key={note.id} x={mx} y={my} width={mw} height={mh}
                fill={fc}
                opacity={selectedIds.has(note.id) ? 1 : 0.55}
                rx="1" />
            )
          })}
          {/* Viewport indicator */}
          <rect
            x={vpLeft} y={vpTop} width={vpWidth} height={vpHeight}
            fill="none" stroke="var(--text-primary)" strokeWidth="1.5" opacity="0.45" rx="2"
          />
        </svg>
      </div>
    </div>
  )
}
