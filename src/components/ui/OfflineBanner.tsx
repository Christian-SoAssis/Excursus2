import { useEffect, useState } from 'react'
import { useSyncStore } from '../../store/sync'

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min`
  return `${Math.floor(m / 60)}h`
}

function fmtAgo(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 5)  return 'agora'
  if (s < 60) return `há ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m}min`
  return `há ${Math.floor(m / 60)}h`
}

export function OfflineBanner() {
  const { online, pendingCount, offlineSince, lastSyncedAt, failedIds, drainQueue, syncing } =
    useSyncStore()

  // Re-render every 10 s to update the durations
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  // Show banner only when offline OR when there are failed mutations
  const hasConflicts = failedIds.length > 0
  if (online && !hasConflicts) return null

  const offlineDuration = offlineSince ? fmtDuration(Date.now() - offlineSince) : null

  return (
    <div className={`offline-banner${!online ? ' offline-banner--offline' : ' offline-banner--conflict'}`}
         role="alert">
      <span className="offline-banner__dot" />
      <span className="offline-banner__text">
        {!online ? (
          <>
            Sem conexão{offlineDuration ? ` · ${offlineDuration}` : ''}.
            {pendingCount > 0 && (
              <> <strong>{pendingCount} {pendingCount === 1 ? 'alteração pendente' : 'alterações pendentes'}</strong>.</>
            )}
            {lastSyncedAt && (
              <> Último sync {fmtAgo(lastSyncedAt)}.</>
            )}
          </>
        ) : (
          <>
            {failedIds.length} {failedIds.length === 1 ? 'item com' : 'itens com'} erro ao sincronizar.{' '}
            <button className="offline-banner__retry" onClick={() => drainQueue()} disabled={syncing}>
              {syncing ? 'tentando…' : 'Tentar novamente'}
            </button>
          </>
        )}
      </span>
    </div>
  )
}
