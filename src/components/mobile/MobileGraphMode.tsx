import { useEffect, useMemo, useState } from 'react'
import { getGraph, type GraphData } from '../../lib/db'
import { useUIStore } from '../../store/ui'

export function MobileGraphMode() {
  const { setMode } = useUIStore()
  const [graph,    setGraph]    = useState<GraphData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    getGraph()
      .then(setGraph)
      .catch(() => setGraph({ nodes: [], edges: [] }))
      .finally(() => setLoading(false))
  }, [])

  // Mapa de contagem de conexões por nó
  const connectionCount = useMemo(() => {
    if (!graph) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const e of graph.edges) {
      map.set(e.aId, (map.get(e.aId) ?? 0) + 1)
      map.set(e.bId, (map.get(e.bId) ?? 0) + 1)
    }
    return map
  }, [graph])

  // Nós filtrados e ordenados por conexões
  const filteredNodes = useMemo(() => {
    if (!graph) return []
    const q = search.toLowerCase()
    return graph.nodes
      .filter(n => !q || n.title.toLowerCase().includes(q) || n.folder.toLowerCase().includes(q))
      .sort((a, b) => (connectionCount.get(b.id) ?? 0) - (connectionCount.get(a.id) ?? 0))
  }, [graph, search, connectionCount])

  // Conexões do nó selecionado
  const connectedNodes = useMemo(() => {
    if (!graph || !selected) return []
    const connIds = new Set<string>()
    for (const e of graph.edges) {
      if (e.aId === selected) connIds.add(e.bId)
      if (e.bId === selected) connIds.add(e.aId)
    }
    return graph.nodes.filter(n => connIds.has(n.id))
  }, [graph, selected])

  const selectedNode = graph?.nodes.find(n => n.id === selected)

  if (loading) {
    return (
      <div className="mob-graph">
        <div className="mob-graph__loading">Carregando grafo…</div>
      </div>
    )
  }

  // Vista de detalhe de um nó
  if (selected && selectedNode) {
    return (
      <div className="mob-graph">
        <div className="mob-graph__detail-header">
          <button className="mob-graph__back" onClick={() => setSelected(null)}>← Grafo</button>
          <span className="mob-graph__detail-title">{selectedNode.title || 'Sem título'}</span>
        </div>

        <div className="mob-graph__detail-meta">
          <span className="mob-graph__folder-pill">{selectedNode.folder}</span>
          <span className="mob-graph__conn-count">
            {connectionCount.get(selected) ?? 0} conexões
          </span>
        </div>

        {connectedNodes.length > 0 ? (
          <>
            <div className="mob-graph__section-label">Notas conectadas</div>
            <div className="mob-graph__list">
              {connectedNodes.map(n => (
                <button
                  key={n.id}
                  className="mob-graph__item"
                  onClick={() => setSelected(n.id)}
                >
                  <div className="mob-graph__item-title">{n.title || 'Sem título'}</div>
                  <div className="mob-graph__item-meta">
                    <span className="mob-graph__folder-pill mob-graph__folder-pill--sm">{n.folder}</span>
                    <span className="mob-graph__item-links">
                      {connectionCount.get(n.id) ?? 0} links
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mob-graph__empty">Nenhuma conexão — adicione backlinks na nota para ver aqui.</div>
        )}

        <button
          className="mob-graph__open-btn"
          onClick={() => setMode('floating')}
        >
          ✎ Abrir em Notas
        </button>
      </div>
    )
  }

  // Lista principal
  return (
    <div className="mob-graph">
      <div className="mob-graph__header">
        <input
          className="mob-graph__search"
          placeholder="Buscar notas…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="mob-graph__total">{graph?.nodes.length ?? 0} notas</span>
      </div>

      {filteredNodes.length === 0 ? (
        <div className="mob-graph__empty">
          {search ? 'Nenhuma nota encontrada.' : 'Nenhuma nota com conexões ainda.'}
        </div>
      ) : (
        <div className="mob-graph__list">
          {filteredNodes.map(node => {
            const count = connectionCount.get(node.id) ?? 0
            return (
              <button
                key={node.id}
                className="mob-graph__item"
                onClick={() => setSelected(node.id)}
              >
                {/* Barra de conexões proporcional */}
                <div
                  className="mob-graph__item-bar"
                  style={{
                    width: `${Math.min(100, count * 20)}%`,
                    opacity: count > 0 ? 1 : 0,
                  }}
                />
                <div className="mob-graph__item-content">
                  <div className="mob-graph__item-title">{node.title || 'Sem título'}</div>
                  <div className="mob-graph__item-meta">
                    <span className="mob-graph__folder-pill mob-graph__folder-pill--sm">{node.folder}</span>
                    {count > 0 && (
                      <span className="mob-graph__item-links">{count} link{count !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <span className="mob-graph__item-arrow">›</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
