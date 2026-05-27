import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import type { Note } from '../../lib/db'
import { Editor } from '../editor/Editor'
import { getGraph, type GraphEdge } from '../../lib/db'

// ─── Folder metadata ────────────────────────────────────────────────────────
const FOLDER_COLOR: Record<string, string> = {
  inbox:        'var(--accent-terracotta)',
  método:       'var(--accent-terracotta)',
  técnico:      'var(--accent-emerald)',
  pessoas:      'var(--accent-electric)',
  ferramentas:  'var(--accent-amber)',
}
const FOLDER_LABEL: Record<string, string> = {
  inbox: 'Inbox', método: 'Método', técnico: 'Técnico',
  pessoas: 'Pessoas', ferramentas: 'Ferramentas',
}

// ─── Card / frame colour options ─────────────────────────────────────────────
const CARD_COLOR_OPTIONS = [
  { key: '',         label: 'padrão',   bg: '',                          dot: 'transparent'  },
  { key: 'clay',     label: 'argila',   bg: 'rgba(220,  90,  70, 0.12)', dot: '#DC5A46'      },
  { key: 'cobalt',   label: 'cobalto',  bg: 'rgba( 60, 120, 220, 0.12)', dot: '#3C78DC'      },
  { key: 'sage',     label: 'sálvia',   bg: 'rgba( 70, 185, 120, 0.12)', dot: '#46B978'      },
  { key: 'honey',    label: 'mel',      bg: 'rgba(210, 165,  50, 0.12)', dot: '#D2A532'      },
  { key: 'lavender', label: 'lavanda',  bg: 'rgba(155,  95, 210, 0.12)', dot: '#9B5FD2'      },
] as const

// ─── Types ───────────────────────────────────────────────────────────────────
interface Frame {
  id: string; title: string
  x: number; y: number; w: number; h: number
  color: string
}
interface ManualEdge { id: string; aId: string; bId: string }
interface EdgePathEx  { d: string; isManual: boolean; edgeId: string }
interface DragState   { id: string; startClientX: number; startClientY: number; startPosX: number; startPosY: number }
interface ResizeState { id: string; startClientX: number; startClientY: number; startW: number; startH: number }
interface NodeSize    { w: number; h: number }

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SIZES_KEY        = 'excursus-spatial-sizes'
const CARD_COLORS_KEY  = 'excursus-spatial-card-colors'
const FRAMES_KEY       = 'excursus-spatial-frames'
const MANUAL_EDGES_KEY = 'excursus-spatial-manual-edges'

// ─── Layout constants ─────────────────────────────────────────────────────────
const FLOW_NODE_W = 320, FLOW_NODE_H = 260, FLOW_H_GAP = 140, FLOW_V_GAP = 56
const GRID_COLS   = 3,   GRID_H_GAP  =  60, GRID_V_GAP  =  48
const MM_W = 160, MM_H = 96

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadLS<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}
function isNoteInFrame(note: Note, frame: Frame, sizes: Record<string, NodeSize>): boolean {
  const nw = sizes[note.id]?.w ?? note.posW, nh = sizes[note.id]?.h ?? 200
  const cx = note.posX + nw / 2, cy = note.posY + nh / 2
  return cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h
}

// ─── Component ────────────────────────────────────────────────────────────────
export function SpatialMode() {
  const { notes, activeNoteId, setActiveNote, moveNote, createNote, saveNoteContent, contentCache } = useNotesStore()

  // ── Core state ──
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft,    setTitleDraft]    = useState('')
  const [zoom,          setZoom]          = useState(0.75)
  const [pan,           setPan]           = useState({ x: 0, y: 0 })
  const [draggingId,    setDraggingId]    = useState<string | null>(null)
  const [resizingId,    setResizingId]    = useState<string | null>(null)
  const [panStart,      setPanStart]      = useState<{ x: number; y: number } | null>(null)
  const [edges,         setEdges]         = useState<GraphEdge[]>([])
  const [localSizes,    setLocalSizes]    = useState<Record<string, NodeSize>>(() => loadLS(SIZES_KEY, {}))
  const [folderFilter,  setFolderFilter]  = useState<string | null>(null)
  const [stageSize,     setStageSize]     = useState({ w: 1200, h: 700 })

  // ── Card colours ──
  const [cardColors,    setCardColors]    = useState<Record<string, string>>(() => loadLS(CARD_COLORS_KEY, {}))
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  // ── Lasso ──
  const [lassoMode,   setLassoMode]   = useState(false)
  const [lassoRect,   setLassoRect]   = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Frames ──
  const [frames,         setFrames]         = useState<Frame[]>(() => loadLS(FRAMES_KEY, []))
  const [frameMode,      setFrameMode]      = useState(false)
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null)

  // ── Manual connections ──
  const [manualEdges, setManualEdges] = useState<ManualEdge[]>(() => loadLS(MANUAL_EDGES_KEY, []))
  const [connectMode, setConnectMode] = useState(false)
  const [connectLine, setConnectLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  // ── Refs ──
  const stageRef       = useRef<HTMLDivElement>(null)
  const dragRef        = useRef<DragState | null>(null)
  const resizeRef      = useRef<ResizeState | null>(null)
  const multiDragRef   = useRef<{ startPositions: Record<string, { x: number; y: number }> } | null>(null)
  const zoomRef        = useRef(zoom)
  const activePtrs     = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchDistRef   = useRef<number | null>(null)
  // Fresh-value refs (for stale closures in imperative handlers)
  const visibleNotesRef  = useRef<Note[]>([])
  const localSizesRef    = useRef<Record<string, NodeSize>>({})
  const manualEdgesRef   = useRef<ManualEdge[]>([])

  // ── Persist effects ──
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { try { localStorage.setItem(SIZES_KEY,        JSON.stringify(localSizes))  } catch {} }, [localSizes])
  useEffect(() => { try { localStorage.setItem(CARD_COLORS_KEY,  JSON.stringify(cardColors))  } catch {} }, [cardColors])
  useEffect(() => { try { localStorage.setItem(FRAMES_KEY,       JSON.stringify(frames))      } catch {} }, [frames])
  useEffect(() => { try { localStorage.setItem(MANUAL_EDGES_KEY, JSON.stringify(manualEdges)) } catch {} }, [manualEdges])
  useEffect(() => { getGraph().then(g => setEdges(g.edges.filter(e => e.kind === 'explicit'))) }, [notes])

  // ── Stage size (minimap) ──
  useEffect(() => {
    const el = stageRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el); return () => ro.disconnect()
  }, [])

  // ── Close colour picker on outside click ──
  useEffect(() => {
    if (!colorPickerId) return
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.spatial__color-picker') &&
          !(e.target as HTMLElement).closest('.spatial__node__bar-color')) setColorPickerId(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [colorPickerId])

  // ── ESC: cancel all modes ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setLassoMode(false); setFrameMode(false); setConnectMode(false)
      setSelectedIds(new Set()); setLassoRect(null); setConnectLine(null)
      setColorPickerId(null); setEditingFrameId(null)
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Derived ──
  const folders = useMemo(() => [...new Set(notes.map(n => n.folder))], [notes])
  const folderCounts = useMemo(() => {
    const c: Record<string, number> = {}
    notes.forEach(n => { c[n.folder] = (c[n.folder] ?? 0) + 1 }); return c
  }, [notes])
  const visibleNotes = useMemo(
    () => folderFilter ? notes.filter(n => n.folder === folderFilter) : notes,
    [notes, folderFilter]
  )

  // Keep refs fresh
  useEffect(() => { visibleNotesRef.current = visibleNotes }, [visibleNotes])
  useEffect(() => { localSizesRef.current   = localSizes   }, [localSizes])
  useEffect(() => { manualEdgesRef.current  = manualEdges  }, [manualEdges])

  // ── Edge paths (wiki-link + manual) ──
  const edgePaths = useMemo<EdgePathEx[]>(() => {
    const visIds = new Set(visibleNotes.map(n => n.id))
    const result: EdgePathEx[] = []
    const path = (aId: string, bId: string) => {
      const A = visibleNotes.find(n => n.id === aId), B = visibleNotes.find(n => n.id === bId)
      if (!A || !B) return null
      const aw = localSizes[A.id]?.w ?? A.posW, bw = localSizes[B.id]?.w ?? B.posW
      const ax = A.posX + aw / 2, ay = A.posY + 40, bx = B.posX + bw / 2, by = B.posY + 40
      const dx = (bx - ax) * 0.4
      return `M ${ax} ${ay} C ${ax+dx} ${ay}, ${bx-dx} ${by}, ${bx} ${by}`
    }
    for (const e of edges) {
      if (!visIds.has(e.aId) || !visIds.has(e.bId)) continue
      const d = path(e.aId, e.bId); if (d) result.push({ d, isManual: false, edgeId: '' })
    }
    for (const e of manualEdges) {
      if (!visIds.has(e.aId) || !visIds.has(e.bId)) continue
      const d = path(e.aId, e.bId); if (d) result.push({ d, isManual: true, edgeId: e.id })
    }
    return result
  }, [visibleNotes, edges, manualEdges, localSizes])

  // ── Minimap ──
  const minimapBounds = useMemo(() => {
    if (!visibleNotes.length) return { minX: 0, minY: 0, maxX: 2000, maxY: 1200 }
    const pad = 80
    const xs = visibleNotes.flatMap(n => { const nw = localSizes[n.id]?.w ?? n.posW; return [n.posX, n.posX + nw] })
    const ys = visibleNotes.flatMap(n => { const nh = localSizes[n.id]?.h ?? 200;    return [n.posY, n.posY + nh] })
    return { minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad, maxX: Math.max(...xs) + pad, maxY: Math.max(...ys) + pad }
  }, [visibleNotes, localSizes])
  const minimapScale = useMemo(() => Math.min(
    MM_W / (minimapBounds.maxX - minimapBounds.minX),
    MM_H / (minimapBounds.maxY - minimapBounds.minY),
  ), [minimapBounds])
  const onMinimapClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const cx = (e.clientX - r.left) / minimapScale + minimapBounds.minX
    const cy = (e.clientY - r.top)  / minimapScale + minimapBounds.minY
    setPan({ x: -cx * zoom + stageSize.w / 2, y: -cy * zoom + stageSize.h / 2 })
  }, [minimapScale, minimapBounds, zoom, stageSize])

  // ─────────────────────────────────────────────────────────────────────────────
  // Imperative pointer handlers (all use inline event listeners for fresh closure)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Stage background pointerdown: lasso, frame creation, or pan */
  const onStageDown = (e: React.PointerEvent) => {
    const isStage = e.target === stageRef.current || (e.target as HTMLElement).classList.contains('spatial__grid')
    if (!isStage) return
    activePtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const capPan = pan, capZoom = zoom

    // ── Frame creation ──
    if (frameMode && activePtrs.current.size === 1) {
      const sr = stageRef.current!.getBoundingClientRect()
      const sx = (e.clientX - sr.left - capPan.x) / capZoom
      const sy = (e.clientY - sr.top  - capPan.y) / capZoom
      setLassoRect({ x1: sx, y1: sy, x2: sx, y2: sy })
      const move = (ev: PointerEvent) => {
        const s = stageRef.current!.getBoundingClientRect()
        setLassoRect({ x1: sx, y1: sy, x2: (ev.clientX - s.left - capPan.x) / capZoom, y2: (ev.clientY - s.top - capPan.y) / capZoom })
      }
      const up = (ev: PointerEvent) => {
        const s = stageRef.current!.getBoundingClientRect()
        const ex = (ev.clientX - s.left - capPan.x) / capZoom, ey = (ev.clientY - s.top - capPan.y) / capZoom
        const x1 = Math.min(sx, ex), x2 = Math.max(sx, ex), y1 = Math.min(sy, ey), y2 = Math.max(sy, ey)
        if (x2 - x1 > 60 && y2 - y1 > 60) {
          setFrames(fs => [...fs, { id: crypto.randomUUID(), title: 'Grupo', x: x1, y: y1, w: x2 - x1, h: y2 - y1, color: '' }])
        }
        setLassoRect(null)
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
      return
    }

    // ── Lasso selection ──
    if (lassoMode && activePtrs.current.size === 1) {
      const sr = stageRef.current!.getBoundingClientRect()
      const sx = (e.clientX - sr.left - capPan.x) / capZoom
      const sy = (e.clientY - sr.top  - capPan.y) / capZoom
      setLassoRect({ x1: sx, y1: sy, x2: sx, y2: sy })
      const move = (ev: PointerEvent) => {
        const s = stageRef.current!.getBoundingClientRect()
        setLassoRect({ x1: sx, y1: sy, x2: (ev.clientX - s.left - capPan.x) / capZoom, y2: (ev.clientY - s.top - capPan.y) / capZoom })
      }
      const up = (ev: PointerEvent) => {
        const s = stageRef.current!.getBoundingClientRect()
        const ex = (ev.clientX - s.left - capPan.x) / capZoom, ey = (ev.clientY - s.top - capPan.y) / capZoom
        const rx1 = Math.min(sx, ex), rx2 = Math.max(sx, ex), ry1 = Math.min(sy, ey), ry2 = Math.max(sy, ey)
        const inside = visibleNotesRef.current.filter(n => {
          const nw = localSizesRef.current[n.id]?.w ?? n.posW, nh = localSizesRef.current[n.id]?.h ?? 200
          return n.posX < rx2 && n.posX + nw > rx1 && n.posY < ry2 && n.posY + nh > ry1
        })
        setSelectedIds(new Set(inside.map(n => n.id)))
        setLassoRect(null)
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
      return
    }

    // ── Pan ──
    if (activePtrs.current.size === 1) {
      setSelectedIds(new Set())
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  /** Frame header drag: moves frame + notes inside */
  const onFrameHeaderDown = (e: React.PointerEvent, frameId: string) => {
    e.stopPropagation(); e.preventDefault()
    const frame = frames.find(f => f.id === frameId); if (!frame) return
    const startClientX = e.clientX, startClientY = e.clientY
    const startFX = frame.x, startFY = frame.y
    const capZoom = zoom
    // Capture which notes are inside at drag start (current closure values are fresh)
    const noteStarts: Record<string, { x: number; y: number }> = {}
    for (const note of visibleNotes) {
      if (isNoteInFrame(note, frame, localSizes))
        noteStarts[note.id] = { x: note.posX, y: note.posY }
    }
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / capZoom, dy = (ev.clientY - startClientY) / capZoom
      setFrames(fs => fs.map(f => f.id === frameId ? { ...f, x: startFX + dx, y: startFY + dy } : f))
      for (const [id, sp] of Object.entries(noteStarts)) moveNote(id, sp.x + dx, sp.y + dy, true)
    }
    const up = (ev: PointerEvent) => {
      const dx = (ev.clientX - startClientX) / capZoom, dy = (ev.clientY - startClientY) / capZoom
      setFrames(fs => fs.map(f => f.id === frameId ? { ...f, x: startFX + dx, y: startFY + dy } : f))
      for (const [id, sp] of Object.entries(noteStarts)) moveNote(id, sp.x + dx, sp.y + dy, false)
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  /** Frame resize handle */
  const onFrameResizeDown = (e: React.PointerEvent, frameId: string) => {
    e.stopPropagation(); e.preventDefault()
    const frame = frames.find(f => f.id === frameId); if (!frame) return
    const startClientX = e.clientX, startClientY = e.clientY
    const startW = frame.w, startH = frame.h, capZoom = zoom
    const move = (ev: PointerEvent) => {
      setFrames(fs => fs.map(f => f.id === frameId ? {
        ...f,
        w: Math.max(120, startW + (ev.clientX - startClientX) / capZoom),
        h: Math.max(80,  startH + (ev.clientY - startClientY) / capZoom),
      } : f))
    }
    const up = (ev: PointerEvent) => {
      move(ev)
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  /** Connection port drag: creates a manual edge */
  const onPortDown = (e: React.PointerEvent, noteId: string, side: 'left' | 'right') => {
    e.stopPropagation(); e.preventDefault()
    const note = visibleNotes.find(n => n.id === noteId); if (!note) return
    const nw   = localSizes[noteId]?.w ?? note.posW, nh = localSizes[noteId]?.h ?? 200
    const portX = side === 'left' ? note.posX : note.posX + nw
    const portY = note.posY + nh / 2
    const capPan = pan, capZoom = zoom
    setConnectLine({ x1: portX, y1: portY, x2: portX, y2: portY })
    const move = (ev: PointerEvent) => {
      const s = stageRef.current!.getBoundingClientRect()
      setConnectLine({ x1: portX, y1: portY,
        x2: (ev.clientX - s.left - capPan.x) / capZoom,
        y2: (ev.clientY - s.top  - capPan.y) / capZoom })
    }
    const up = (ev: PointerEvent) => {
      const s  = stageRef.current!.getBoundingClientRect()
      const cx = (ev.clientX - s.left - capPan.x) / capZoom
      const cy = (ev.clientY - s.top  - capPan.y) / capZoom
      const target = visibleNotesRef.current.find(n => {
        if (n.id === noteId) return false
        const tnw = localSizesRef.current[n.id]?.w ?? n.posW, tnh = localSizesRef.current[n.id]?.h ?? 200
        return cx >= n.posX && cx <= n.posX + tnw && cy >= n.posY && cy <= n.posY + tnh
      })
      if (target) {
        const dupe = manualEdgesRef.current.some(ex =>
          (ex.aId === noteId && ex.bId === target.id) || (ex.aId === target.id && ex.bId === noteId))
        if (!dupe) setManualEdges(me => [...me, { id: crypto.randomUUID(), aId: noteId, bId: target.id }])
      }
      setConnectLine(null)
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  /** Note card drag (single or multi) */
  const onNodeDown = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest('[contenteditable]')) return
    if ((e.target as HTMLElement).closest('.spatial__node__resize')) return
    if ((e.target as HTMLElement).closest('.spatial__port')) return
    const note = notes.find(n => n.id === id); if (!note) return
    if (selectedIds.has(id) && selectedIds.size > 1) {
      const startPositions: Record<string, { x: number; y: number }> = {}
      for (const selId of selectedIds) {
        const sn = notes.find(n => n.id === selId)
        if (sn) startPositions[selId] = { x: sn.posX, y: sn.posY }
      }
      multiDragRef.current = { startPositions }
    } else {
      if (!selectedIds.has(id)) setSelectedIds(new Set())
      multiDragRef.current = null
    }
    dragRef.current = { id, startClientX: e.clientX, startClientY: e.clientY, startPosX: note.posX, startPosY: note.posY }
    setDraggingId(id); e.stopPropagation(); e.preventDefault()
  }

  const onResizeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); e.preventDefault()
    const note = notes.find(n => n.id === id)!
    const sz   = localSizes[id]
    resizeRef.current = { id, startClientX: e.clientX, startClientY: e.clientY,
      startW: sz?.w ?? note.posW ?? FLOW_NODE_W, startH: sz?.h ?? 200 }
    setResizingId(id)
  }

  // ── Pan/pinch effect ──
  useEffect(() => {
    if (!panStart) return
    const move = (e: PointerEvent) => {
      activePtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pts = Array.from(activePtrs.current.values())
      if (pts.length >= 2) {
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
        if (pinchDistRef.current !== null) setZoom(z => Math.max(0.3, Math.min(1.6, z * dist / pinchDistRef.current!)))
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
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [panStart])

  // ── Wheel zoom ──
  useEffect(() => {
    const el = stageRef.current; if (!el) return
    const fn = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(1.6, z - e.deltaY * 0.002))) }
      else setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
    }
    el.addEventListener('wheel', fn, { passive: false }); return () => el.removeEventListener('wheel', fn)
  }, [])

  // ── Node drag + resize effect ──
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragRef.current) {
        const { id, startClientX, startClientY, startPosX, startPosY } = dragRef.current
        const z = zoomRef.current, dx = (e.clientX - startClientX) / z, dy = (e.clientY - startClientY) / z
        if (multiDragRef.current)
          for (const [sel, sp] of Object.entries(multiDragRef.current.startPositions)) moveNote(sel, sp.x + dx, sp.y + dy, true)
        else moveNote(id, startPosX + dx, startPosY + dy, true)
      }
      if (resizeRef.current) {
        const { id, startClientX, startClientY, startW, startH } = resizeRef.current; const z = zoomRef.current
        setLocalSizes(s => ({ ...s, [id]: { w: Math.max(240, startW + (e.clientX - startClientX) / z), h: Math.max(100, startH + (e.clientY - startClientY) / z) } }))
      }
    }
    const up = (e: PointerEvent) => {
      if (dragRef.current) {
        const { id, startClientX, startClientY, startPosX, startPosY } = dragRef.current
        const z = zoomRef.current, dx = (e.clientX - startClientX) / z, dy = (e.clientY - startClientY) / z
        if (multiDragRef.current) { for (const [sel, sp] of Object.entries(multiDragRef.current.startPositions)) moveNote(sel, sp.x + dx, sp.y + dy, false); multiDragRef.current = null }
        else moveNote(id, startPosX + dx, startPosY + dy, false)
        dragRef.current = null; setDraggingId(null)
      }
      if (resizeRef.current) { resizeRef.current = null; setResizingId(null) }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [moveNote])

  // ── Double-click creates note ──
  const onStageDblClick = async (e: React.MouseEvent) => {
    if (e.target !== stageRef.current && !(e.target as HTMLElement).classList.contains('spatial__grid')) return
    const sr = stageRef.current!.getBoundingClientRect()
    await createNote('Sem título', 'inbox', (e.clientX - sr.left - pan.x) / zoom, (e.clientY - sr.top - pan.y) / zoom)
  }

  // ── Flow layout ──
  const handleFlowLayout = useCallback(() => {
    const visIds = new Set(visibleNotes.map(n => n.id))
    const visEdges = edges.filter(e => visIds.has(e.aId) && visIds.has(e.bId))
    if (visEdges.length > 0) {
      const out = new Map<string, string[]>(), inc = new Map<string, number>()
      for (const n of visibleNotes) { out.set(n.id, []); inc.set(n.id, 0) }
      for (const e of visEdges) { out.get(e.aId)?.push(e.bId); inc.set(e.bId, (inc.get(e.bId) ?? 0) + 1) }
      const level = new Map<string, number>(), queue: string[] = []
      for (const n of visibleNotes) if ((inc.get(n.id) ?? 0) === 0) { level.set(n.id, 0); queue.push(n.id) }
      if (!queue.length) visibleNotes.forEach(n => { level.set(n.id, 0); queue.push(n.id) })
      let qi = 0
      while (qi < queue.length) {
        const id = queue[qi++], l = level.get(id)!
        for (const nx of out.get(id) ?? []) { if (!level.has(nx) || level.get(nx)! < l + 1) { const isNew = !level.has(nx); level.set(nx, l + 1); if (isNew) queue.push(nx) } }
      }
      for (const n of visibleNotes) if (!level.has(n.id)) level.set(n.id, 0)
      const byLevel = new Map<number, string[]>()
      for (const [id, l] of level) { if (!byLevel.has(l)) byLevel.set(l, []); byLevel.get(l)!.push(id) }
      const maxColH = Math.max(...Array.from(byLevel.values()).map(ids => ids.length * FLOW_NODE_H + (ids.length - 1) * FLOW_V_GAP), 0)
      for (const [l, ids] of byLevel) {
        const startY = 80 + (maxColH - ids.length * FLOW_NODE_H - (ids.length - 1) * FLOW_V_GAP) / 2
        ids.forEach((id, i) => moveNote(id, 80 + l * (FLOW_NODE_W + FLOW_H_GAP), startY + i * (FLOW_NODE_H + FLOW_V_GAP), false))
      }
    } else {
      const fl = [...new Set(visibleNotes.map(n => n.folder))]; let gx = 80
      for (const f of fl) {
        const g = visibleNotes.filter(n => n.folder === f)
        g.forEach((n, i) => moveNote(n.id, gx + (i % GRID_COLS) * (FLOW_NODE_W + GRID_H_GAP), 80 + Math.floor(i / GRID_COLS) * (FLOW_NODE_H + GRID_V_GAP), false))
        gx += Math.min(g.length, GRID_COLS) * (FLOW_NODE_W + GRID_H_GAP) + 140
      }
    }
  }, [visibleNotes, edges, moveNote])

  // ── Minimap viewport rect ──
  const vpLeft   = (-pan.x / zoom - minimapBounds.minX) * minimapScale
  const vpTop    = (-pan.y / zoom - minimapBounds.minY) * minimapScale
  const vpWidth  = (stageSize.w / zoom) * minimapScale
  const vpHeight = (stageSize.h / zoom) * minimapScale

  // ── Helper: get card background ──
  const cardBg = (id: string) => CARD_COLOR_OPTIONS.find(o => o.key === (cardColors[id] ?? ''))?.bg ?? ''

  // ── Manual edge midpoints (for delete buttons) ──
  const visIds = useMemo(() => new Set(visibleNotes.map(n => n.id)), [visibleNotes])
  const manualEdgeMidpoints = useMemo(() => {
    return manualEdges.filter(e => visIds.has(e.aId) && visIds.has(e.bId)).map(e => {
      const A = visibleNotes.find(n => n.id === e.aId), B = visibleNotes.find(n => n.id === e.bId)
      if (!A || !B) return null
      const aw = localSizes[A.id]?.w ?? A.posW, bw = localSizes[B.id]?.w ?? B.posW
      return { id: e.id, mx: (A.posX + aw / 2 + B.posX + bw / 2) / 2, my: (A.posY + 40 + B.posY + 40) / 2 }
    }).filter((x): x is { id: string; mx: number; my: number } => x !== null)
  }, [manualEdges, visibleNotes, localSizes, visIds])

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="spatial" ref={stageRef} onPointerDown={onStageDown} onDoubleClick={onStageDblClick}>
      <div className="spatial__grid" />

      {/* ── Folder filter bar ── */}
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

      {/* ── Canvas ── */}
      <div className="spatial__canvas" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>

        {/* Edges SVG */}
        <svg className="spatial__edges" style={{ width: 6000, height: 4000, position: 'absolute', top: 0, left: 0 }}>
          {edgePaths.map((p, i) => (
            <path key={i} d={p.d}
              className={p.isManual ? 'spatial__edge--manual' : undefined}
            />
          ))}
          {/* Rubber-band connection line */}
          {connectLine && (
            <line x1={connectLine.x1} y1={connectLine.y1} x2={connectLine.x2} y2={connectLine.y2}
              stroke="var(--accent-electric)" strokeWidth={1.5} strokeDasharray="7 4" opacity={0.8} />
          )}
        </svg>

        {/* Lasso / frame-creation rect */}
        {lassoRect && (
          <div className={`spatial__lasso${frameMode ? ' spatial__lasso--frame' : ''}`} style={{
            left:   Math.min(lassoRect.x1, lassoRect.x2),
            top:    Math.min(lassoRect.y1, lassoRect.y2),
            width:  Math.abs(lassoRect.x2 - lassoRect.x1),
            height: Math.abs(lassoRect.y2 - lassoRect.y1),
          }} />
        )}

        {/* ── Frames (rendered below notes) ── */}
        {frames.map(frame => {
          const frameBg = CARD_COLOR_OPTIONS.find(o => o.key === frame.color)?.bg || ''
          return (
            <div key={frame.id} className="spatial__frame"
              style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h, position: 'absolute',
                ...(frameBg ? { background: frameBg } : {}) }}>
              {/* Header (drag to move) */}
              <div className="spatial__frame__header" onPointerDown={e => onFrameHeaderDown(e, frame.id)}>
                {editingFrameId === frame.id ? (
                  <input className="spatial__frame__title-input"
                    defaultValue={frame.title} autoFocus
                    onBlur={ev => {
                      setFrames(fs => fs.map(f => f.id === frame.id ? { ...f, title: ev.target.value || 'Grupo' } : f))
                      setEditingFrameId(null)
                    }}
                    onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === 'Escape') ev.currentTarget.blur(); ev.stopPropagation() }}
                    onClick={ev => ev.stopPropagation()}
                    onPointerDown={ev => ev.stopPropagation()}
                  />
                ) : (
                  <span className="spatial__frame__title"
                    onDoubleClick={ev => { ev.stopPropagation(); setEditingFrameId(frame.id) }}>
                    {frame.title}
                  </span>
                )}
                {/* Frame colour picker */}
                <div className="spatial__frame__color-row" onPointerDown={ev => ev.stopPropagation()}>
                  {CARD_COLOR_OPTIONS.map(opt => (
                    <button key={opt.key} className="spatial__color-swatch spatial__color-swatch--sm"
                      data-active={frame.color === opt.key || undefined}
                      title={opt.label}
                      onClick={ev => { ev.stopPropagation(); setFrames(fs => fs.map(f => f.id === frame.id ? { ...f, color: opt.key } : f)) }}
                      style={{ background: opt.bg || 'var(--bg-base)', border: '1px solid var(--border-strong)' }}
                    />
                  ))}
                </div>
                <button className="spatial__frame__delete"
                  onPointerDown={ev => ev.stopPropagation()}
                  onClick={ev => { ev.stopPropagation(); setFrames(fs => fs.filter(f => f.id !== frame.id)) }}>
                  ×
                </button>
              </div>
              {/* Resize handle */}
              <div className="spatial__frame__resize" onPointerDown={e => onFrameResizeDown(e, frame.id)}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )
        })}

        {/* Manual edge delete buttons (connect mode only) */}
        {connectMode && manualEdgeMidpoints.map(({ id, mx, my }) => (
          <button key={id} className="spatial__edge-delete-btn"
            style={{ left: mx - 9, top: my - 9 }}
            onPointerDown={ev => ev.stopPropagation()}
            onClick={ev => { ev.stopPropagation(); setManualEdges(me => me.filter(e => e.id !== id)) }}>
            ×
          </button>
        ))}

        {/* ── Note cards ── */}
        {visibleNotes.map(note => {
          const sz       = localSizes[note.id]
          const w        = sz?.w ?? note.posW, h = sz?.h ?? 200
          const bg       = cardBg(note.id)
          const curColor = CARD_COLOR_OPTIONS.find(o => o.key === (cardColors[note.id] ?? ''))

          return (
            <div key={note.id}
              className={[
                'spatial__node',
                activeNoteId === note.id ? 'spatial__node--focused'  : '',
                draggingId   === note.id ? 'spatial__node--dragging' : '',
                resizingId   === note.id ? 'spatial__node--resizing' : '',
                selectedIds.has(note.id) ? 'spatial__node--selected' : '',
                'spatial__node--sized',
              ].filter(Boolean).join(' ')}
              style={{ left: note.posX, top: note.posY, width: w, height: h, position: 'absolute',
                ...(bg ? { background: bg } : {}) }}
              onPointerDown={e => onNodeDown(e, note.id)}
              onClick={() => setActiveNote(note.id)}
            >
              {/* Connection ports (connect mode) */}
              {connectMode && (
                <>
                  <div className="spatial__port spatial__port--left"  onPointerDown={e => onPortDown(e, note.id, 'left')} />
                  <div className="spatial__port spatial__port--right" onPointerDown={e => onPortDown(e, note.id, 'right')} />
                </>
              )}

              <div className="spatial__node__bar">
                {editingTitleId === note.id ? (
                  <input className="spatial__node__bar-title spatial__node__bar-title--input"
                    value={titleDraft} autoFocus
                    onChange={e => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      const t = titleDraft.trim() || 'Sem título'
                      const content = contentCache[note.id] ?? { type: 'doc', content: [] }
                      saveNoteContent(note.id, t, note.folder, content)
                      setEditingTitleId(null)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingTitleId(null); e.stopPropagation() }}
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

                {/* Card colour button */}
                <button className="spatial__node__bar-color" title="Cor do card"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setColorPickerId(colorPickerId === note.id ? null : note.id) }}>
                  <span className="spatial__node__bar-color-dot" style={{ background: curColor?.dot ?? 'var(--text-faint)' }} />
                </button>
                {colorPickerId === note.id && (
                  <div className="spatial__color-picker" onPointerDown={e => e.stopPropagation()}>
                    {CARD_COLOR_OPTIONS.map(opt => (
                      <button key={opt.key} className="spatial__color-swatch"
                        data-active={cardColors[note.id] === opt.key || (!cardColors[note.id] && !opt.key) || undefined}
                        title={opt.label}
                        onClick={e => {
                          e.stopPropagation()
                          setCardColors(c => { if (!opt.key) { const n = { ...c }; delete n[note.id]; return n }; return { ...c, [note.id]: opt.key } })
                          setColorPickerId(null)
                        }}
                        style={{ background: opt.bg || 'var(--bg-base)', border: '1px solid var(--border-strong)' }}
                      />
                    ))}
                  </div>
                )}
                <span className="spatial__node__bar-grip">⠿</span>
              </div>

              <div className="spatial__node__body"><Editor noteId={note.id} /></div>
              <div className="spatial__node__resize" onPointerDown={e => onResizeDown(e, note.id)}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M9 1L1 9M9 5L5 9M9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Hint bar ── */}
      <div className="spatial__hint">
        <span className="spatial__hint--desktop">
          <kbd>scroll</kbd> pan · <kbd>⌘ scroll</kbd> zoom · arrastar · dbl-click cria
          {frameMode   ? ' · arrastar espaço vazio cria grupo · ESC cancela'   : ''}
          {lassoMode   ? ' · arrastar para selecionar · ESC cancela'            : ''}
          {connectMode ? ' · arrastar porta → nota para conectar · × remove · ESC cancela' : ''}
        </span>
        <span className="spatial__hint--mobile">1 dedo pan · 2 dedos zoom · segure para mover</span>
      </div>

      {/* ── Controls bar ── */}
      <div className="spatial__zoom">
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
        <div className="spatial__zoom-label">{Math.round(zoom * 100)}%</div>
        <button onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}>+</button>
        <button onClick={() => { setZoom(0.75); setPan({ x: 0, y: 0 }) }}>↺</button>
        <div className="spatial__zoom-sep" />

        {/* Lasso */}
        <button className={`spatial__zoom-flow${lassoMode ? ' spatial__zoom-flow--active' : ''}`}
          title="Lasso: selecionar múltiplas notas"
          onClick={() => { setLassoMode(m => !m); setFrameMode(false); setConnectMode(false); if (lassoMode) { setSelectedIds(new Set()); setLassoRect(null) } }}>
          {lassoMode ? `⬚ Lasso${selectedIds.size ? ` (${selectedIds.size})` : ''}` : '⬚ Lasso'}
        </button>
        <div className="spatial__zoom-sep" />

        {/* Frame mode */}
        <button className={`spatial__zoom-flow${frameMode ? ' spatial__zoom-flow--active' : ''}`}
          title="Grupo: arraste espaço vazio para criar um grupo"
          onClick={() => { setFrameMode(m => !m); setLassoMode(false); setConnectMode(false); setLassoRect(null) }}>
          {frameMode ? '⊡ Grupo ·' : '⊡ Grupo'}
        </button>
        <div className="spatial__zoom-sep" />

        {/* Connect mode */}
        <button className={`spatial__zoom-flow${connectMode ? ' spatial__zoom-flow--active' : ''}`}
          title="Conectar: arraste de uma porta para criar uma ligação"
          onClick={() => { setConnectMode(m => !m); setLassoMode(false); setFrameMode(false); setLassoRect(null) }}>
          {connectMode ? '⌁ Ligar ·' : '⌁ Ligar'}
        </button>
        <div className="spatial__zoom-sep" />

        <button className="spatial__zoom-flow" onClick={handleFlowLayout}
          title="Organizar por links ou pasta">⊞ Organizar</button>
      </div>

      {/* ── Minimap ── */}
      <div className="spatial__minimap" onPointerDown={e => e.stopPropagation()}>
        <svg width={MM_W} height={MM_H} style={{ display: 'block', cursor: 'crosshair' }} onClick={onMinimapClick}>
          {/* Frame rects */}
          {frames.map(f => (
            <rect key={f.id}
              x={(f.x - minimapBounds.minX) * minimapScale} y={(f.y - minimapBounds.minY) * minimapScale}
              width={Math.max(2, f.w * minimapScale)} height={Math.max(2, f.h * minimapScale)}
              fill="none" stroke="var(--border-strong)" strokeWidth="0.7" rx="1" opacity="0.5"
            />
          ))}
          {/* Note rects */}
          {visibleNotes.map(note => {
            const nw = localSizes[note.id]?.w ?? note.posW, nh = localSizes[note.id]?.h ?? 200
            return (
              <rect key={note.id}
                x={(note.posX - minimapBounds.minX) * minimapScale} y={(note.posY - minimapBounds.minY) * minimapScale}
                width={Math.max(2, nw * minimapScale)} height={Math.max(2, nh * minimapScale)}
                fill={FOLDER_COLOR[note.folder] ?? 'var(--accent-terracotta)'}
                opacity={selectedIds.has(note.id) ? 1 : 0.55} rx="1"
              />
            )
          })}
          {/* Viewport */}
          <rect x={vpLeft} y={vpTop} width={vpWidth} height={vpHeight}
            fill="none" stroke="var(--text-primary)" strokeWidth="1.5" opacity="0.4" rx="2" />
        </svg>
      </div>
    </div>
  )
}
