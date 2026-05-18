import { invoke } from '@tauri-apps/api/core'

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

type RawNote = {
  id: string; title: string; folder: string;
  pos_x: number; pos_y: number; pos_w: number;
  word_count: number; created_at: string; updated_at: string;
}

function mapNote(r: RawNote): Note {
  return {
    id: r.id, title: r.title, folder: r.folder,
    posX: r.pos_x, posY: r.pos_y, posW: r.pos_w,
    wordCount: r.word_count, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

export async function getNotes(): Promise<Note[]> {
  const rows = await invoke<RawNote[]>('get_notes')
  return rows.map(mapNote)
}

export async function getNoteContent(id: string): Promise<string> {
  return invoke<string>('get_note_content', { id })
}

export async function saveNote(params: {
  id: string; title: string; folder: string; content: string
}): Promise<void> {
  await invoke('save_note', params)
}

export async function createNote(params: {
  title: string; folder: string; posX: number; posY: number
}): Promise<string> {
  return invoke<string>('create_note', {
    title: params.title,
    folder: params.folder,
    posX: params.posX,
    posY: params.posY,
  })
}

export async function deleteNote(id: string): Promise<void> {
  await invoke('delete_note', { id })
}

export async function moveNote(id: string, posX: number, posY: number): Promise<void> {
  await invoke('move_note', { id, posX, posY })
}

export async function getGraph(): Promise<GraphData> {
  const raw = await invoke<{ nodes: GraphNode[]; edges: Array<{ a_id: string; b_id: string; kind: string; weight: number }> }>('get_graph')
  return {
    nodes: raw.nodes,
    edges: raw.edges.map(e => ({ aId: e.a_id, bId: e.b_id, kind: e.kind, weight: e.weight })),
  }
}

export async function searchNotes(query: string): Promise<Note[]> {
  const rows = await invoke<RawNote[]>('search_notes', { query })
  return rows.map(mapNote)
}
