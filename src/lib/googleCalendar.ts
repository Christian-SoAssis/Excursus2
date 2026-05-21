import { getValidAccessToken } from './googleAuth'

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary'

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: { date?: string; dateTime?: string; timeZone?: string }
  end: { date?: string; dateTime?: string; timeZone?: string }
  status: 'confirmed' | 'tentative' | 'cancelled'
  htmlLink?: string
}

export async function fetchTodayEvents(): Promise<CalendarEvent[]> {
  const token = await getValidAccessToken()
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  })
  const res = await fetch(`${BASE}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Falha ao buscar eventos do calendário')
  const data = await res.json()
  return ((data.items ?? []) as CalendarEvent[]).filter(e => e.status !== 'cancelled')
}

export async function createEvent(text: string): Promise<CalendarEvent> {
  const token = await getValidAccessToken()
  const today = new Date().toISOString().split('T')[0]
  const res = await fetch(`${BASE}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: text,
      start: { date: today },
      end: { date: today },
    }),
  })
  if (!res.ok) throw new Error('Falha ao criar evento no calendário')
  return res.json()
}

export async function updateEventSummary(eventId: string, summary: string): Promise<void> {
  const token = await getValidAccessToken()
  const res = await fetch(`${BASE}/events/${eventId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary }),
  })
  if (!res.ok && res.status !== 404) throw new Error('Falha ao atualizar evento')
}

export async function deleteEvent(eventId: string): Promise<void> {
  const token = await getValidAccessToken()
  const res = await fetch(`${BASE}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  // 404 and 410 mean already deleted — that's fine
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error('Falha ao deletar evento do calendário')
  }
}
