import type { Note } from './db'

const META_KEY = 'excursus-notes-meta'
const contentKey = (id: string) => `excursus-content-${id}`

export function saveNotesMeta(notes: Note[]): void {
  try { localStorage.setItem(META_KEY, JSON.stringify(notes)) } catch {}
}

export function loadNotesMeta(): Note[] {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '[]') } catch { return [] }
}

export function saveNoteContent(id: string, raw: string): void {
  try { localStorage.setItem(contentKey(id), raw) } catch {}
}

export function loadNoteContent(id: string): string | null {
  try { return localStorage.getItem(contentKey(id)) } catch { return null }
}

export function removeNoteContent(id: string): void {
  try { localStorage.removeItem(contentKey(id)) } catch {}
}

export function pruneContentKeys(liveIds: Set<string>): void {
  try {
    const prefix = 'excursus-content-'
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix) && !liveIds.has(k.slice(prefix.length)))
      .forEach(k => localStorage.removeItem(k))
  } catch {}
}
