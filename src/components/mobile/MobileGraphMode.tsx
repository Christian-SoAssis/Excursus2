import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNotesStore } from '../../store/notes'
import { getGraph, type GraphData } from '../../lib/db'
import { useUIStore } from '../../store/ui'

// ── Cores por pasta (igual ao desktop) ────────────────────────────────────────
const PRESET_COLORS: Record<string, string> = {
  inbox:        'var(--accent-terracotta)',
  método:       'var(--accent-terracotta)',
  técnico:      'var(--accent-emerald)',
  pessoas:      'var(--accent-electric)',
  ferramentas:  'var(--accent-amber)',
}
const DYNAMIC_PALETTE = [
  'var(--accent-terracotta)', 'var(--accent-electric)',
  'var(--accent-emerald)',    'var(--accent-amber)',
]

// ── Simulação física (idêntica ao GraphMode desktop) ─────────────────────────
type SimNode = { id: string; x: number; y: number; vx: number; vy: number }

function step(
  nodes: SimNode[],
  edges: [string, string][],
  w: number, h: number,
  kRep: number,
  springL: number,
): SimNode[] {
  const K_SPRING = 0.018, K_CENTER = 0.004, DAMP = 0.82
  const next = nodes.map(n => ({ ...n }))
  const byId = Object.fromEntries(next.map(n => [n.id, n]))

  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j]
      const dx = a.x - b.x, dy = a.y - b.y
      const r2 = dx * dx + dy * dy + 0.01, r = Math.sqrt(r2)
      const f = kRep / r2, fx = (dx / r) * f, fy = (dy / r) * f
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
    }
  }
  for (const [u, v] of edges) {
    const a = byId[u], b = byId[v]
    if (!a || !b) continue
    const dx = b.x - a.x, dy = b.y - a.y
    const r = Math.sqrt(dx * dx + dy * dy) + 0.001
    const f = (r - springL) * K_SPRING
    const fx = (dx / r) * f, fy = (dy / r) * f
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
  }
  for (const n of next) {
    n.vx += (w / 2 - n.x) * K_CENTER
    n.vy += (h / 2 - n.y) * K_CENTER
    n.vx *= DAMP; n.vy *= DAMP
    n.x = Math.max(50, Math.min(w - 50, n.x + n.vx))
    n.y = Math.max(50, Math.min(h - 50, n.y + n.vy))
  }
  return next
}

// ── Componente ────────────────────────────────────────────────────────────────
export function MobileGraphMode() {
  const { notes, setActiveNote } = useNotesStore()
  const { setMode } = useUIStore()
  const svgRef   = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const [size,      setSize]      = useState({ w: 400, h: 600 })
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [simNodes,  setSimNodes]  = useState<SimNode[]>([])
  const [, tick] = useState(0)

  // Interação
  const [selected,  setSelected]  = useState<string | null>(null)
  const [filter,    setFilter]    = useState('all')

  // Pan / zoom via touch
  const [pan,   setPan]   = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)

  const touchRef = useRef({
    startX: 0, startY: 0,
    lastX: 0,  lastY: 0,
    dist0: 0, scale0: 1,
    moved: false,
    fingers: 0,
    tapId: null as string | null,
  })

  // ── Dados ──
  useEffect(() => { getGraph().then(setGraphData) }, [notes])

  // ── Tamanho do stage ──
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Inicializar nós ──
  useEffect(() => {
    if (!size.w || !graphData.nodes.length) return
    setSimNodes(prev => {
      if (prev.length === graphData.nodes.length) return prev
      return graphData.nodes.map((n, i) => {
        const existing = prev.find(p => p.id === n.id)
        if (existing) return existing
        const angle = (i / graphData.nodes.length) * Math.PI * 2
        const r = 100 + Math.random() * 60
        return { id: n.id, x: size.w / 2 + Math.cos(angle) * r, y: size.h / 2 + Math.sin(angle) * r, vx: 0, vy: 0 }
      })
    })
  }, [size.w, graphData.nodes.length])

  // ── Loop físico ──
  useEffect(() => {
    if (!simNodes.length) return
    let raf: number
    const run = () => {
      setSimNodes(ns => step(ns, edgePairs, size.w, size.h, 6000, 100))
      tick(t => t + 1)
      raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes.length, size.w, size.h])

  // ── Memos ──
  const edgePairs = useMemo<[string, string][]>(
    () => graphData.edges.map(e => [e.aId, e.bId]),
    [graphData.edges]
  )

  const degree = useMemo(() => {
    const d: Record<string, number> = {}
    edgePairs.forEach(([a, b]) => { d[a] = (d[a] || 0) + 1; d[b] = (d[b] || 0) + 1 })
    return d
  }, [edgePairs])

  const folders = useMemo(() => {
    const seen = new Set<string>()
    graphData.nodes.forEach(n => seen.add(n.folder))
    return Array.from(seen)
  }, [graphData.nodes])

  const folderColors = useMemo(() => {
    const map: Record<string, string> = { ...PRESET_COLORS }
    folders.forEach((f, i) => { if (!map[f]) map[f] = DYNAMIC_PALETTE[i % DYNAMIC_PALETTE.length] })
    return map
  }, [folders])

  const colorOf = useCallback((folder: string) => folderColors[folder] ?? DYNAMIC_PALETTE[0], [folderColors])
  const infoByNodeId = useMemo(() => Object.fromEntries(graphData.nodes.map(n => [n.id, n])), [graphData.nodes])
  const nodeById     = useMemo(() => Object.fromEntries(simNodes.map(n => [n.id, n])), [simNodes])

  const selectedNode      = selected ? infoByNodeId[selected] : null
  const selectedSimNode   = selected ? nodeById[selected]     : null
  const selectedNeighbors = useMemo(() =>
    graphData.nodes.filter(n =>
      n.id !== selected &&
      edgePairs.some(([a, b]) => (a === selected && b === n.id) || (b === selected && a === n.id))
    ),
    [selected, graphData.nodes, edgePairs]
  )

  // ── Hit test: converte coordenada de ecrã → nó mais próximo ──
  const hitTest = useCallback((clientX: number, clientY: number): string | null => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    const svgX = (clientX - rect.left - pan.x) / scale
    const svgY = (clientY - rect.top  - pan.y) / scale
    let best: string | null = null, bestDist = Infinity
    for (const n of simNodes) {
      const info = infoByNodeId[n.id]
      if (!info) continue
      if (filter !== 'all' && info.folder !== filter) continue
      const deg = degree[n.id] || 0
      const r   = 8 + Math.min(10, deg * 2) + 12   // +12 de tolerância touch
      const dist = Math.hypot(svgX - n.x, svgY - n.y)
      if (dist < r && dist < bestDist) { best = n.id; bestDist = dist }
    }
    return best
  }, [simNodes, infoByNodeId, degree, filter, pan, scale])

  // ── Handlers de toque ──
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = touchRef.current
    t.fingers = e.touches.length

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      t.startX = touch.clientX; t.startY = touch.clientY
      t.lastX  = touch.clientX; t.lastY  = touch.clientY
      t.moved  = false
      t.tapId  = hitTest(touch.clientX, touch.clientY)
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      t.dist0  = Math.hypot(dx, dy)
      t.scale0 = scale
      t.moved  = true   // pinch não é tap
    }
  }, [hitTest, scale])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const t = touchRef.current

    if (e.touches.length === 1 && t.fingers === 1) {
      const touch = e.touches[0]
      const dx = touch.clientX - t.lastX
      const dy = touch.clientY - t.lastY
      const totalMoved = Math.hypot(touch.clientX - t.startX, touch.clientY - t.startY)
      if (totalMoved > 8) t.moved = true
      if (t.moved) setPan(p => ({ x: p.x + dx, y: p.y + dy }))
      t.lastX = touch.clientX; t.lastY = touch.clientY

    } else if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.hypot(dx, dy)
      const newScale = Math.max(0.25, Math.min(3.5, t.scale0 * dist / t.dist0))
      setScale(newScale)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    const t = touchRef.current
    if (!t.moved) {
      if (t.tapId) {
        setSelected(prev => prev === t.tapId ? null : t.tapId)
      } else {
        setSelected(null)
      }
    }
    t.tapId = null
  }, [])

  // ── Abrir nota no editor ──
  const openNote = useCallback((id: string) => {
    setActiveNote(id)
    setMode('floating')
  }, [setActiveNote, setMode])

  // ── Render ──
  if (!graphData.nodes.length) {
    return (
      <div className="mob-graph">
        <div className="mob-graph__loading">
          {simNodes.length === 0 && graphData.nodes.length === 0
            ? 'Carregando grafo…'
            : 'Nenhuma nota com conexões ainda.\nAdicione [[backlinks]] nas notas para ver o grafo.'}
        </div>
      </div>
    )
  }

  return (
    <div className="mob-graph mob-graph--canvas" ref={stageRef}>

      {/* ── Filtros de pasta ── */}
      <div className="mob-graph__chips">
        <button
          className={`mob-graph__chip${filter === 'all' ? ' is-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas
        </button>
        {folders.map(f => (
          <button
            key={f}
            className={`mob-graph__chip${filter === f ? ' is-active' : ''}`}
            style={filter === f ? { borderColor: colorOf(f), color: colorOf(f) } : undefined}
            onClick={() => setFilter(f === filter ? 'all' : f)}
          >
            <span className="mob-graph__chip-dot" style={{ background: colorOf(f) }} />
            {f}
          </button>
        ))}
      </div>

      {/* ── SVG principal ── */}
      <svg
        ref={svgRef}
        className="mob-graph__svg"
        style={{ touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <defs>
          <filter id="mg-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Todo o conteúdo transformado por pan/zoom */}
        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>

          {/* Arestas */}
          <g style={{ pointerEvents: 'none' }}>
            {edgePairs.map(([a, b], i) => {
              const A = nodeById[a], B = nodeById[b]
              if (!A || !B) return null
              const infoA = infoByNodeId[a], infoB = infoByNodeId[b]
              if (filter !== 'all' && infoA?.folder !== filter && infoB?.folder !== filter) return null
              const hot = a === selected || b === selected
              return (
                <line key={i}
                  x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke={hot ? 'var(--accent-terracotta)' : 'var(--border-strong)'}
                  strokeWidth={hot ? 2 : 1}
                  strokeOpacity={hot ? 0.8 : 0.3}
                />
              )
            })}
          </g>

          {/* Nós */}
          {simNodes.map(n => {
            const info = infoByNodeId[n.id]
            if (!info) return null
            if (filter !== 'all' && info.folder !== filter) return null

            const color      = colorOf(info.folder)
            const deg        = degree[n.id] || 0
            const r          = 8 + Math.min(10, deg * 2)
            const isSelected = n.id === selected
            const isNeighbor = selectedNeighbors.some(nb => nb.id === n.id)
            const dim        = !!selected && !isSelected && !isNeighbor

            return (
              <g key={n.id}
                transform={`translate(${n.x},${n.y})`}
                style={{ opacity: dim ? 0.18 : 1, transition: 'opacity .2s' }}
              >
                {/* Halos */}
                <circle r={r * 2.8} fill={color} opacity={isSelected ? 0.1 : 0.03} />
                <circle r={r * 1.6} fill={color} opacity={isSelected ? 0.16 : 0.06} />
                {isSelected && (
                  <circle r={r + 8} fill="none" stroke={color} strokeWidth="1.5" opacity="0.5"
                    filter="url(#mg-glow)" />
                )}
                {/* Corpo */}
                <circle r={r} fill="var(--bg-elevated)" stroke={color}
                  strokeWidth={isSelected ? 2.5 : 1.5} />
                {isSelected && <circle r={r - 3} fill={color} opacity="0.7" />}
                {/* Label */}
                <text
                  textAnchor="middle" dy={r + 14}
                  fontFamily="var(--font-sans)" fontSize="10"
                  fill={isSelected || isNeighbor ? 'var(--text-primary)' : 'var(--text-secondary)'}
                  style={{ pointerEvents: 'none', fontWeight: isSelected ? 600 : 400 }}
                >
                  {info.title.length > 18 ? info.title.slice(0, 18) + '…' : info.title}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* ── Contador ── */}
      <div className="mob-graph__counter">
        {graphData.nodes.length} notas · {edgePairs.length} links
      </div>

      {/* ── Dica de uso ── */}
      {!selected && (
        <div className="mob-graph__hint">Toque num nó · dois dedos para zoom</div>
      )}

      {/* ── Painel inferior — nó selecionado ── */}
      {selected && selectedNode && (
        <div className="mob-graph__sheet" onClick={e => e.stopPropagation()}>
          <div className="mob-graph__sheet-handle" onClick={() => setSelected(null)} />

          <div className="mob-graph__sheet-head">
            <span className="mob-graph__sheet-folder" style={{ color: colorOf(selectedNode.folder) }}>
              <span className="mob-graph__chip-dot" style={{ background: colorOf(selectedNode.folder), display: 'inline-block' }} />
              {selectedNode.folder}
            </span>
            <h3 className="mob-graph__sheet-title">{selectedNode.title || 'Sem título'}</h3>
            <span className="mob-graph__sheet-meta">
              {degree[selected] || 0} conexões
              {selectedSimNode && (
                <span className="mob-graph__sheet-coords">
                  · x:{selectedSimNode.x.toFixed(0)} y:{selectedSimNode.y.toFixed(0)}
                </span>
              )}
            </span>
          </div>

          {selectedNeighbors.length > 0 && (
            <div className="mob-graph__sheet-neighbors">
              <div className="mob-graph__sheet-section">Conectadas</div>
              <div className="mob-graph__sheet-neighbor-list">
                {selectedNeighbors.map(n => (
                  <button
                    key={n.id}
                    className="mob-graph__sheet-neighbor"
                    onClick={() => setSelected(n.id)}
                  >
                    <span className="mob-graph__chip-dot" style={{ background: colorOf(n.folder) }} />
                    <span className="mob-graph__sheet-neighbor-title">{n.title}</span>
                    <span className="mob-graph__sheet-neighbor-deg">{degree[n.id] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="mob-graph__sheet-open" onClick={() => openNote(selected)}>
            ✎ Abrir nota no editor
          </button>
        </div>
      )}
    </div>
  )
}
