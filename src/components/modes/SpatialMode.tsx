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
const FLOW_NODE_H = 240
const FLOW_H_GAP  = 72
const FLOW_V_GAP  = 36

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

  const stageRef  = useRef<HTMLDivElement>(null)
  const dragRef   = useRef<DragState | null>(null)
  const resizeRef = useRef<ResizeState | null>(null)
  const zoomRef   = useRef(zoom)
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  useEffect(() => {
    try { localStorage.setItem(SIZES_KEY, JSON.stringify(localSizes)) }
    catch {}
  }, [localSizes])

  useEffect(() => {
    getGraph().then(g => setEdges(g.edges.filter(e => e.kind === 'explicit')))
  }, [notes])

  /* ── pan ── */
  const onStageDown = (e: React.MouseEvent) => {
    if (e.target !== stageRef.current && !(e.target as HTMLElement).classList.contains('spatial__grid')) return
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  useEffect(() => {
    if (!panStart) return
    const move = (e: MouseEvent) => setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    const up   = () => setPanStart(null)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup',   up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
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

  /* ── node drag + resize ── */
  const onNodeDown = (e: React.MouseEvent, id: string) => {
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

  const onResizeDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    const note = notes.find(n => n.id === id)!
    const sz = localSizes[id]
    resizeRef.current = {
      id,
      startClientX: e.clientX, startClientY: e.clientY,
      startW: sz?.w ?? note.posW,
      startH: sz?.h ?? 0,
    }
    setResizingId(id)
  }

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragRef.current) {
        const { id, startClientX, startClientY, startPosX, startPosY } = dragRef.current
        const z = zoomRef.current
        moveNote(id, startPosX + (e.clientX - startClientX) / z, startPosY + (e.clientY - startClientY) / z, true)
      }
      if (resizeRef.current) {
        const { id, startClientX, startClientY, startW, startH } = resizeRef.current
        const z = zoomRef.current
        const dw = (e.clientX - startClientX) / z
        const dh = (e.clientY - startClientY) / z
        const newW = Math.max(240, startW + dw)
        const newH = startH > 0 ? Math.max(100, startH + dh) : (dh > 12 ? Math.max(100, 200 + dh) : 0)
        setLocalSizes(s => ({ ...s, [id]: { w: newW, h: newH } }))
      }
    }
    const up = (e: MouseEvent) => {
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
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup',   up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [moveNote])

  /* ── double-click creates note ── */
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

  /* ── flow layout ── */
  const handleFlowLayout = useCallback(() => {
    const out = new Map<string, string[]>()
    const inc = new Map<string, number>()
    for (const n of notes) { out.set(n.id, []); inc.set(n.id, 0) }
    for (const e of edges) {
      out.get(e.aId)?.push(e.bId)
      inc.set(e.bId, (inc.get(e.bId) ?? 0) + 1)
    }

    // BFS level assignment from roots
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

    // Group by column
    const byLevel = new Map<number, string[]>()
    for (const [id, l] of level) {
      if (!byLevel.has(l)) byLevel.set(l, [])
      byLevel.get(l)!.push(id)
    }

    // Find tallest column to vertically center shorter ones
    const maxColH = Math.max(...Array.from(byLevel.values()).map(
      ids => ids.length * FLOW_NODE_H + (ids.length - 1) * FLOW_V_GAP
    ), 0)

    for (const [l, ids] of byLevel) {
      const colH  = ids.length * FLOW_NODE_H + (ids.length - 1) * FLOW_V_GAP
      const startY = 80 + (maxColH - colH) / 2
      const x = 80 + l * (FLOW_NODE_W + FLOW_H_GAP)
      ids.forEach((id, i) => {
        const y = startY + i * (FLOW_NODE_H + FLOW_V_GAP)
        moveNote(id, x, y, false)
      })
    }
  }, [notes, edges, moveNote])

  return (
    <div className="spatial" ref={stageRef} onMouseDown={onStageDown} onDoubleClick={onStageDblClick}>
      <div className="spatial__grid" />
      <div className="spatial__canvas" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
        <svg className="spatial__edges" style={{ width: 4000, height: 3000, position: 'absolute', top: 0, left: 0 }}>
          {edgePaths.map((p, i) => <path key={i} d={p.d} />)}
        </svg>
        {notes.map(note => {
          const sz = localSizes[note.id]
          const w  = sz?.w ?? note.posW
          const h  = sz?.h ?? 0
          return (
            <div
              key={note.id}
              className={[
                'spatial__node',
                activeNoteId === note.id   ? 'spatial__node--focused'  : '',
                draggingId   === note.id   ? 'spatial__node--dragging' : '',
                resizingId   === note.id   ? 'spatial__node--resizing' : '',
                h > 0                      ? 'spatial__node--sized'    : '',
              ].filter(Boolean).join(' ')}
              style={{ left: note.posX, top: note.posY, width: w, height: h || undefined, position: 'absolute' }}
              onMouseDown={e => onNodeDown(e, note.id)}
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
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="spatial__node__bar-title"
                    title="Duplo clique para editar"
                    onDoubleClick={e => { e.stopPropagation(); setEditingTitleId(note.id); setTitleDraft(note.title) }}
                  >{note.title}</span>
                )}
                <span className="spatial__node__bar-grip">⠿</span>
              </div>
              <Editor noteId={note.id} />
              <div className="spatial__node__resize" onMouseDown={e => onResizeDown(e, note.id)} />
            </div>
          )
        })}
      </div>

      <div className="spatial__hint">
        <kbd>scroll</kbd> pan · <kbd>⌘ scroll</kbd> zoom · arraste cards · double-click cria nota
      </div>
      <div className="spatial__zoom">
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
        <div className="spatial__zoom-label">{Math.round(zoom * 100)}%</div>
        <button onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}>+</button>
        <button onClick={() => { setZoom(0.75); setPan({ x: 0, y: 0 }) }}>↺</button>
        <div className="spatial__zoom-sep" />
        <button className="spatial__zoom-flow" onClick={handleFlowLayout} title="Organizar notas pelo fluxo de links">
          ⊞ Fluxo
        </button>
      </div>
    </div>
  )
}
