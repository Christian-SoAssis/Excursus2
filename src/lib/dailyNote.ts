import type { JSONContent } from '@tiptap/react'

const WEEKDAYS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']
const MONTHS   = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']

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
  const d     = new Date()
  const label = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`
  return {
    type: 'doc',
    content: [
      {
        type: 'heading', attrs: { level: 2 },
        content: [{ type: 'text', text: `📅 ${label}` }],
      },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: 'Foco do dia' }],
      },
      {
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] },
        ],
      },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: 'Notas rápidas' }],
      },
      { type: 'paragraph' },
      {
        type: 'heading', attrs: { level: 3 },
        content: [{ type: 'text', text: 'Reflexão' }],
      },
      { type: 'paragraph' },
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
