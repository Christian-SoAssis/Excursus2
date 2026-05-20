import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import { Editor } from '../editor/Editor'
import { getGraph, type GraphEdge } from '../../lib/db'

interface EdgePath { d: string }
interface DragState {
  id: string
  startClientX: number; startClientY: number
  startPosX: number;    startPosY: number
}
interface ResizeState {
  id: string
  startClientX: number; startClientY: number
  startW: number;       startH: number
}
interface NodeSize { w: number; h: number }

const SIZES_KEY = 'excursus-spatial-sizes'
const FLOW_NODE_W = 320
const FLOW_NODE_H = 260
const FLOW_H_GAP  = 140
const FLOW_V_GAP  = 56
const GRID_COLS   = 3
const GRID_H_GAP  = 60
const GRID_V_GAP  = 48

function loadSizes(): Record<string, NodeSize> {
  try { return JSON.parse(localStorage.getItem(SIZES_KEY) || '{}') }
  catch { return {} }
}

export function SpatialMode() {
  const { notes, activeNoteId, setActiveNote, moveNote, createNote, saveNoteContent, contentCache } = useNotesStore()
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [zoom, setZoom] = useState(0.75)
  const [pan,  setPan]  = useState({ x: 0, y: 0 })
  const [draggingId,  setDraggingId]  = useState<string | null>(null)
  const [resizingId,  setResizingId]  = useState<string | null>(null)
  const [panStart,    setPanStart]    = useState<{ x: number; y: number } | null>(null)
  const [edges,       setEdges]       = useState<GraphEdge[]>([])
  const [localSizes,  setLocalSizes]  = useState<Record<string, NodeSize>>(loadSizes)

  const stageRef     = useRef<HTMLDivElement>(null)
  const dragRef      = useRef<DragState | null>(null)
  const resizeRef    = useRef<ResizeState | null>(null)
  const zoomRef      = useRef(zoom)
  const activePtrs   = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchDistRef = useRef<number | null>(null)

  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => {
    try { localStorage.setItem(SIZES_KEY, JSON.stringify(localSizes)) }
    catch {}
  }, [localSizes])

  useEffect(() => {
    getGraph().then(g => setEdges(g.edges.filter(e => e.kind === 'explicit')))
  }, [notes])

  /* ── pan (1 finger) + pinch-to-zoom (2 fingers) ── */
  const onStageDown = (e: React.PointerEvent) => {
    if (e.target !== stageRef.current && !(e.target as HTMLElement).classList.contains('spatial__grid')) return
    activePtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activePtrs.current.size === 1) {
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

  /* ── wheel zoom (desktop) ── */
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

  /* ── node drag + resize ── */
  const onNodeDown = (e: React.PointerEvent, id: string) => {
    if ((e.target as HTMLElement).closest('[contenteditable]')) return
    if ((e.target as HTMLElement).closest('.spatial__node__resize')) return
    const note = notes.find(n => n.id === id)
    if (!note) return
    dragRef.current = {
      id,
      startClientX: e.clientX, startClientY: e.clientY,
      startPosX: note.posX,    startPosY: note.posY,
    }
    setDraggingId(id)
    e.stopPropagation()
    e.preventDefault()
  }

  const onResizeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    const note = notes.find(n => n.id === id)!
    const sz = localSizes[id]
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
        const z = zoomRef.current
        moveNote(id, startPosX + (e.clientX - startClientX) / z, startPosY + (e.clientY - startClientY) / z, true)
      }
      if (resizeRef.current) {
        const { id, startClientX, startClientY, startW, startH } = resizeRef.current
        const z = zoomRef.current
        const newW = Math.max(240, startW + (e.clientX - startClientX) / z)
        const newH = Math.max(100, startH + (e.clientY - startClientY) / z)
        setLocalSizes(s => ({ ...s, [id]: { w: newW, h: newH } }))
      }
    }
    const up = (e: PointerEvent) => {
      if (dragRef.current) {
        const { id, startClientX, startClientY, startPosX, startPosY } = dragRef.current
        const z = zoomRef.current
        moveNote(id, startPosX + (e.clientX - startClientX) / z, startPosY + (e.clientY - startClientY) / z, false)
        dragRef.current = null
        setDraggingId(null)
      }
      if (resizeRef.current) {
        resizeRef.current = null
        setResizingId(null)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup',   up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [moveNote])

  /* ── double-click / double-tap creates note ── */
  const onStageDblClick = async (e: React.MouseEvent) => {
    if (e.target !== stageRef.current && !(e.target as HTMLElement).classList.contains('spatial__grid')) return
    const stage = stageRef.current!.getBoundingClientRect()
    const x = (e.clientX - stage.left - pan.x) / zoom
    const y = (e.clientY - stage.top  - pan.y) / zoom
    await createNote('Sem título', 'inbox', x, y)
  }

  /* ── edge paths ── */
  const edgePaths: EdgePath[] = useMemo(() => {
    return edges.map(edge => {
      const A = notes.find(n => n.id === edge.aId)
      const B = notes.find(n => n.id === edge.bId)
      if (!A || !B) return null
      const aw = localSizes[A.id]?.w ?? A.posW
      const bw = localSizes[B.id]?.w ?? B.posW
      const ax = A.posX + aw / 2, ay = A.posY + 40
      const bx = B.posX + bw / 2, by = B.posY + 40
      const dx = (bx - ax) * 0.4
      return { d: `M ${ax} ${ay} C ${ax+dx} ${ay}, ${bx-dx} ${by}, ${bx} ${by}` }
    }).filter((p): p is EdgePath => p !== null)
  }, [notes, edges, localSizes])

  /* ── flow layout (por links) ── */
  const handleFlowLayout = useCallback(() => {
    const hasLinks = edges.length > 0

    if (hasLinks) {
      const out = new Map<string, string[]>()
      const inc = new Map<string, number>()
      for (const n of notes) { out.set(n.id, []); inc.set(n.id, 0) }
      for (const e of edges) {
        out.get(e.aId)?.push(e.bId)
        inc.set(e.bId, (inc.get(e.bId) ?? 0) + 1)
      }
      const level = new Map<string, number>()
      const queue: string[] = []
      for (const n of notes) {
        if ((inc.get(n.id) ?? 0) === 0) { level.set(n.id, 0); queue.push(n.id) }
      }
      if (queue.length === 0) notes.forEach(n => { level.set(n.id, 0); queue.push(n.id) })
      let qi = 0
      while (qi < queue.length) {
        const id = queue[qi++]
        const l = level.get(id)!
        for (const next of out.get(id) ?? []) {
          if (!level.has(next) || level.get(next)! < l + 1) {
            const isNew = !level.has(next)
            level.set(next, l + 1)
            if (isNew) queue.push(next)
          }
        }
      }
      for (const n of notes) { if (!level.has(n.id)) level.set(n.id, 0) }
      const byLevel = new Map<number, string[]>()
      for (const [id, l] of level) {
        if (!byLevel.has(l)) byLevel.set(l, [])
        byLevel.get(l)!.push(id)
      }
      const maxColH = Math.max(...Array.from(byLevel.values()).map(
        ids => ids.length * FLOW_NODE_H + (ids.length - 1) * FLOW_V_GAP
      ), 0)
      for (const [l, ids] of byLevel) {
        const colH  = ids.length * FLOW_NODE_H + (ids.length - 1) * FLOW_V_GAP
        const startY = 80 + (maxColH - colH) / 2
        const x = 80 + l * (FLOW_NODE_W + FLOW_H_GAP)
        ids.forEach((id, i) => moveNote(id, x, startY + i * (FLOW_NODE_H + FLOW_V_GAP), false))
      }
    } else {
      const folders = [...new Set(notes.map(n => n.folder))]
      let groupX = 80
      for (const folder of folders) {
        const group = notes.filter(n => n.folder === folder)
        group.forEach((n, i) => {
          const col = i % GRID_COLS
          const row = Math.floor(i / GRID_COLS)
          moveNote(n.id, groupX + col * (FLOW_NODE_W + GRID_H_GAP), 80 + row * (FLOW_NODE_H + GRID_V_GAP), false)
        })
        const cols = Math.min(group.length, GRID_COLS)
        groupX += cols * (FLOW_NODE_W + GRID_H_GAP) + 140
      }
    }
  }, [notes, edges, moveNote])

  return (
    <div className="spatial" ref={stageRef} onPointerDown={onStageDown} onDoubleClick={onStageDblClick}>
      <div className="spatial__grid" />
      <div className="spatial__canvas" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
        <svg className="spatial__edges" style={{ width: 6000, height: 4000, position: 'absolute', top: 0, left: 0 }}>
          {edgePaths.map((p, i) => <path key={i} d={p.d} />)}
        </svg>
        {notes.map(note => {
          const sz = localSizes[note.id]
          const w  = sz?.w ?? note.posW
          const h  = sz?.h ?? 200
          return (
            <div
              key={note.id}
              className={[
                'spatial__node',
                activeNoteId === note.id ? 'spatial__node--focused'  : '',
                draggingId   === note.id ? 'spatial__node--dragging' : '',
                resizingId   === note.id ? 'spatial__node--resizing' : '',
                'spatial__node--sized',
              ].filter(Boolean).join(' ')}
              style={{ left: note.posX, top: note.posY, width: w, height: h, position: 'absolute' }}
              onPointerDown={e => onNodeDown(e, note.id)}
              onClick={() => setActiveNote(note.id)}
            >
              <div className="spatial__node__bar">
                {editingTitleId === note.id ? (
                  <input
                    className="spatial__node__bar-title spatial__node__bar-title--input"
                    value={titleDraft}
                    autoFocus
                    onChange={e => setTitleDraft(e.target.value)}
                    onBlur={() => {
                      const t = titleDraft.trim() || 'Sem título'
                      const content = contentCache[note.id] ?? { type: 'doc', content: [] }
                      saveNoteContent(note.id, t, note.folder, content)
                      setEditingTitleId(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditingTitleId(null)
                      e.stopPropagation()
                    }}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="spatial__node__bar-title"
                    title="Duplo clique para editar"
                    onDoubleClick={e => { e.stopPropagation(); setEditingTitleId(note.id); setTitleDraft(note.title) }}
                  >{note.title}</span>
                )}
                <span className="spatial__node__bar-folder">{note.folder}</span>
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

      <div className="spatial__hint">
        <span className="spatial__hint--desktop"><kbd>scroll</kbd> pan · <kbd>⌘ scroll</kbd> zoom · arraste · dbl-click cria</span>
        <span className="spatial__hint--mobile">1 dedo pan · 2 dedos zoom · segure card para mover</span>
      </div>
      <div className="spatial__zoom">
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
        <div className="spatial__zoom-label">{Math.round(zoom * 100)}%</div>
        <button onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}>+</button>
        <button onClick={() => { setZoom(0.75); setPan({ x: 0, y: 0 }) }}>↺</button>
        <div className="spatial__zoom-sep" />
        <button className="spatial__zoom-flow" onClick={handleFlowLayout}
          title="Organizar: por links (se houver) ou por pasta">
          ⊞ Organizar
        </button>
      </div>
    </div>
  )
}
