import { create } from 'zustand'
import { loadQueue, removeFromQueue } from '../lib/syncQueue'
import { saveNote, deleteNote, moveNote, insertNoteWithId } from '../lib/db'
import { pruneContentKeys } from '../lib/localCache'

interface SyncStore {
  online: boolean
  syncing: boolean
  pendingCount: number
  setOnline: (v: boolean) => void
  setPendingCount: (n: number) => void
  initNetworkWatcher: () => () => void
  drainQueue: () => Promise<void>
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncing: false,
  pendingCount: loadQueue().length,

  setOnline: (online) => set({ online }),
  setPendingCount: (pendingCount) => set({ pendingCount }),

  initNetworkWatcher: () => {
    set({ online: navigator.onLine })
    const onOnline  = () => { set({ online: true });  get().drainQueue() }
    const onOffline = () => set({ online: false })
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

    set({ syncing: true })
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
          // save
          await saveNote({ id, title: snapshot.title, folder: snapshot.folder, content: snapshot.content })
        }
        removeFromQueue(id)
        set(s => ({ pendingCount: Math.max(0, s.pendingCount - 1) }))
      } catch {
        // still offline or server error — stop draining, retry on next online event
        break
      }
    }

    set({ syncing: false })

    // prune stale content cache entries
    try {
      const { useNotesStore } = await import('./notes')
      const liveIds = new Set(useNotesStore.getState().notes.map(n => n.id))
      pruneContentKeys(liveIds)
    } catch {}
  },
}))
