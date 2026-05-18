import { useEffect, useMemo, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import { Editor } from '../editor/Editor'
import { getGraph, type GraphEdge } from '../../lib/db'

interface EdgePath { d: string }

export function SpatialMode() {
  const { notes, activeNoteId, setActiveNote, moveNote, createNote } = useNotesStore()
  const [zoom, setZoom] = useState(0.75)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getGraph().then(g => setEdges(g.edges.filter(e => e.kind === 'explicit')))
  }, [notes])

  const onStageDown = (e: React.MouseEvent) => {
    if (e.target !== stageRef.current && !(e.target as HTMLElement).classList.contains('spatial__grid')) return
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  useEffect(() => {
    if (!panStart) return
    const move = (e: MouseEvent) => setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    const up = () => setPanStart(null)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [panStart])

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

  const onNodeDown = (e: React.MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest('[contenteditable], button, .math-block')) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragging({ id, dx: e.clientX - rect.left, dy: e.clientY - rect.top })
    e.stopPropagation()
  }
  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => {
      const stage = stageRef.current!.getBoundingClientRect()
      const x = (e.clientX - stage.left - pan.x - dragging.dx) / zoom
      const y = (e.clientY - stage.top - pan.y - dragging.dy) / zoom
      moveNote(dragging.id, x, y)
    }
    const up = () => setDragging(null)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [dragging, zoom, pan])

  const onStageDblClick = async (e: React.MouseEvent) => {
    if (e.target !== stageRef.current && !(e.target as HTMLElement).classList.contains('spatial__grid')) return
    const stage = stageRef.current!.getBoundingClientRect()
    const x = (e.clientX - stage.left - pan.x) / zoom
    const y = (e.clientY - stage.top - pan.y) / zoom
    await createNote('Sem título', 'inbox', x, y)
  }

  const edgePaths: EdgePath[] = useMemo(() => {
    return edges.map(edge => {
      const A = notes.find(n => n.id === edge.aId)
      const B = notes.find(n => n.id === edge.bId)
      if (!A || !B) return null
      const ax = A.posX + A.posW / 2, ay = A.posY + 40
      const bx = B.posX + B.posW / 2, by = B.posY + 40
      const dx = (bx - ax) * 0.4
      return { d: `M ${ax} ${ay} C ${ax+dx} ${ay}, ${bx-dx} ${by}, ${bx} ${by}` }
    }).filter((p): p is EdgePath => p !== null)
  }, [notes, edges])

  return (
    <div className="spatial" ref={stageRef} onMouseDown={onStageDown} onDoubleClick={onStageDblClick}>
      <div className="spatial__grid" />
      <div className="spatial__canvas" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
        <svg className="spatial__edges" style={{ width: 4000, height: 3000, position: 'absolute', top: 0, left: 0 }}>
          {edgePaths.map((p, i) => <path key={i} d={p.d} />)}
        </svg>
        {notes.map(b => (
          <div
            key={b.id}
            className={`spatial__node ${activeNoteId === b.id ? 'spatial__node--focused' : ''}`}
            style={{ left: b.posX, top: b.posY, width: b.posW, position: 'absolute' }}
            onMouseDown={e => onNodeDown(e, b.id)}
            onClick={() => setActiveNote(b.id)}
          >
            <Editor noteId={b.id} />
          </div>
        ))}
      </div>
      <div className="spatial__hint">
        <kbd>scroll</kbd> pan · <kbd>⌘ scroll</kbd> zoom · arraste cards · double-click cria nota
      </div>
      <div className="spatial__zoom">
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
        <div className="spatial__zoom-label">{Math.round(zoom * 100)}%</div>
        <button onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}>+</button>
        <button onClick={() => { setZoom(0.75); setPan({ x: 0, y: 0 }) }}>↺</button>
      </div>
    </div>
  )
}
