import type { JSONContent } from '@tiptap/react'

/** Returns today's key string, e.g. "05/06/2026" */
export function dailyTitle(): string {
  const d = new Date()
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/')
}

/** Pre-filled TipTap JSON content for the daily note template */
export function dailyContent(): JSONContent {
  const h3 = (text: string) => ({
    type: 'heading' as const, attrs: { level: 3},
    content: [{ type: 'text' as const, text }],
  })
  const p = () => ({ type: 'paragraph' as const })
  const ti = () => ({ type: 'taskItem' as const, attrs: { checked: false }, content: [p()] })

  return {
    type: 'doc',
    content: [
      h3('Foco do dia'),
      { type: 'taskList', content: [ti(), ti()] },
      h3('Notas rápidas'),
      p(),
      h3('Reflexão'),
      p(),
    ],
  }
}

/**
 * Opens an existing daily note or creates a new one with the template.
 * Uses store.getState() directly so it can be called from anywhere.
 */
export async function openOrCreateDailyNote(): Promise<void> {
  // Lazy import to avoid circular deps
  const { useNotesStore } = await import('../store/notes')
  const { useUIStore }    = await import('../store/ui')

  const { notes, createNote, setActiveNote, cacheContent, saveNoteContent } = useNotesStore.getState()
  const { setMode } = useUIStore.getState()

  const title    = dailyTitle()
  const existing = notes.find(n => n.title === title && n.folder === 'diário')

  if (existing) {
    setActiveNote(existing.id)
  } else {
    const content = dailyContent()
    const id      = await createNote(title, 'diário')
    // Override the empty content with the daily template
    cacheContent(id, content)
    saveNoteContent(id, title, 'diário', content)
    setActiveNote(id)
  }

  setMode('floating')
}
