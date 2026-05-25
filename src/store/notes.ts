import { create } from 'zustand'
import type { JSONContent } from '@tiptap/react'
import {
  getNotes, saveNote, deleteNote as deleteNoteDb,
  moveNote as moveNoteDb, insertNoteWithId, type Note,
} from '../lib/db'
import { newId } from '../lib/id'
import {
  saveNotesMeta, loadNotesMeta,
  saveNoteContent as cacheNoteContent,
  removeNoteContent, pruneContentKeys,
} from '../lib/localCache'
import { enqueue, loadQueue } from '../lib/syncQueue'
import { toast } from 'sonner'

const FOLDERS_KEY = 'excursus-folders'

function loadCustomFolders(): string[] {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]') }
  catch { return [] }
}

function saveCustomFolders(folders: string[]) {
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)) }
  catch {}
}

const EMPTY_CONTENT = '{"type":"doc","content":[{"type":"paragraph"}]}'

interface NotesStore {
  notes: Note[]
  activeNoteId: string | null
  contentCache: Record<string, JSONContent>
  customFolders: string[]
  loadNotes: () => Promise<void>
  setActiveNote: (id: string) => void
  saveNoteContent: (id: string, title: string, folder: string, content: JSONContent) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  moveNote: (id: string, posX: number, posY: number, localOnly?: boolean) => Promise<void>
  createNote: (title?: string, folder?: string, posX?: number, posY?: number) => Promise<string>
  renameNote: (id: string, title: string) => Promise<void>
  moveToFolder: (id: string, folder: string) => Promise<void>
  createFolder: (name: string) => void
  deleteFolder: (name: string) => void
  cacheContent: (id: string, content: JSONContent) => void
}

function getSyncStore() {
  // lazy import to avoid circular dep at module init time
  return import('./sync').then(m => m.useSyncStore.getState())
}

function refreshPendingCount() {
  getSyncStore().then(s => s.setPendingCount(loadQueue().length))
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  activeNoteId: null,
  contentCache: {},
  customFolders: loadCustomFolders(),

  loadNotes: async () => {
    try {
      const notes = await getNotes()
      set({ notes })
      saveNotesMeta(notes)
      pruneContentKeys(new Set(notes.map(n => n.id)))
    } catch {
      const cached = loadNotesMeta()
      if (cached.length > 0) {
        set({ notes: cached })
      } else {
        toast.error('Offline — sem notas em cache')
      }
    }
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  saveNoteContent: async (id, title, folder, content) => {
    const raw = JSON.stringify(content)
    // optimistic: update state and local cache immediately
    set(s => ({
      notes: s.notes.map(n => n.id === id ? { ...n, title, updatedAt: new Date().toISOString() } : n),
      contentCache: { ...s.contentCache, [id]: content },
    }))
    cacheNoteContent(id, raw)
    saveNotesMeta(get().notes)

    try {
      await saveNote({ id, title, folder, content: raw })
    } catch {
      const note = get().notes.find(n => n.id === id)
      enqueue({
        id, kind: 'save',
        snapshot: { title, folder, content: raw, posX: note?.posX ?? 0, posY: note?.posY ?? 0 },
        enqueuedAt: new Date().toISOString(),
      })
      refreshPendingCount()
    }
  },

  deleteNote: async (id) => {
    // optimistic removal
    set(s => ({
      notes: s.notes.filter(n => n.id !== id),
      activeNoteId: s.activeNoteId === id ? (s.notes.find(n => n.id !== id)?.id ?? null) : s.activeNoteId,
    }))
    saveNotesMeta(get().notes)
    removeNoteContent(id)

    try {
      await deleteNoteDb(id)
    } catch {
      enqueue({
        id, kind: 'delete',
        snapshot: { title: '', folder: '', content: '', posX: 0, posY: 0 },
        enqueuedAt: new Date().toISOString(),
      })
      refreshPendingCount()
    }
  },

  moveNote: async (id, posX, posY, localOnly = false) => {
    set(s => ({
      notes: s.notes.map(n => n.id === id ? { ...n, posX, posY } : n),
    }))
    if (localOnly) return
    saveNotesMeta(get().notes)
    try {
      await moveNoteDb(id, posX, posY)
    } catch {
      const note = get().notes.find(n => n.id === id)
      enqueue({
        id, kind: 'move',
        snapshot: {
          title: note?.title ?? '', folder: note?.folder ?? '',
          content: '', posX, posY,
        },
        enqueuedAt: new Date().toISOString(),
      })
      refreshPendingCount()
    }
  },

  createNote: async (title = 'Sem título', folder = 'inbox', posX = 120, posY = 120) => {
    const id = newId()
    const now = new Date().toISOString()
    const newNote: Note = { id, title, folder, posX, posY, posW: 320, wordCount: 0, createdAt: now, updatedAt: now }

    // optimistic: note appears immediately
    set(s => ({ notes: [newNote, ...s.notes], activeNoteId: id }))
    cacheNoteContent(id, EMPTY_CONTENT)
    saveNotesMeta(get().notes)

    try {
      await insertNoteWithId({ id, title, folder, content: EMPTY_CONTENT, posX, posY })
    } catch {
      enqueue({
        id, kind: 'create',
        snapshot: { title, folder, content: EMPTY_CONTENT, posX, posY },
        enqueuedAt: now,
      })
      refreshPendingCount()
    }
    return id
  },

  renameNote: async (id, title) => {
    const note = get().notes.find(n => n.id === id)
    if (!note) return
    const content = get().contentCache[id] ?? { type: 'doc', content: [{ type: 'paragraph' }] }
    const raw = JSON.stringify(content)

    set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, title } : n) }))
    saveNotesMeta(get().notes)

    try {
      await saveNote({ id, title, folder: note.folder, content: raw })
    } catch {
      enqueue({
        id, kind: 'save',
        snapshot: { title, folder: note.folder, content: raw, posX: note.posX, posY: note.posY },
        enqueuedAt: new Date().toISOString(),
      })
      refreshPendingCount()
    }
  },

  moveToFolder: async (id, folder) => {
    const note = get().notes.find(n => n.id === id)
    if (!note) return
    const content = get().contentCache[id] ?? { type: 'doc', content: [{ type: 'paragraph' }] }
    const raw = JSON.stringify(content)

    set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, folder } : n) }))
    saveNotesMeta(get().notes)

    try {
      await saveNote({ id, title: note.title, folder, content: raw })
    } catch {
      enqueue({
        id, kind: 'save',
        snapshot: { title: note.title, folder, content: raw, posX: note.posX, posY: note.posY },
        enqueuedAt: new Date().toISOString(),
      })
      refreshPendingCount()
    }
  },

  createFolder: (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    set(s => {
      const next = s.customFolders.includes(trimmed) ? s.customFolders : [...s.customFolders, trimmed]
      saveCustomFolders(next)
      return { customFolders: next }
    })
  },

  deleteFolder: (name) => {
    set(s => {
      const next = s.customFolders.filter(f => f !== name)
      saveCustomFolders(next)
      return { customFolders: next }
    })
  },

  cacheContent: (id, content) =>
    set(s => ({ contentCache: { ...s.contentCache, [id]: content } })),
}))
