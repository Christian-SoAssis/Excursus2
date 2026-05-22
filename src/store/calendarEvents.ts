import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EventColor = 'terracotta' | 'electric' | 'emerald' | 'amber' | 'blue' | 'clay'

export interface Recurrence {
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'weekdays'
  interval: number
  until?: string // YYYY-MM-DD
}

export interface LocalCalEvent {
  id: string
  title: string
  date: string       // YYYY-MM-DD (start / first occurrence)
  startTime?: string // HH:MM
  endTime?: string   // HH:MM
  allDay: boolean
  color: EventColor
  recurrence?: Recurrence
  gcalEventId?: string
}

interface CalendarEventsStore {
  events: LocalCalEvent[]
  add:    (e: Omit<LocalCalEvent, 'id'>) => string
  update: (id: string, patch: Partial<LocalCalEvent>) => void
  remove: (id: string) => void
}

export const useCalendarEvents = create<CalendarEventsStore>()(
  persist(
    (set) => ({
      events: [],
      add: (e) => {
        const id = 'ev_' + Date.now()
        set(s => ({ events: [...s.events, { ...e, id }] }))
        return id
      },
      update: (id, patch) =>
        set(s => ({ events: s.events.map(e => e.id === id ? { ...e, ...patch } : e) })),
      remove: (id) =>
        set(s => ({ events: s.events.filter(e => e.id !== id) })),
    }),
    { name: 'excursus-cal-events' },
  ),
)
