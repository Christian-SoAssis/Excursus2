import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNotesStore } from '../../store/notes'
import { getGraph, type GraphData, type GraphNode } from '../../lib/db'

/** Extract plain text from TipTap JSON (for hover preview) */
function extractText(node: unknown, limit = 140): string {
  if (!node || typeof node !== 'object') return ''
  let out = ''
  const walk = (n: Record<string, unknown>) => {
    if (out.length >= limit) return
    if (n['type'] === 'text') { out += (n['text'] as string) ?? ''; return }
    if (Array.isArray(n['content'])) (n['content'] as Record<string, unknown>[]).forEach(walk)
  }
  walk(node as Record<string, unknown>)
  return out.slice(0, limit).trim()
}

// ─── Convex hull helpers (for cluster view) ──────────────────────────────────
type Pt = { x: number; y: number }
const cross = (O: Pt, A: Pt, B: Pt) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x)

function convexHull(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  const lower: Pt[] = []
  for (const p of s) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p) }
  const upper: Pt[] = []
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p) }
  upper.pop(); lower.pop()
  return lower.concat(upper)
}

function expandHull(hull: Pt[], pad: number): Pt[] {
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length
  return hull.map(p => {
    const dx = p.x - cx, dy = p.y - cy, dist = Math.hypot(dx, dy) || 1
    return { x: p.x + dx / dist * pad, y: p.y + dy / dist * pad }
  })
}

function hullToPath(hull: Pt[]): string {
  if (!hull.length) return ''
  return `M ${hull[0].x.toFixed(1)} ${hull[0].y.toFixed(1)} ` +
    hull.slice(1).map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
}

// ─── BFS shortest-path ─────────────────────────────────────────────────────────
function bfsPath(start: string, end: string, edgePairs: [string, string][]): string[] | null {
  if (start === end) return [start]
  const queue: string[][] = [[start]]
  const visited = new Set([start])
  while (queue.length) {
    const path = queue.shift()!; const last = path[path.length - 1]
    for (const [a, b] of edgePairs) {
      const nxt = a === last ? b : b === last ? a : null
      if (!nxt || visited.has(nxt)) continue
      const newPath = [...path, nxt]
      if (nxt === end) return newPath
      visited.add(nxt); queue.push(newPath)
    }
  }
  return null
}

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
  pinnedIds: Set<string>,
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
    if (pinnedIds.has(n.id))      { n.vx = 0; n.vy = 0; continue }   // pinned: freeze in place
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

  // Selection / hover / pin
  const [selected,   setSelected]   = useState<string | null>(null)
  const [hovered,    setHovered]    = useState<string | null>(null)
  const [panelOpen,  setPanelOpen]  = useState(false)
  const [pinnedIds,  setPinnedIds]  = useState<Set<string>>(new Set())
  const [tooltip,    setTooltip]    = useState<{ id: string; x: number; y: number } | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filters
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('all')
  const [minDeg,      setMinDeg]      = useState(0)
  const [showLabels,  setShowLabels]  = useState(true)
  const [hideOrphans, setHideOrphans] = useState(false)

  // Focus mode — hides everything except the selected node and its neighbours
  const [focusMode, setFocusMode] = useState(false)

  // Cluster view — convex-hull backgrounds per folder
  const [showClusters, setShowClusters] = useState(false)

  // Shortest-path mode
  const [pathMode,  setPathMode]  = useState(false)
  const [pathStart, setPathStart] = useState<string | null>(null)
  const [pathEnd,   setPathEnd]   = useState<string | null>(null)

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
      setSimNodes(ns => step(ns, edgePairs, size.w, size.h, dragRef.current.id, dragRef.current.mouse, kRep, springL, pinnedIds))
      tick(t => t + 1)
      raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes.length, size.w, size.h, kRep, springL, pinnedIds])

  // ── ESC exits focus / path mode ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (focusMode) setFocusMode(false)
      if (pathMode)  { setPathMode(false); setPathStart(null); setPathEnd(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusMode, pathMode])

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

  // ── Pin toggle ──
  const togglePin = useCallback((id: string) => {
    setPinnedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])

  // ── Hover tooltip ──
  const onNodeEnter = useCallback((id: string, x: number, y: number) => {
    setHovered(id)
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    tooltipTimer.current = setTimeout(() => setTooltip({ id, x, y }), 450)
  }, [])

  const onNodeLeave = useCallback(() => {
    setHovered(null)
    setTooltip(null)
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
  }, [])

  // Note text for tooltip preview (extract from contentCache or notes content)
  const noteTextMap = useMemo(() => {
    const map: Record<string, string> = {}
    notes.forEach(n => {
      const raw = (n as unknown as Record<string, unknown>)['content']
      if (raw) map[n.id] = extractText(raw)
    })
    return map
  }, [notes])

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

  // ── Cluster hulls ──
  const clusterHulls = useMemo(() => {
    if (!showClusters) return []
    return folders.list.map(folder => {
      const nodes = simNodes.filter(n => { const info = infoByNodeId[n.id]; return info?.folder === folder && isVisible(info) })
      if (!nodes.length) return null
      let pts: Pt[] = nodes.map(n => ({ x: n.x, y: n.y }))
      if (pts.length < 3) {
        // Create a minimal polygon around the point(s)
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
        pts = [{ x: cx - 60, y: cy - 60 }, { x: cx + 60, y: cy - 60 }, { x: cx + 60, y: cy + 60 }, { x: cx - 60, y: cy + 60 }]
      }
      const hull = convexHull(pts)
      const expanded = expandHull(hull, 55)
      return { folder, path: hullToPath(expanded), color: colorOf(folder) }
    }).filter((h): h is { folder: string; path: string; color: string } => h !== null)
  }, [showClusters, simNodes, infoByNodeId, folders.list, isVisible, colorOf])

  // ── Shortest path ──
  const shortestPath = useMemo<string[] | null>(
    () => pathStart && pathEnd ? bfsPath(pathStart, pathEnd, edgePairs) : null,
    [pathStart, pathEnd, edgePairs]
  )
  const shortestPathSet  = useMemo(() => new Set(shortestPath ?? []), [shortestPath])
  const shortestEdgeSet  = useMemo(() => {
    if (!shortestPath) return new Set<string>()
    const s = new Set<string>()
    for (let i = 0; i < shortestPath.length - 1; i++) {
      s.add(`${shortestPath[i]}:${shortestPath[i + 1]}`)
      s.add(`${shortestPath[i + 1]}:${shortestPath[i]}`)
    }
    return s
  }, [shortestPath])

  const pathStartNote = pathStart ? graphData.nodes.find(n => n.id === pathStart) : null
  const pathEndNote   = pathEnd   ? graphData.nodes.find(n => n.id === pathEnd)   : null

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

          {/* Cluster view */}
          <button
            className="graph__chip"
            data-active={showClusters || undefined}
            onClick={() => setShowClusters(c => !c)}
            title="Mostrar agrupamento por pasta"
          >
            clusters
          </button>

          {/* Shortest path */}
          <button
            className="graph__chip"
            data-active={pathMode || undefined}
            onClick={() => { setPathMode(m => !m); if (pathMode) { setPathStart(null); setPathEnd(null) } }}
            title="Encontrar caminho mais curto entre dois nós"
          >
            {pathMode && pathStart && pathEnd && shortestPath
              ? `caminho (${shortestPath.length})`
              : 'caminho'}
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

        {/* Shortest-path banner */}
        {pathMode && (
          <div className="graph__focus-banner graph__path-banner">
            {!pathStart
              ? <span>🛤 Clique no <b>nó de origem</b></span>
              : !pathEnd
              ? <span>🛤 Origem: <b>{pathStartNote?.title ?? pathStart}</b> · clique no <b>destino</b></span>
              : shortestPath
              ? <span>🛤 <b>{pathStartNote?.title}</b> → <b>{pathEndNote?.title}</b> · {shortestPath.length - 1} salto{shortestPath.length !== 2 ? 's' : ''}</span>
              : <span>🛤 <b>{pathStartNote?.title}</b> → <b>{pathEndNote?.title}</b> · sem caminho</span>
            }
            {pathStart && (
              <button style={{ marginLeft: 4 }} onClick={() => { setPathStart(null); setPathEnd(null) }}>↺ reiniciar</button>
            )}
            <button onClick={() => { setPathMode(false); setPathStart(null); setPathEnd(null) }}>ESC · sair</button>
          </div>
        )}

        <svg ref={svgRef} className="graph__svg" width={size.w} height={size.h}>
          <defs>
            <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="var(--accent-terracotta)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent-terracotta)" stopOpacity="0"    />
            </radialGradient>
            <filter id="cluster-blur" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
          </defs>

          {/* ── Cluster hulls (background, per folder) ── */}
          {clusterHulls.map(({ folder, path: hullPath, color }) => (
            <path key={folder} d={hullPath} fill={color} opacity="0.1" filter="url(#cluster-blur)" />
          ))}

          {/* ── Edges ── */}
          {edgePairs.map(([a, b], i) => {
            const A = nodeById[a], B = nodeById[b]
            if (!A || !B) return null

            // In focus mode: hide edges not connected to focused node
            if (focusMode && (!neighborSet.has(a) || !neighborSet.has(b))) return null

            // Shortest path highlighting
            const onPath = shortestEdgeSet.has(`${a}:${b}`)
            if (pathMode && pathStart && pathEnd && !onPath) return (
              <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                stroke="var(--border-strong)" strokeWidth={1} strokeOpacity={0.06} />
            )
            if (onPath) return (
              <g key={i}>
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--accent-emerald)" strokeWidth={10} strokeOpacity={0.1} />
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--accent-emerald)" strokeWidth={2.5} strokeOpacity={0.7} />
              </g>
            )

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

            const isPinned  = pinnedIds.has(n.id)
            const isPathSrc = pathStart === n.id
            const isPathDst = pathEnd   === n.id
            const isOnPath  = shortestPathSet.has(n.id)
            // In path mode, dim everything not on the path (once a path is found)
            const pathDim = pathMode && pathStart && pathEnd && shortestPath && !isOnPath
            const effectiveDim = pathDim || dim

            return (
              <g key={n.id} transform={`translate(${n.x},${n.y})`}
                style={{ cursor: pathMode ? 'crosshair' : 'pointer', opacity: effectiveDim ? 0.12 : 1, transition: 'opacity .2s' }}
                onMouseEnter={() => !pathMode && onNodeEnter(n.id, n.x, n.y)}
                onMouseLeave={() => !pathMode && onNodeLeave()}
                onClick={() => {
                  if (pathMode) {
                    if (!pathStart) { setPathStart(n.id) }
                    else if (n.id !== pathStart && !pathEnd) { setPathEnd(n.id) }
                    else { setPathStart(n.id); setPathEnd(null) }
                  } else {
                    setSelected(n.id); setPanelOpen(true)
                  }
                }}
                onDoubleClick={() => !pathMode && togglePin(n.id)}
                onMouseDown={e => !pathMode && onNodeDown(e, n.id)}
              >
                {/* Glow halos */}
                <circle r={r * 3.2} fill={color} opacity={isFocus ? 0.07  : 0.03} />
                <circle r={r * 2}   fill={color} opacity={isFocus ? 0.12  : 0.05} />
                <circle r={r * 1.4} fill={color} opacity={isFocus ? 0.18  : 0.09} />
                {isFocus && <circle r={r + 9} fill="none" stroke={color} strokeWidth="1.2" opacity="0.4" />}
                {/* Path mode: source ring (emerald), destination ring (amber), on-path ring (electric) */}
                {isPathSrc && <circle r={r + 8} fill="none" stroke="var(--accent-emerald)" strokeWidth="2" opacity="0.85" />}
                {isPathDst && <circle r={r + 8} fill="none" stroke="var(--accent-amber)"   strokeWidth="2" opacity="0.85" />}
                {isOnPath && !isPathSrc && !isPathDst && <circle r={r + 6} fill="none" stroke="var(--accent-electric)" strokeWidth="1.5" opacity="0.6" />}
                {/* Body */}
                <circle r={r} fill="var(--bg-elevated)" stroke={
                  isPathSrc ? 'var(--accent-emerald)' : isPathDst ? 'var(--accent-amber)' : color
                } strokeWidth={isSelected || isPathSrc || isPathDst ? 2.5 : 1.5} />
                {isSelected && <circle r={r - 3} fill={color} opacity="0.75" />}
                {/* Pin indicator */}
                {isPinned && (
                  <circle cx={0} cy={-r - 6} r={3.5} fill={color} opacity={0.9} />
                )}
                {/* Label */}
                {showLabels && (
                  <text textAnchor="middle" dy={r + 15}
                    fontFamily="var(--font-sans)" fontSize="11"
                    fill={isFocus || isOnPath ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    style={{ pointerEvents: 'none', fontWeight: isSelected || isOnPath ? 600 : 400 }}>
                    {info.title.length > 22 ? info.title.slice(0, 22) + '…' : info.title}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* ── Hover tooltip ── */}
        {tooltip && (() => {
          const tInfo = infoByNodeId[tooltip.id]
          if (!tInfo) return null
          const tText = noteTextMap[tooltip.id] ?? ''
          return (
            <div className="graph__tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
              <div className="graph__tooltip-title">{tInfo.title}</div>
              <div className="graph__tooltip-folder" style={{ color: colorOf(tInfo.folder) }}>
                {FOLDER_LABEL[tInfo.folder] ?? tInfo.folder}
              </div>
              {tText && <div className="graph__tooltip-text">{tText}</div>}
              <div className="graph__tooltip-meta">{degree[tooltip.id] || 0} conexões · duplo-clique para fixar</div>
            </div>
          )
        })()}

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
              {/* Pin toggle */}
              <button
                className="graph__panel-link"
                onClick={() => togglePin(selNote.id)}
                style={pinnedIds.has(selNote.id) ? { color: 'var(--accent-electric)' } : undefined}
              >
                <span>📌</span>
                <span>{pinnedIds.has(selNote.id) ? 'Desafixar nó' : 'Fixar nó'}</span>
              </button>
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
