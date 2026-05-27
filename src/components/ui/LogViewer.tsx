import { useEffect, useRef, useState } from 'react'
import { getLogs, clearLogs, exportLogsAsText, onLog, type LogEntry, type LogLevel } from '../../lib/logger'

// ── Constantes ────────────────────────────────────────────────────────────────
const LEVEL_ORDER: LogLevel[] = ['debug', 'info', 'warn', 'error']

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'debug',
  info:  'info',
  warn:  'warn',
  error: 'erro',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 23)
}

function getModules(entries: LogEntry[]): string[] {
  const set = new Set(entries.map(e => e.module))
  return ['all', ...Array.from(set).sort()]
}

// ── Componente de uma linha de log ────────────────────────────────────────────
function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasData = Boolean(entry.data)

  const prettyData = hasData
    ? (() => { try { return JSON.stringify(JSON.parse(entry.data!), null, 2) } catch { return entry.data! } })()
    : null

  return (
    <div
      className={`lv-row lv-row--${entry.level}${hasData ? ' lv-row--clickable' : ''}`}
      onClick={() => hasData && setExpanded(v => !v)}
    >
      <span className="lv-time">{formatTime(entry.ts)}</span>
      <span className={`lv-badge lv-badge--${entry.level}`}>{LEVEL_LABEL[entry.level]}</span>
      <span className="lv-module">[{entry.module}]</span>
      <span className="lv-msg">{entry.message}</span>
      {hasData && <span className="lv-expand">{expanded ? '▲' : '▼'}</span>}

      {expanded && prettyData && (
        <pre className="lv-data">{prettyData}</pre>
      )}
    </div>
  )
}

// ── Painel principal ──────────────────────────────────────────────────────────
export function LogViewer({ onClose }: { onClose: () => void }) {
  const [entries,      setEntries]    = useState<LogEntry[]>(() => getLogs())
  const [levelFilter,  setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [moduleFilter, setModuleFilter] = useState<string>('all')
  const [autoScroll,   setAutoScroll]  = useState(true)
  const [copied,       setCopied]      = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Escuta novos logs em tempo real
  useEffect(() => {
    return onLog((entry) => {
      if (entry.message === '__clear__') {
        setEntries([])
        return
      }
      setEntries(prev => {
        const next = [...prev, entry]
        return next.length > 600 ? next.slice(-600) : next
      })
    })
  }, [])

  // Auto-scroll para o fim
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [entries, autoScroll])

  // Fechar com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Filtros
  const levelIndex = LEVEL_ORDER.indexOf(levelFilter as LogLevel)
  const filtered = entries.filter(e => {
    if (levelFilter !== 'all' && LEVEL_ORDER.indexOf(e.level) < levelIndex) return false
    if (moduleFilter !== 'all' && e.module !== moduleFilter) return false
    return true
  })

  const modules = getModules(entries)

  // Contadores por nível
  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.level] = (acc[e.level] ?? 0) + 1
    return acc
  }, {})

  const handleCopy = () => {
    navigator.clipboard.writeText(exportLogsAsText()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownload = () => {
    const blob = new Blob([exportLogsAsText()], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `excursus-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    clearLogs()
    setEntries([])
  }

  return (
    <>
      <div className="lv-overlay" onClick={onClose} />

      <div className="lv-panel" role="dialog" aria-label="Logs de diagnóstico">

        {/* ── Cabeçalho ── */}
        <div className="lv-header">
          <div className="lv-header-left">
            <span className="lv-title">Logs de diagnóstico</span>
            <span className="lv-count">{filtered.length} / {entries.length}</span>
          </div>
          <div className="lv-header-right">
            <button className="lv-btn lv-btn--ghost" onClick={handleCopy} title="Copiar como texto">
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
            <button className="lv-btn lv-btn--ghost" onClick={handleDownload} title="Baixar como .txt">
              Baixar
            </button>
            <button className="lv-btn lv-btn--danger" onClick={handleClear} title="Limpar todos os logs">
              Limpar
            </button>
            <button className="lv-close" onClick={onClose} aria-label="Fechar">✕</button>
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="lv-toolbar">
          {/* Nível */}
          <div className="lv-filters">
            {(['all', ...LEVEL_ORDER] as const).map(lvl => (
              <button
                key={lvl}
                className={`lv-filter lv-filter--${lvl}${levelFilter === lvl ? ' is-active' : ''}`}
                onClick={() => setLevelFilter(lvl)}
              >
                {lvl === 'all' ? 'Todos' : LEVEL_LABEL[lvl as LogLevel]}
                {lvl !== 'all' && counts[lvl] ? (
                  <span className="lv-filter-count">{counts[lvl]}</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Módulo */}
          <select
            className="lv-module-select"
            value={moduleFilter}
            onChange={e => setModuleFilter(e.target.value)}
          >
            {modules.map(m => (
              <option key={m} value={m}>{m === 'all' ? 'Todos os módulos' : m}</option>
            ))}
          </select>

          {/* Auto-scroll */}
          <label className="lv-autoscroll">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
            />
            <span>Auto-scroll</span>
          </label>
        </div>

        {/* ── Lista de logs ── */}
        <div className="lv-list">
          {filtered.length === 0 ? (
            <div className="lv-empty">
              {entries.length === 0 ? 'Nenhum log registrado ainda.' : 'Nenhum log com esses filtros.'}
            </div>
          ) : (
            filtered.map(entry => <LogRow key={entry.id} entry={entry} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  )
}
