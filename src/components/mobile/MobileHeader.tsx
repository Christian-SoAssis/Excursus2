import { useSyncStore } from '../../store/sync'

export function MobileHeader() {
  const { online, syncing } = useSyncStore()

  const syncLabel = syncing
    ? 'sincronizando…'
    : online
    ? 'em dia'
    : 'offline'

  return (
    <header className="mob-header">
      <div className="mob-header__logo">
        Excursus <em>beta</em>
      </div>
      <span className="mob-header__sync">{syncLabel}</span>
    </header>
  )
}
