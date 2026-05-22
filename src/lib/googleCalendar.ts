import { getValidAccessToken } from './googleAuth'
import type { Recurrence } from '../store/calendarEvents'

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary'

export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: { date?: string; dateTime?: string; timeZone?: string }
  end:   { date?: string; dateTime?: string; timeZone?: string }
  status: 'confirmed' | 'tentative' | 'cancelled'
  htmlLink?: string
  /** RRULE strings — presente apenas no evento-mestre, não nas instâncias */
  recurrence?: string[]
  /** Presente nas instâncias de eventos recorrentes — aponta para o evento-mestre */
  recurringEventId?: string
}

/** Busca um evento específico pelo ID (útil para obter o evento-mestre e sua RRULE) */
export async function fetchGcalEvent(eventId: string): Promise<CalendarEvent> {
  const token = await getValidAccessToken()
  const res = await fetch(`${BASE}/events/${eventId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Falha ao buscar evento do calendário')
  return res.json()
}

/* ── Fetch ───────────────────────────────────────────────────── */

export async function fetchEventsInRange(from: Date, to: Date): Promise<CalendarEvent[]> {
  const token = await getValidAccessToken()
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '200',
  })
  const res = await fetch(`${BASE}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Falha ao buscar eventos do calendário')
  const data = await res.json()
  return ((data.items ?? []) as CalendarEvent[]).filter(e => e.status !== 'cancelled')
}

export async function fetchTodayEvents(): Promise<CalendarEvent[]> {
  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end   = new Date(now); end.setHours(23, 59, 59, 999)
  return fetchEventsInRange(start, end)
}

export async function fetchMonthEvents(year: number, month: number): Promise<CalendarEvent[]> {
  const start = new Date(year, month, 1)
  const end   = new Date(year, month + 1, 0, 23, 59, 59)
  return fetchEventsInRange(start, end)
}

/* ── Create / Update / Delete ────────────────────────────────── */

function toRRule(r: Recurrence): string {
  const freqMap: Record<string, string> = {
    daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY',
    yearly: 'YEARLY', weekdays: 'WEEKLY',
  }
  let rule = `RRULE:FREQ=${freqMap[r.freq]}`
  if (r.freq === 'weekdays') rule += ';BYDAY=MO,TU,WE,TH,FR'
  if (r.interval > 1) rule += `;INTERVAL=${r.interval}`
  if (r.until) rule += `;UNTIL=${r.until.replace(/-/g, '')}T000000Z`
  return rule
}

export interface CreateEventOptions {
  title: string
  date: string       // YYYY-MM-DD
  startTime?: string // HH:MM
  endTime?: string   // HH:MM
  allDay?: boolean
  recurrence?: Recurrence
}

export async function updateCalEvent(eventId: string, opts: CreateEventOptions): Promise<CalendarEvent> {
  const token = await getValidAccessToken()
  const allDay = opts.allDay ?? !opts.startTime
  const start = allDay
    ? { date: opts.date }
    : { dateTime: `${opts.date}T${opts.startTime}:00` }
  const endDate = opts.endTime
    ? { dateTime: `${opts.date}T${opts.endTime}:00` }
    : allDay
      ? { date: opts.date }
      : { dateTime: `${opts.date}T${opts.startTime}:00` }
  const body: Record<string, unknown> = { summary: opts.title, start, end: endDate }
  if (opts.recurrence) body.recurrence = [toRRule(opts.recurrence)]
  const res = await fetch(`${BASE}/events/${eventId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Falha ao atualizar evento no calendário')
  return res.json()
}

export async function createCalEvent(opts: CreateEventOptions): Promise<CalendarEvent> {
  const token = await getValidAccessToken()
  const allDay = opts.allDay ?? !opts.startTime

  const start = allDay
    ? { date: opts.date }
    : { dateTime: `${opts.date}T${opts.startTime}:00` }
  const endDate = opts.endTime
    ? { dateTime: `${opts.date}T${opts.endTime}:00` }
    : allDay
      ? { date: opts.date }
      : { dateTime: `${opts.date}T${opts.startTime}:00` }

  const body: Record<string, unknown> = { summary: opts.title, start, end: endDate }
  if (opts.recurrence) body.recurrence = [toRRule(opts.recurrence)]

  const res = await fetch(`${BASE}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Falha ao criar evento no calendário')
  return res.json()
}

/** Legacy helper used by HomeMode task sync */
export async function createEvent(text: string): Promise<CalendarEvent> {
  return createCalEvent({ title: text, date: new Date().toISOString().split('T')[0], allDay: true })
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
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error('Falha ao deletar evento do calendário')
  }
}
