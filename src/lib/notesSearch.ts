/**
 * Client-side TF-IDF search over cached note content.
 * No backend required — works entirely from the contentCache.
 */

import type { JSONContent } from '@tiptap/react'

// ── Text extraction ────────────────────────────────────────────────
function extractText(node: JSONContent): string {
  if (node.type === 'text') return (node.text ?? '') + ' '
  return (node.content ?? []).map(extractText).join('')
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2)
}

// ── TF-IDF ─────────────────────────────────────────────────────────
function tf(tokens: string[], term: string): number {
  const count = tokens.filter(t => t === term).length
  return count / Math.max(tokens.length, 1)
}

function idf(term: string, allTokenSets: string[][]): number {
  const docsWithTerm = allTokenSets.filter(set => set.includes(term)).length
  if (docsWithTerm === 0) return 0
  return Math.log(allTokenSets.length / docsWithTerm)
}

export interface NoteSearchResult {
  id:      string
  title:   string
  folder:  string
  score:   number
  excerpt: string  // ~300 chars of most relevant text
}

// ── Main search function ───────────────────────────────────────────
export function searchNotesLocally(
  query: string,
  notes: Array<{ id: string; title: string; folder: string }>,
  contentCache: Record<string, JSONContent | undefined>,
  limit = 5,
): NoteSearchResult[] {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []

  // Build token sets for all notes that have cached content
  const docs = notes
    .filter(n => contentCache[n.id])
    .map(n => {
      const raw  = extractText(contentCache[n.id]!)
      const text = n.title + ' ' + raw
      return { ...n, text, tokens: tokenize(text) }
    })

  if (docs.length === 0) return []

  const allTokenSets = docs.map(d => d.tokens)

  // Score each document
  const scored = docs.map(doc => {
    let score = 0
    for (const qTerm of queryTokens) {
      const termTf  = tf(doc.tokens, qTerm)
      const termIdf = idf(qTerm, allTokenSets)
      score += termTf * termIdf
    }
    // Bonus: title match
    const titleTokens = tokenize(doc.title)
    for (const qTerm of queryTokens) {
      if (titleTokens.includes(qTerm)) score += 0.5
    }
    return { ...doc, score }
  })

  return scored
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(d => ({
      id:     d.id,
      title:  d.title,
      folder: d.folder,
      score:  d.score,
      excerpt: buildExcerpt(d.text, queryTokens),
    }))
}

function buildExcerpt(text: string, queryTokens: string[]): string {
  const clean  = text.replace(/\s+/g, ' ').trim()
  const lower  = clean.toLowerCase()
  // Find the best window (300 chars) centered on the first query token hit
  for (const t of queryTokens) {
    const idx = lower.indexOf(t)
    if (idx !== -1) {
      const start = Math.max(0, idx - 80)
      const end   = Math.min(clean.length, start + 300)
      const slice = clean.slice(start, end)
      return (start > 0 ? '…' : '') + slice + (end < clean.length ? '…' : '')
    }
  }
  return clean.slice(0, 300) + (clean.length > 300 ? '…' : '')
}
