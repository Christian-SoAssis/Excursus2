import { create } from 'zustand'
import { loadQueue, removeFromQueue } from '../lib/syncQueue'
import { saveNote, deleteNote, moveNote, insertNoteWithId } from '../lib/db'
import { pruneContentKeys } from '../lib/localCache'

interface SyncStore {
  online: boolean
  syncing: boolean
  pendingCount: number
  homeSyncing: boolean
  homePending: boolean
  lastSyncedAt: number | null   // timestamp ms of last successful full drain
  offlineSince:  number | null  // timestamp ms when offline started
  failedIds: string[]           // ids that failed on last drain attempt
  setOnline: (v: boolean) => void
  setPendingCount: (n: number) => void
  setHomeSyncing: (v: boolean) => void
  setHomePending: (v: boolean) => void
  initNetworkWatcher: () => () => void
  drainQueue: () => Promise<void>
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  pendingCount: loadQueue().length,
  homeSyncing: false,
  homePending: false,
  lastSyncedAt: null,
  offlineSince:  null,
  failedIds: [],

  setOnline: (online) => set({ online }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setHomeSyncing: (homeSyncing) => set({ homeSyncing }),
  setHomePending: (homePending) => set({ homePending }),

  initNetworkWatcher: () => {
    const isOnline = navigator.onLine
    set({
      online: isOnline,
      offlineSince: isOnline ? null : Date.now(),
    })
    const onOnline  = () => {
      set({ online: true, offlineSince: null })
      get().drainQueue()
    }
    const onOffline = () => set({ online: false, offlineSince: Date.now() })
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  },

  drainQueue: async () => {
    if (get().syncing || !get().online) return
    const queue = loadQueue()
    if (queue.length === 0) return

    set({ syncing: true, failedIds: [] })
    const newFailed: string[] = []

    for (const mutation of queue) {
      try {
        const { id, kind, snapshot } = mutation
        if (kind === 'delete') {
          await deleteNote(id)
        } else if (kind === 'create') {
          await insertNoteWithId({
            id,
            title: snapshot.title,
            folder: snapshot.folder,
            content: snapshot.content,
            posX: snapshot.posX,
            posY: snapshot.posY,
          })
        } else if (kind === 'move') {
          await moveNote(id, snapshot.posX, snapshot.posY)
        } else {
          await saveNote({ id, title: snapshot.title, folder: snapshot.folder, content: snapshot.content })
        }
        removeFromQueue(id)
        set(s => ({ pendingCount: Math.max(0, s.pendingCount - 1) }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        // 409 conflict: remove from queue (last-write-wins — local already applied)
        if (msg.includes('409') || msg.includes('conflict') || msg.includes('duplicate')) {
          removeFromQueue(mutation.id)
          set(s => ({ pendingCount: Math.max(0, s.pendingCount - 1) }))
        } else {
          // Network/server error — stop, retry later
          newFailed.push(mutation.id)
          break
        }
      }
    }

    const remaining = loadQueue().length
    set({
      syncing: false,
      failedIds: newFailed,
      pendingCount: remaining,
      ...(remaining === 0 && newFailed.length === 0 ? { lastSyncedAt: Date.now() } : {}),
    })

    // prune stale content cache entries
    try {
      const { useNotesStore } = await import('./notes')
      const liveIds = new Set(useNotesStore.getState().notes.map(n => n.id))
      pruneContentKeys(liveIds)
    } catch {}
  },
}))
