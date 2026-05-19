import { create } from 'zustand'
import type { JSONContent } from '@tiptap/react'
import { getNotes, saveNote, deleteNote as deleteNoteDb, moveNote as moveNoteDb, createNote as createNoteDb, type Note } from '../lib/db'
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

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: [],
  activeNoteId: null,
  contentCache: {},
  customFolders: loadCustomFolders(),

  loadNotes: async () => {
    try {
      const notes = await getNotes()
      set({ notes })
    } catch {
      toast.error('Erro ao carregar notas')
    }
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  saveNoteContent: async (id, title, folder, content) => {
    try {
      await saveNote({ id, title, folder, content: JSON.stringify(content) })
      set(s => ({
        notes: s.notes.map(n =>
          n.id === id ? { ...n, title, updatedAt: new Date().toISOString() } : n
        ),
        contentCache: { ...s.contentCache, [id]: content },
      }))
    } catch {
      toast.error('Não foi possível salvar. Verifique o espaço em disco.')
    }
  },

  deleteNote: async (id) => {
    try {
      await deleteNoteDb(id)
      set(s => ({
        notes: s.notes.filter(n => n.id !== id),
        activeNoteId: s.activeNoteId === id ? (s.notes.find(n => n.id !== id)?.id ?? null) : s.activeNoteId,
      }))
    } catch {
      toast.error('Erro ao deletar nota')
    }
  },

  moveNote: async (id, posX, posY, localOnly = false) => {
    set(s => ({
      notes: s.notes.map(n => n.id === id ? { ...n, posX, posY } : n),
    }))
    if (localOnly) return
    try {
      await moveNoteDb(id, posX, posY)
    } catch {
      toast.error('Erro ao mover nota')
    }
  },

  createNote: async (title = 'Sem título', folder = 'inbox', posX = 120, posY = 120) => {
    try {
      const id = await createNoteDb({ title, folder, posX, posY })
      await get().loadNotes()
      set({ activeNoteId: id })
      return id
    } catch (e) {
      toast.error('Erro ao criar nota')
      throw e
    }
  },

  renameNote: async (id, title) => {
    const note = get().notes.find(n => n.id === id)
    if (!note) return
    const content = get().contentCache[id] ?? { type: 'doc', content: [{ type: 'paragraph' }] }
    try {
      await saveNote({ id, title, folder: note.folder, content: JSON.stringify(content) })
      set(s => ({
        notes: s.notes.map(n => n.id === id ? { ...n, title } : n),
      }))
    } catch {
      toast.error('Erro ao renomear nota')
    }
  },

  moveToFolder: async (id, folder) => {
    const note = get().notes.find(n => n.id === id)
    if (!note) return
    const content = get().contentCache[id] ?? { type: 'doc', content: [{ type: 'paragraph' }] }
    try {
      await saveNote({ id, title: note.title, folder, content: JSON.stringify(content) })
      set(s => ({
        notes: s.notes.map(n => n.id === id ? { ...n, folder } : n),
      }))
    } catch {
      toast.error('Erro ao mover nota')
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
