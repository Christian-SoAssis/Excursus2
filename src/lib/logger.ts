/**
 * logger.ts — sistema de logs de diagnóstico do Excursus
 *
 * Uso:
 *   import { createLogger } from './logger'
 *   const log = createLogger('auth')
 *   log.info('tentativa de login', { email })
 *   log.error('falha no login', error)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  ts: number
  level: LogLevel
  module: string
  message: string
  data?: string   // JSON-serializado para não manter objetos grandes na memória
}

const MAX_ENTRIES  = 600
const STORAGE_KEY  = 'excursus-logs'

// ── Cache em memória ──────────────────────────────────────────────────────────
let _cache: LogEntry[] | null = null

function load(): LogEntry[] {
  if (_cache !== null) return _cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    _cache = raw ? (JSON.parse(raw) as LogEntry[]) : []
  } catch {
    _cache = []
  }
  return _cache
}

function persist(entries: LogEntry[]): void {
  _cache = entries
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {}
}

// ── Estilos no console ────────────────────────────────────────────────────────
const CONSOLE_STYLE: Record<LogLevel, string> = {
  debug: 'color:#888;font-size:11px',
  info:  'color:#60a5fa',
  warn:  'color:#fbbf24;font-weight:600',
  error: 'color:#f87171;font-weight:700',
}

function toConsole(entry: LogEntry): void {
  const time    = new Date(entry.ts).toISOString().slice(11, 23)
  const prefix  = `%c${time} [${entry.module}] ${entry.message}`
  const style   = CONSOLE_STYLE[entry.level]
  const extra   = entry.data ? (() => { try { return JSON.parse(entry.data) } catch { return entry.data } })() : undefined

  if (entry.level === 'error')       console.error(prefix, style, ...(extra !== undefined ? [extra] : []))
  else if (entry.level === 'warn')   console.warn(prefix,  style, ...(extra !== undefined ? [extra] : []))
  else                               console.log(prefix,   style, ...(extra !== undefined ? [extra] : []))
}

// ── Listeners para atualização em tempo real no LogViewer ────────────────────
type Listener = (entry: LogEntry) => void
const _listeners = new Set<Listener>()

export function onLog(fn: Listener): () => void {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

// ── Escrita ───────────────────────────────────────────────────────────────────
function write(level: LogLevel, module: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    level,
    module,
    message,
    ...(data !== undefined
      ? { data: (() => { try { return JSON.stringify(data) } catch { return String(data) } })() }
      : {}),
  }

  toConsole(entry)

  const entries = load()
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
  persist(entries)

  _listeners.forEach(fn => fn(entry))
}

// ── API pública ───────────────────────────────────────────────────────────────
export interface Logger {
  debug: (message: string, data?: unknown) => void
  info:  (message: string, data?: unknown) => void
  warn:  (message: string, data?: unknown) => void
  error: (message: string, data?: unknown) => void
}

export function createLogger(module: string): Logger {
  return {
    debug: (m, d) => write('debug', module, m, d),
    info:  (m, d) => write('info',  module, m, d),
    warn:  (m, d) => write('warn',  module, m, d),
    error: (m, d) => write('error', module, m, d),
  }
}

export function getLogs(): LogEntry[] {
  return [...load()]
}

export function clearLogs(): void {
  _cache = []
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
  _listeners.forEach(fn => fn({ id: '__clear__', ts: Date.now(), level: 'debug', module: 'logger', message: '__clear__' }))
}

export function exportLogsAsText(): string {
  return load()
    .map(e => {
      const time = new Date(e.ts).toISOString().replace('T', ' ').slice(0, 23)
      const data = e.data ? `\n    ${e.data}` : ''
      return `${time} [${e.level.toUpperCase().padEnd(5)}] [${e.module}] ${e.message}${data}`
    })
    .join('\n')
}

// ── Captura global de erros não tratados ─────────────────────────────────────
const _globalLog = createLogger('global')

export function installGlobalHandlers(): void {
  window.addEventListener('unhandledrejection', (e) => {
    _globalLog.error('Promise rejeitada sem tratamento', {
      reason: e.reason instanceof Error
        ? { message: e.reason.message, stack: e.reason.stack?.split('\n').slice(0, 5) }
        : String(e.reason),
    })
  })

  const _prevOnerror = window.onerror
  window.onerror = (msg, src, line, col, err) => {
    _globalLog.error('Erro não capturado', {
      message: String(msg),
      source: src,
      line,
      col,
      stack: err?.stack?.split('\n').slice(0, 5),
    })
    return _prevOnerror ? _prevOnerror(msg, src, line, col, err) : false
  }
}
