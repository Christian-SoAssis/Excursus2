import { create } from 'zustand'
import type { JSONContent } from '@tiptap/react'
import { getNoteSuggestions, type NoteSuggestion, extractText } from '../lib/db'

// ── helpers ────────────────────────────────────────────────────────
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ── types ──────────────────────────────────────────────────────────
interface SuggestionsStore {
  items:       NoteSuggestion[]
  forNoteId:   string | null
  loading:     boolean
  visible:     boolean   // panel expanded
  noResults:   boolean   // forced search returned nothing

  /**
   * Maps each linked note's id → word-count of the active note at the
   * moment it was connected.  A linked note is suppressed from suggestions
   * until the active note grows by ≥ 50 words from that baseline.
   */
  linkedNotes: Record<string, number>

  fetch:         (noteId: string, content: JSONContent) => Promise<void>
  fetchFromText: (noteId: string, text: string) => Promise<void>
  dismiss:       (id: string) => void
  dismissAll:    () => void
  show:          () => void
  hide:          () => void
  /** Call whenever a note is linked (via pill or [[ picker). */
  markLinked:    (targetId: string, currentWordCount: number) => void
}

// ── core query ─────────────────────────────────────────────────────
async function runQuery(
  noteId: string,
  plain:  string,
  set:    (s: Partial<SuggestionsStore>) => void,
  get:    () => SuggestionsStore,
  forced: boolean,
) {
  if (plain.length < 15) return
  set({ loading: true, noResults: false })
  try {
    const all        = await getNoteSuggestions(noteId, plain)
    const currentWC  = countWords(plain)
    const linked     = get().linkedNotes

    // Suppress recently-linked notes until 50 more words have been written
    const items = all.filter(item => {
      const linkedAt = linked[item.id]
      if (linkedAt === undefined) return true          // never linked → show
      return currentWC - linkedAt >= 50               // enough new words → show again
    })

    if (items.length > 0) {
      const prev = get()
      // Open the panel automatically only when:
      //   • this is a forced/manual search, OR
      //   • we switched to a new note, OR
      //   • no suggestions were shown before (first appearance), OR
      //   • the panel was already open (keep it open with refreshed items)
      // Otherwise preserve the user's current visible state — so closing the
      // pill keeps it closed even as the auto-save keeps refreshing suggestions.
      const openPanel =
        forced ||
        prev.forNoteId !== noteId ||
        prev.items.length === 0 ||
        prev.visible
      set({ items, forNoteId: noteId, visible: openPanel, loading: false, noResults: false })
    } else {
      set({ items: [], forNoteId: noteId, loading: false,
            visible: forced,
            noResults: forced })
    }
  } catch {
    set({ loading: false })
  }
}

// ── store ──────────────────────────────────────────────────────────
export const useSuggestionsStore = create<SuggestionsStore>((set, get) => ({
  items:       [],
  forNoteId:   null,
  loading:     false,
  visible:     false,
  noResults:   false,
  linkedNotes: {},

  fetch: async (noteId, content) => {
    const plain = extractText(content).trim()
    await runQuery(noteId, plain, s => set(s as SuggestionsStore), get, false)
  },

  fetchFromText: async (noteId, text) => {
    await runQuery(noteId, text.trim(), s => set(s as SuggestionsStore), get, true)
  },

  dismiss: (id) => {
    const next = get().items.filter(s => s.id !== id)
    set({ items: next, visible: next.length > 0 })
  },

  dismissAll: () => set({ items: [], visible: false, noResults: false }),

  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),

  markLinked: (targetId, currentWordCount) => {
    set(s => ({
      linkedNotes: { ...s.linkedNotes, [targetId]: currentWordCount },
    }))
  },
}))
