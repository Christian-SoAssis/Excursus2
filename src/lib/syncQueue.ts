const QUEUE_KEY = 'excursus-sync-queue'

export type MutationKind = 'create' | 'save' | 'move' | 'delete'

export interface PendingMutation {
  id: string
  kind: MutationKind
  snapshot: {
    title: string
    folder: string
    content: string
    posX: number
    posY: number
  }
  enqueuedAt: string
}

export function loadQueue(): PendingMutation[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

function saveQueue(queue: PendingMutation[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch {}
}

export function clearQueue(): void {
  try { localStorage.removeItem(QUEUE_KEY) } catch {}
}

export function removeFromQueue(id: string): void {
  saveQueue(loadQueue().filter(m => m.id !== id))
}

export function enqueue(mutation: PendingMutation): void {
  const queue = loadQueue()
  const idx = queue.findIndex(m => m.id === mutation.id)

  if (idx === -1) {
    queue.push(mutation)
    saveQueue(queue)
    return
  }

  const existing = queue[idx]
  const snap = { ...existing.snapshot, ...mutation.snapshot }

  // collapse rules
  if (existing.kind === 'delete') {
    // delete wins over everything
    return
  }
  if (mutation.kind === 'delete') {
    if (existing.kind === 'create') {
      // create + delete = note never existed remotely, drop both
      queue.splice(idx, 1)
    } else {
      queue[idx] = { ...mutation, snapshot: snap }
    }
    saveQueue(queue)
    return
  }
  if (existing.kind === 'create') {
    // create absorbs any save/move: update snapshot, keep kind='create'
    queue[idx] = { ...existing, snapshot: snap }
    saveQueue(queue)
    return
  }
  // save/move combinations: last-write-wins, merge snapshot
  queue[idx] = {
    id: mutation.id,
    kind: mutation.kind === 'save' ? 'save' : existing.kind === 'save' ? 'save' : 'move',
    snapshot: snap,
    enqueuedAt: mutation.enqueuedAt,
  }
  saveQueue(queue)
}
