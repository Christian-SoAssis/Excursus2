import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNotesStore } from '../../store/notes'
import { getGraph, type GraphData, type GraphNode } from '../../lib/db'

// ─── Folder colours ────────────────────────────────────────────────────────────
// Preset colours for built-in folders; unknown folders get auto-assigned from palette.
const PRESET_COLORS: Record<string, string> = {
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
// Palette for dynamically-created folders (cycles if more than 6)
const DYNAMIC_PALETTE = [
  'var(--accent-terracotta)',
  'var(--accent-electric)',
  'var(--accent-emerald)',
  'var(--accent-amber)',
  'var(--accent-terracotta)',   // fallback cycle
  'var(--accent-electric)',
]

// ─── Simulation ───────────────────────────────────────────────────────────────
type SimNode = { id: string; x: number; y: number; vx: number; vy: number }

function step(
  nodes: SimNode[],
  edges: [string, string][],
  w: number, h: number,
  dragId: string | null,
  mouse: { x: number; y: number } | null,
  kRep: number,
  springL: number,
): SimNode[] {
  const K_SPRING = 0.018, K_CENTER = 0.0035, DAMP = 0.82
  const next  = nodes.map(n => ({ ...n }))
  const byId  = Object.fromEntries(next.map(n => [n.id, n]))

  // Repulsion
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i], b = next[j]
      const dx = a.x - b.x, dy = a.y - b.y
      const r2 = dx * dx + dy * dy + 0.01, r = Math.sqrt(r2)
      const f = kRep / r2
      const fx = (dx / r) * f, fy = (dy / r) * f
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
    }
  }
  // Spring attraction
  for (const [u, v] of edges) {
    const a = byId[u], b = byId[v]
    if (!a || !b) continue
    const dx = b.x - a.x, dy = b.y - a.y
    const r  = Math.sqrt(dx * dx + dy * dy) + 0.001
    const f  = (r - springL) * K_SPRING
    const fx = (dx / r) * f, fy = (dy / r) * f
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy
  }
  // Gravity towards centre
  for (const n of next) { n.vx += (w / 2 - n.x) * K_CENTER; n.vy += (h / 2 - n.y) * K_CENTER }
  // Integrate
  for (const n of next) {
    if (n.id === dragId && mouse) { n.x = mouse.x; n.y = mouse.y; n.vx = 0; n.vy = 0; continue }
    n.vx *= DAMP; n.vy *= DAMP
    n.x = Math.max(60, Math.min(w - 60, n.x + n.vx))
    n.y = Math.max(60, Math.min(h - 60, n.y + n.vy))
  }
  return next
}

// ─── Component ────────────────────────────────────────────────────────────────
export function GraphMode() {
  const { notes, setActiveNote } = useNotesStore()
  const stageRef = useRef<HTMLDivElement>(null)
  const svgRef   = useRef<SVGSVGElement>(null)

  const [size,      setSize]      = useState({ w: 1200, h: 700 })
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] })
  const [simNodes,  setSimNodes]  = useState<SimNode[]>([])

  // Selection / hover
  const [selected,  setSelected]  = useState<string | null>(null)
  const [hovered,   setHovered]   = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  // Filters
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('all')
  const [minDeg,      setMinDeg]      = useState(0)
  const [showLabels,  setShowLabels]  = useState(true)
  const [hideOrphans, setHideOrphans] = useState(false)

  // Focus mode — hides everything except the selected node and its neighbours
  const [focusMode, setFocusMode] = useState(false)

  // Physics knobs
  const [kRep,    setKRep]    = useState(9000)
  const [springL, setSpringL] = useState(130)

  const dragRef = useRef<{ id: string | null; mouse: { x: number; y: number } | null }>({ id: null, mouse: null })
  const [, tick] = useState(0)

  // ── Data loading ──
  useEffect(() => { getGraph().then(setGraphData) }, [notes])

  // ── Resize observer ──
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

  // ── Initialise sim nodes ──
  useEffect(() => {
    if (!size.w || !graphData.nodes.length) return
    setSimNodes(prev => {
      if (prev.length === graphData.nodes.length) return prev
      return graphData.nodes.map((n, i) => {
        const existing = prev.find(p => p.id === n.id)
        if (existing) return existing
        const angle = (i / graphData.nodes.length) * Math.PI * 2
        const r = 160 + Math.random() * 60
        return { id: n.id, x: size.w / 2 + Math.cos(angle) * r, y: size.h / 2 + Math.sin(angle) * r, vx: 0, vy: 0 }
      })
    })
  }, [size.w, graphData.nodes.length])

  // ── Physics loop ──
  useEffect(() => {
    if (!simNodes.length) return
    let raf: number
    const run = () => {
      setSimNodes(ns => step(ns, edgePairs, size.w, size.h, dragRef.current.id, dragRef.current.mouse, kRep, springL))
      tick(t => t + 1)
      raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes.length, size.w, size.h, kRep, springL])

  // ── ESC exits focus mode ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && focusMode) setFocusMode(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusMode])

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
    const counts: Record<string, number> = {}
    graphData.nodes.forEach(n => { seen.add(n.folder); counts[n.folder] = (counts[n.folder] || 0) + 1 })
    return { list: Array.from(seen), counts }
  }, [graphData.nodes])

  // ── Dynamic colour assignment ──
  // Preset folders use curated colours; user-created folders auto-pick from palette by index.
  const folderColors = useMemo(() => {
    const map: Record<string, string> = { ...PRESET_COLORS }
    folders.list.forEach((f, i) => { if (!map[f]) map[f] = DYNAMIC_PALETTE[i % DYNAMIC_PALETTE.length] })
    return map
  }, [folders.list])

  const colorOf = useCallback((folder: string) => folderColors[folder] ?? DYNAMIC_PALETTE[0], [folderColors])

  const nodeById     = useMemo(() => Object.fromEntries(simNodes.map(n => [n.id, n])), [simNodes])
  const infoByNodeId = useMemo(() => Object.fromEntries(graphData.nodes.map(n => [n.id, n])), [graphData.nodes])

  // In focus mode pin focusedId to selected (ignore hover); otherwise normal behaviour
  const focusedId = focusMode ? selected : (hovered ?? selected)

  const neighborSet = useMemo(() => {
    const s = new Set<string>()
    if (!focusedId) return s
    s.add(focusedId)
    edgePairs.forEach(([a, b]) => {
      if (a === focusedId) s.add(b)
      if (b === focusedId) s.add(a)
    })
    return s
  }, [focusedId, edgePairs])

  const isVisible = useCallback((n: GraphNode) => {
    if (filter !== 'all' && n.folder !== filter) return false
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false
    if ((degree[n.id] || 0) < minDeg) return false
    if (hideOrphans && (degree[n.id] || 0) === 0) return false
    return true
  }, [filter, search, minDeg, hideOrphans, degree])

  // ── Drag ──
  const onNodeDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); e.preventDefault()
    const node = simNodes.find(n => n.id === id)
    dragRef.current = { id, mouse: node ? { x: node.x, y: node.y } : null }
    const move = (ev: MouseEvent) => {
      const rect = svgRef.current!.getBoundingClientRect()
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

  const selNote      = graphData.nodes.find(n => n.id === selected)
  const selNeighbors = useMemo(() =>
    graphData.nodes.filter(n =>
      n.id !== selected && edgePairs.some(([a, b]) => (a === selected && b === n.id) || (b === selected && a === n.id))
    ),
    [selected, graphData.nodes, edgePairs]
  )

  const visibleCount = simNodes.filter(n => { const info = infoByNodeId[n.id]; return info && isVisible(info) }).length

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="graph">

      {/* ── Topbar ── */}
      <div className="graph__topbar">
        {/* Search */}
        <div className="graph__search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nota…" />
          {search && <button onClick={() => setSearch('')} style={{ color: 'var(--text-muted)', padding: '0 4px', fontSize: 14 }}>×</button>}
        </div>

        {/* Folder filters */}
        <div className="graph__filters">
          <button className="graph__chip" data-active={filter === 'all' || undefined} onClick={() => setFilter('all')}>
            todas <span>{graphData.nodes.length}</span>
          </button>
          {folders.list.map(f => (
            <button key={f} className="graph__chip" data-active={filter === f || undefined} onClick={() => setFilter(f)}>
              <span className="graph__chip-dot" style={{ background: colorOf(f) }} />
              {FOLDER_LABEL[f] ?? f} <span>{folders.counts[f]}</span>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="graph__controls">
          {/* Hide orphans */}
          <button
            className="graph__chip"
            data-active={hideOrphans || undefined}
            onClick={() => setHideOrphans(h => !h)}
            title="Esconder notas sem conexões"
          >
            ocultar solitárias
          </button>

          {/* Labels toggle */}
          <button className="graph__chip" data-active={showLabels || undefined} onClick={() => setShowLabels(s => !s)}>
            rótulos
          </button>

          {/* Min degree */}
          <label className="graph__slider" title="Mostrar apenas notas com pelo menos N conexões">
            <span>min grau</span>
            <input type="range" min="0" max="4" value={minDeg} onChange={e => setMinDeg(+e.target.value)} />
            <b>{minDeg}+</b>
          </label>

          {/* Repulsion */}
          <label className="graph__slider" title="Força de repulsão entre nós">
            <span>repulsão</span>
            <input type="range" min="2000" max="20000" step="1000" value={kRep} onChange={e => setKRep(+e.target.value)} />
          </label>

          {/* Spring length */}
          <label className="graph__slider" title="Distância ideal das arestas">
            <span>distância</span>
            <input type="range" min="50" max="280" step="10" value={springL} onChange={e => setSpringL(+e.target.value)} />
          </label>
        </div>
      </div>

      {/* ── Stage ── */}
      <div className="graph__stage" ref={stageRef}>

        {/* Focus mode banner */}
        {focusMode && selNote && (
          <div className="graph__focus-banner">
            <span>🎯 Foco: <b>{selNote.title}</b></span>
            <button onClick={() => setFocusMode(false)}>ESC · sair</button>
          </div>
        )}

        <svg ref={svgRef} className="graph__svg" width={size.w} height={size.h}>
          <defs>
            <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="var(--accent-terracotta)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent-terracotta)" stopOpacity="0"    />
            </radialGradient>
          </defs>

          {/* ── Edges ── */}
          {edgePairs.map(([a, b], i) => {
            const A = nodeById[a], B = nodeById[b]
            if (!A || !B) return null

            // In focus mode: hide edges not connected to focused node
            if (focusMode) {
              if (!neighborSet.has(a) || !neighborSet.has(b)) return null
            }

            const dim = !focusMode && !!focusedId && !(neighborSet.has(a) && neighborSet.has(b))
            const hot = !!focusedId && (a === focusedId || b === focusedId)

            if (dim) return (
              <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                stroke="var(--border-strong)" strokeWidth={1} strokeOpacity={0.06} />
            )
            return (
              <g key={i}>
                {hot && <>
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--accent-terracotta)" strokeWidth={9}   strokeOpacity={0.07} />
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--accent-terracotta)" strokeWidth={3.5} strokeOpacity={0.2}  />
                </>}
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke={hot ? 'var(--accent-terracotta)' : 'var(--border-strong)'}
                  strokeWidth={hot ? 1.6 : 1}
                  strokeOpacity={hot ? 0.75 : 0.35}
                />
              </g>
            )
          })}

          {/* ── Nodes ── */}
          {simNodes.map(n => {
            const info = infoByNodeId[n.id]
            if (!info) return null

            // In focus mode: completely hide non-neighbours
            if (focusMode && !neighborSet.has(n.id)) return null
            // Normal filter
            if (!focusMode && !isVisible(info) && n.id !== focusedId) return null

            const color      = colorOf(info.folder)
            const isFocus    = focusedId === n.id
            const isSelected = selected  === n.id
            const dim        = !focusMode && !!focusedId && !neighborSet.has(n.id)
            const deg        = degree[n.id] || 0
            const r          = 8 + Math.min(10, deg * 2.2)

            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}
                style={{ cursor: 'pointer', opacity: dim ? 0.15 : 1, transition: 'opacity .2s' }}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => { setSelected(n.id); setPanelOpen(true) }}
                onMouseDown={e => onNodeDown(e, n.id)}
              >
                {/* Glow halos */}
                <circle r={r * 3.2} fill={color} opacity={isFocus ? 0.07  : 0.03} />
                <circle r={r * 2}   fill={color} opacity={isFocus ? 0.12  : 0.05} />
                <circle r={r * 1.4} fill={color} opacity={isFocus ? 0.18  : 0.09} />
                {isFocus && <circle r={r + 9} fill="none" stroke={color} strokeWidth="1.2" opacity="0.4" />}
                {/* Body */}
                <circle r={r} fill="var(--bg-elevated)" stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} />
                {isSelected && <circle r={r - 3} fill={color} opacity="0.75" />}
                {/* Label */}
                {showLabels && (
                  <text textAnchor="middle" dy={r + 15}
                    fontFamily="var(--font-sans)" fontSize="11"
                    fill={isFocus ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    style={{ pointerEvents: 'none', fontWeight: isSelected ? 500 : 400 }}>
                    {info.title.length > 22 ? info.title.slice(0, 22) + '…' : info.title}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* ── Legend ── */}
        <div className="graph__legend">
          <div className="graph__legend-title">
            {graphData.nodes.length} notas · {edgePairs.length} conexões
          </div>
          {folders.list.map(f => (
            <div key={f} className="graph__legend-row">
              <span className="graph__legend-dot" style={{ background: colorOf(f) }} />
              <span>{FOLDER_LABEL[f] ?? f}</span>
              <span style={{ color: 'var(--text-faint)', marginLeft: 'auto' }}>{folders.counts[f]}</span>
            </div>
          ))}
        </div>

        {/* ── Stats ── */}
        <div className="graph__stats">
          <div><span>{visibleCount}</span> visíveis</div>
          <div><span>{edgePairs.length}</span> arestas</div>
          {graphData.nodes.length > 0 && (
            <div><span>{(edgePairs.length * 2 / graphData.nodes.length).toFixed(1)}</span> grau médio</div>
          )}
          {hideOrphans && (
            <div><span>{graphData.nodes.length - visibleCount}</span> ocultas</div>
          )}
        </div>
      </div>

      {/* ── Side panel ── */}
      <aside className={`graph__panel${panelOpen ? ' is-open' : ''}`}>
        <div className="graph__panel-drag-handle" />
        <button className="graph__panel-close" onClick={() => { setPanelOpen(false); setFocusMode(false) }} aria-label="Fechar">×</button>

        {selNote ? (
          <>
            <div className="graph__panel-head">
              <div className="graph__panel-folder" style={{ color: colorOf(selNote.folder) }}>
                <span className="graph__legend-dot" style={{ background: colorOf(selNote.folder), display: 'inline-block', marginRight: 6 }} />
                {FOLDER_LABEL[selNote.folder] ?? selNote.folder}
              </div>
              <h2 className="graph__panel-title">{selNote.title}</h2>
              <div className="graph__panel-meta">
                <span>{degree[selNote.id] || 0} conexões</span>
                {focusMode && <span style={{ color: 'var(--accent-terracotta)' }}>· modo foco ativo</span>}
              </div>
            </div>

            {selNeighbors.length > 0 && (
              <div className="graph__panel-section">
                <div className="graph__panel-section-title">Conectadas ({selNeighbors.length})</div>
                {selNeighbors.map(n => (
                  <button key={n.id} className="graph__panel-link" onClick={() => setSelected(n.id)}>
                    <span className="graph__legend-dot" style={{ background: colorOf(n.folder), display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{n.title}</span>
                    <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{degree[n.id] || 0}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="graph__panel-section">
              <div className="graph__panel-section-title">Ações</div>
              {/* Focus mode toggle */}
              <button
                className="graph__panel-link"
                onClick={() => setFocusMode(f => !f)}
                style={focusMode ? { color: 'var(--accent-terracotta)' } : undefined}
              >
                <span>🎯</span>
                <span>{focusMode ? 'Sair do modo foco' : 'Focar nesta nota'}</span>
              </button>
              {/* Open in editor */}
              <button className="graph__panel-link" onClick={() => setActiveNote(selNote.id)}>
                <span style={{ color: 'var(--accent-terracotta)' }}>↗</span>
                <span>Abrir no editor</span>
              </button>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 0' }}>
            Clique em uma nota
          </div>
        )}
      </aside>
    </div>
  )
}
