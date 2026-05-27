import { useMemo } from 'react'
import { useNotesStore } from '../../store/notes'

// ── Helpers ───────────────────────────────────────────────────────

function thisWeekStart(): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay()) // Sunday
  return d
}

// ── Component ─────────────────────────────────────────────────────

export function WritingStatsCard() {
  const notes = useNotesStore(s => s.notes)

  const stats = useMemo(() => {
    const weekStart = thisWeekStart()
    const totalWords = notes.reduce((sum, n) => sum + (n.wordCount ?? 0), 0)
    const thisWeek   = notes.filter(n => new Date(n.createdAt) >= weekStart).length

    // Folder breakdown
    const folderCounts: Record<string, number> = {}
    for (const n of notes) {
      folderCounts[n.folder] = (folderCounts[n.folder] ?? 0) + 1
    }
    const topFolders = Object.entries(folderCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)

    const maxFolderCount = topFolders[0]?.[1] ?? 1

    // Most recently updated
    const recent = [...notes]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)

    return { totalWords, thisWeek, topFolders, maxFolderCount, recent }
  }, [notes])

  if (notes.length === 0) return null

  return (
    <div className="wstats">
      <div className="wstats__header">
        <span className="wstats__title">Estatísticas de escrita</span>
      </div>

      {/* ── Top row of key numbers ── */}
      <div className="wstats__kpis">
        <div className="wstats__kpi">
          <span className="wstats__kpi-value">{notes.length}</span>
          <span className="wstats__kpi-label">notas</span>
        </div>
        <div className="wstats__kpi">
          <span className="wstats__kpi-value">{stats.totalWords.toLocaleString('pt-BR')}</span>
          <span className="wstats__kpi-label">palavras</span>
        </div>
        <div className="wstats__kpi">
          <span className="wstats__kpi-value">{stats.thisWeek}</span>
          <span className="wstats__kpi-label">esta semana</span>
        </div>
        <div className="wstats__kpi">
          <span className="wstats__kpi-value">
            {notes.length ? Math.round(stats.totalWords / notes.length) : 0}
          </span>
          <span className="wstats__kpi-label">palavras/nota</span>
        </div>
      </div>

      {/* ── Folder breakdown ── */}
      {stats.topFolders.length > 0 && (
        <div className="wstats__section">
          <div className="wstats__section-title">Pastas</div>
          <div className="wstats__bars">
            {stats.topFolders.map(([folder, count]) => (
              <div key={folder} className="wstats__bar-row">
                <span className="wstats__bar-label">{folder}</span>
                <div className="wstats__bar-track">
                  <div
                    className="wstats__bar-fill"
                    style={{ width: `${(count / stats.maxFolderCount) * 100}%` }}
                  />
                </div>
                <span className="wstats__bar-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recently updated ── */}
      {stats.recent.length > 0 && (
        <div className="wstats__section">
          <div className="wstats__section-title">Recentes</div>
          <div className="wstats__recent">
            {stats.recent.map(n => (
              <div key={n.id} className="wstats__recent-item">
                <span className="wstats__recent-title">{n.title}</span>
                <span className="wstats__recent-meta">
                  {n.wordCount} pal · {n.folder}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
