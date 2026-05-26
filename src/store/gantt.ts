import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'

export interface GanttProject {
  id:        string
  name:      string
  color:     string
  createdAt: string
}

export interface GanttTask {
  id:        string
  projectId: string
  name:      string
  start:     string   // 'YYYY-MM-DD'
  end:       string   // 'YYYY-MM-DD'
  progress:  number   // 0–100
  order:     number
  noteId?:   string   // linked note
}

export type ZoomLevel = 'month' | 'week' | 'day'

interface GanttStore {
  projects:        GanttProject[]
  tasks:           GanttTask[]
  activeProjectId: string | null
  zoom:            ZoomLevel

  addProject:         (name: string, color: string) => string
  updateProject:      (id: string, patch: Partial<Pick<GanttProject, 'name' | 'color'>>) => void
  deleteProject:      (id: string) => void
  setActive:          (id: string | null) => void
  setZoom:            (z: ZoomLevel) => void

  addTask:            (t: Omit<GanttTask, 'id' | 'order' | 'noteId'>) => Promise<void>
  updateTask:         (id: string, patch: Partial<Omit<GanttTask, 'id' | 'projectId'>>) => void
  deleteTask:         (id: string) => void
  /** Ensures a task has an associated note, creating one lazily if needed. */
  ensureNoteForTask:  (taskId: string) => Promise<string | null>
}

async function getNotes() {
  const { useNotesStore } = await import('./notes')
  return useNotesStore.getState()
}

export const useGanttStore = create<GanttStore>()(
  persist(
    (set, get) => ({
      projects:        [],
      tasks:           [],
      activeProjectId: null,
      zoom:            'week',

      /* ── Projects ── */
      addProject: (name, color) => {
        const id = nanoid()
        set(s => ({
          projects:        [...s.projects, { id, name, color, createdAt: new Date().toISOString() }],
          activeProjectId: id,
        }))
        return id
      },

      updateProject: (id, patch) =>
        set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) })),

      deleteProject: (id) => {
        // delete all linked notes first
        const tasks = get().tasks.filter(t => t.projectId === id)
        getNotes().then(ns => {
          tasks.forEach(t => { if (t.noteId) ns.deleteNote(t.noteId) })
        })
        set(s => ({
          projects:        s.projects.filter(p => p.id !== id),
          tasks:           s.tasks.filter(t => t.projectId !== id),
          activeProjectId: s.activeProjectId === id
            ? (s.projects.find(p => p.id !== id)?.id ?? null)
            : s.activeProjectId,
        }))
      },

      setActive: (id) => set({ activeProjectId: id }),
      setZoom:   (zoom) => set({ zoom }),

      /* ── Tasks ── */
      addTask: async (t) => {
        const project = get().projects.find(p => p.id === t.projectId)
        const folder  = project?.name ?? 'inbox'

        // create note first so we have the noteId
        const ns     = await getNotes()
        const noteId = await ns.createNote(t.name, folder)

        const order = get().tasks.filter(x => x.projectId === t.projectId).length
        set(s => ({ tasks: [...s.tasks, { ...t, id: nanoid(), order, noteId }] }))
      },

      updateTask: (id, patch) => {
        const task = get().tasks.find(t => t.id === id)
        // keep note title in sync when the task name changes
        if (task?.noteId && patch.name && patch.name !== task.name) {
          getNotes().then(ns => ns.renameNote(task.noteId!, patch.name!))
        }
        set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) }))
      },

      deleteTask: (id) => {
        const task = get().tasks.find(t => t.id === id)
        if (task?.noteId) {
          getNotes().then(ns => ns.deleteNote(task.noteId!))
        }
        set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
      },

      ensureNoteForTask: async (taskId) => {
        const task = get().tasks.find(t => t.id === taskId)
        if (!task) return null
        if (task.noteId) return task.noteId

        // legacy task without a note — create one lazily
        const project = get().projects.find(p => p.id === task.projectId)
        const folder  = project?.name ?? 'inbox'
        const ns      = await getNotes()
        const noteId  = await ns.createNote(task.name, folder)

        set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? { ...t, noteId } : t) }))
        return noteId
      },
    }),
    { name: 'excursus-gantt' }
  )
)
