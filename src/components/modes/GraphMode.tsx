import { useEffect, useMemo, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import { getGraph, type GraphData } from '../../lib/db'

function step(
  nodes: Array<{ id: string; x: number; y: number; vx: number; vy: number }>,
  edges: Array<[string, string]>,
  w: number, h: number,
  dragId: string | null,
  mouse: { x: number; y: number } | null,
) {
  const K_REP = 9000, K_SPRING = 0.018, SPRING_L = 130, K_CENTER = 0.0035, DAMP = 0.82
  const next = nodes.map(n => ({ ...n }))
  const byId = Object.fromEntries(next.map(n => [n.id, n]))

  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j]
      const dx = a.x - b.x, dy = a.y - b.y
      const r2 = dx * dx + dy * dy + 0.01, r = Math.sqrt(r2)
      const f = K_REP / r2
      const fx = (dx / r) * f, fy = (dy / r) * f
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
    }
  }
  for (const [u, v] of edges) {
    const a = byId[u], b = byId[v]
    if (!a || !b) continue
    const dx = b.x - a.x, dy = b.y - a.y
    const r = Math.sqrt(dx * dx + dy * dy) + 0.001
    const f = (r - SPRING_L) * K_SPRING
    const fx = (dx / r) * f, fy = (dy / r) * f
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
  }
  for (const n of next) { n.vx += (w / 2 - n.x) * K_CENTER; n.vy += (h / 2 - n.y) * K_CENTER }
  for (const n of next) {
    if (n.id === dragId && mouse) { n.x = mouse.x; n.y = mouse.y; n.vx = 0; n.vy = 0; continue }
    n.vx *= DAMP; n.vy *= DAMP
    n.x = Math.max(60, Math.min(w - 60, n.x + n.vx))
    n.y = Math.max(60, Math.min(h - 60, n.y + n.vy))
  }
  return next
}

const FOLDER_COLOR: Record<string, string> = {
  inbox:       'var(--accent-terracotta)',
  método:      'var(--accent-terracotta)',
  técnico:     'var(--accent-emerald)',
  pessoas:     'var(--accent-electric)',
  ferramentas: 'var(--accent-amber)',
}

export function GraphMode() {
  const { notes, setActiveNote } = useNotesStore()
  const stageRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 700 })
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [simNodes, setSimNodes] = useState<Array<{ id: string; x: number; y: number; vx: number; vy: number }>>([])
  const [selected, setSelected] = useState<string | null>(null)
  const dragRef = useRef<{ id: string | null; mouse: { x: number; y: number } | null }>({ id: null, mouse: null })
  const [, tick] = useState(0)

  useEffect(() => { getGraph().then(setGraphData) }, [notes])

  useEffect(() => {
    if (!stageRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(stageRef.current.parentElement!)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!size.w || !graphData.nodes.length) return
    setSimNodes(prev => {
      if (prev.length) return prev
      return graphData.nodes.map((n, i) => {
        const angle = (i / graphData.nodes.length) * Math.PI * 2
        const r = 160 + Math.random() * 60
        return { id: n.id, x: size.w / 2 + Math.cos(angle) * r, y: size.h / 2 + Math.sin(angle) * r, vx: 0, vy: 0 }
      })
    })
  }, [size.w, graphData.nodes.length])

  const edgePairs = useMemo(
    () => graphData.edges.map(e => [e.aId, e.bId] as [string, string]),
    [graphData.edges]
  )

  useEffect(() => {
    if (!simNodes.length) return
    let raf: number
    const run = () => {
      setSimNodes(ns => step(ns, edgePairs, size.w, size.h, dragRef.current.id, dragRef.current.mouse))
      tick(t => t + 1)
      raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [simNodes.length, edgePairs, size.w, size.h])

  const onNodeDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); e.preventDefault()
    const node = simNodes.find(n => n.id === id)
    dragRef.current = { id, mouse: node ? { x: node.x, y: node.y } : null }
    const move = (ev: MouseEvent) => {
      const rect = stageRef.current!.getBoundingClientRect()
      dragRef.current.mouse = { x: ev.clientX - rect.left, y: ev.clientY - rect.top }
    }
    const up = () => {
      dragRef.current = { id: null, mouse: null }
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const nodeById = useMemo(() => Object.fromEntries(simNodes.map(n => [n.id, n])), [simNodes])
  const infoNote = graphData.nodes.find(n => n.id === selected)
  const degree = useMemo(() => {
    const d: Record<string, number> = {}
    edgePairs.forEach(([a, b]) => { d[a] = (d[a] || 0) + 1; d[b] = (d[b] || 0) + 1 })
    return d
  }, [edgePairs])

  return (
    <div className="graph" style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg ref={stageRef} className="graph__svg" style={{ width: '100%', height: '100%' }}>
          {edgePairs.map(([a, b], i) => {
            const A = nodeById[a], B = nodeById[b]
            if (!A || !B) return null
            return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke="var(--border-strong)" strokeWidth="1" strokeOpacity="0.35" />
          })}
          {simNodes.map(n => {
            const info = graphData.nodes.find(x => x.id === n.id)
            if (!info) return null
            const color = FOLDER_COLOR[info.folder] ?? FOLDER_COLOR['inbox']
            const deg = degree[n.id] || 0
            const r = 8 + Math.min(10, deg * 2.2)
            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }}
                onClick={() => setSelected(n.id)}
                onMouseDown={e => onNodeDown(e, n.id)}>
                <circle r={r} fill="var(--bg-elevated)" stroke={color}
                  strokeWidth={selected === n.id ? 2.5 : 1.5} />
                <text textAnchor="middle" dy={r + 14}
                  fontFamily="var(--font-sans)" fontSize="11"
                  fill={selected === n.id ? 'var(--text-primary)' : 'var(--text-secondary)'}>
                  {info.title.slice(0, 24)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {infoNote && (
        <aside className="graph__panel">
          <div className="graph__panel-head">
            <div className="graph__panel-folder" style={{ color: FOLDER_COLOR[infoNote.folder] ?? FOLDER_COLOR['inbox'] }}>
              {infoNote.folder}
            </div>
            <h2 className="graph__panel-title">{infoNote.title}</h2>
            <div className="graph__panel-meta">{degree[infoNote.id] || 0} conexões</div>
          </div>
          <button className="graph__panel-link" onClick={() => setActiveNote(infoNote.id)}>
            ↗ Abrir no editor
          </button>
        </aside>
      )}
    </div>
  )
}
