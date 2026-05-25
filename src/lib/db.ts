import type { JSONContent } from '@tiptap/react'
import { supabase } from './supabase'
import { newId } from './id'

export interface Note {
  id: string
  title: string
  folder: string
  posX: number
  posY: number
  posW: number
  wordCount: number
  createdAt: string
  updatedAt: string
}

export interface GraphNode { id: string; title: string; folder: string }
export interface GraphEdge { aId: string; bId: string; kind: string; weight: number }
export interface GraphData { nodes: GraphNode[]; edges: GraphEdge[] }

type Row = {
  id: string; title: string; folder: string
  pos_x: number; pos_y: number; pos_w: number
  word_count: number; created_at: string; updated_at: string
}

function mapRow(r: Row): Note {
  return {
    id: r.id, title: r.title, folder: r.folder,
    posX: r.pos_x, posY: r.pos_y, posW: r.pos_w,
    wordCount: r.word_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/** Recursively extract plain text from a TipTap JSONContent tree. */
export function extractText(node: JSONContent): string {
  let t = ''
  if (node.type === 'text') t += (node.text ?? '') + ' '
  if (node.content) for (const c of node.content) t += extractText(c)
  return t
}

function countWords(content: JSONContent): number {
  return extractText(content).trim().split(/\s+/).filter(Boolean).length
}

function extractBacklinks(node: JSONContent): string[] {
  const ids: string[] = []
  if (node.type === 'backlink' && node.attrs?.noteId) ids.push(node.attrs.noteId as string)
  if (node.content) for (const c of node.content) ids.push(...extractBacklinks(c))
  return ids
}

export async function getNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, folder, pos_x, pos_y, pos_w, word_count, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

export async function getNoteContent(id: string): Promise<string> {
  const { data, error } = await supabase
    .from('notes')
    .select('content')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.content ?? ''
}

export async function saveNote(params: {
  id: string; title: string; folder: string; content: string
}): Promise<void> {
  let parsed: JSONContent = { type: 'doc', content: [] }
  try { parsed = JSON.parse(params.content) } catch {}
  const wordCount = countWords(parsed)

  const contentPlain = extractText(parsed).trim()

  const { error } = await supabase
    .from('notes')
    .upsert({
      id: params.id,
      title: params.title,
      folder: params.folder,
      content: params.content,
      content_plain: contentPlain,
      word_count: wordCount,
      updated_at: new Date().toISOString(),
    })
  if (error) throw new Error(error.message)
}

export async function createNote(params: {
  title: string; folder: string; posX: number; posY: number
}): Promise<string> {
  const id = newId()
  const { error } = await supabase
    .from('notes')
    .insert({
      id,
      title: params.title,
      folder: params.folder,
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      pos_x: params.posX,
      pos_y: params.posY,
      word_count: 0,
    })
  if (error) throw new Error(error.message)
  return id
}

export async function insertNoteWithId(params: {
  id: string; title: string; folder: string
  content: string; posX: number; posY: number
}): Promise<void> {
  const { error } = await supabase.from('notes').insert({
    id: params.id,
    title: params.title,
    folder: params.folder,
    content: params.content,
    pos_x: params.posX,
    pos_y: params.posY,
    word_count: 0,
  })
  if (error) throw new Error(error.message)
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function moveNote(id: string, posX: number, posY: number): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .update({ pos_x: posX, pos_y: posY, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getGraph(): Promise<GraphData> {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, folder, content')
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const nodes: GraphNode[] = rows.map(n => ({ id: n.id, title: n.title, folder: n.folder }))
  const edges: GraphEdge[] = []
  for (const note of rows) {
    try {
      const content: JSONContent = JSON.parse(note.content ?? '{}')
      for (const targetId of extractBacklinks(content)) {
        if (rows.some(n => n.id === targetId)) {
          edges.push({ aId: note.id, bId: targetId, kind: 'explicit', weight: 1 })
        }
      }
    } catch {}
  }
  return { nodes, edges }
}

export interface NoteSuggestion {
  id:    string
  title: string
  score: number
}

export async function getNoteSuggestions(
  noteId:       string,
  contentPlain: string,
): Promise<NoteSuggestion[]> {
  if (contentPlain.trim().length < 30) return []  // not enough text to compare
  const { data, error } = await supabase.rpc('get_note_suggestions', {
    p_note_id: noteId,
    p_content: contentPlain,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as NoteSuggestion[]
}

export async function searchNotes(query: string): Promise<Note[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, folder, pos_x, pos_y, pos_w, word_count, created_at, updated_at')
    .ilike('title', `%${q}%`)
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}
