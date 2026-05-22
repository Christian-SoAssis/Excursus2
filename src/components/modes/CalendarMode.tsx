import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { toast } from 'sonner'
import { useCalendarEvents } from '../../store/calendarEvents'
import type { LocalCalEvent, EventColor, Recurrence } from '../../store/calendarEvents'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { isConnected } from '../../lib/googleAuth'
import {
  fetchEventsInRange, fetchMonthEvents, fetchGcalEvent,
  createCalEvent, updateCalEvent, deleteEvent as deleteGcalEvent,
} from '../../lib/googleCalendar'
import type { CalendarEvent as GcalEvent } from '../../lib/googleCalendar'

/* ── Constants ───────────────────────────────────────────────── */
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTHS_PT_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const COLORS: { value: EventColor; label: string }[] = [
  { value: 'terracotta', label: 'Terracota' },
  { value: 'electric',   label: 'Elétrico'  },
  { value: 'emerald',    label: 'Esmeralda' },
  { value: 'amber',      label: 'Âmbar'     },
  { value: 'blue',       label: 'Azul'      },
  { value: 'clay',       label: 'Argila'    },
]
const RECURRENCE_OPTS = [
  { value: '',          label: 'Não repete'      },
  { value: 'daily',     label: 'Diariamente'     },
  { value: 'weekdays',  label: 'Dias úteis'      },
  { value: 'weekly',    label: 'Semanalmente'    },
  { value: 'monthly',   label: 'Mensalmente'     },
  { value: 'yearly',    label: 'Anualmente'      },
]
const HOUR_H     = 48   // px per hour in week view
const MIN_EVT_H  = 24   // min event height in px
const HOURS      = Array.from({ length: 24 }, (_, i) => i)

/* ── Date helpers ────────────────────────────────────────────── */
const fmtDate = (d: Date) => {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function getWeekStart(d: Date): Date {
  const s = new Date(d); s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay()); return s
}
function parseHours(t: string): number {
  const [h, m] = t.split(':').map(Number); return h + (m || 0) / 60
}
function fmtWeekRange(ws: Date): string {
  const we = new Date(ws); we.setDate(ws.getDate() + 6)
  const s = ws.getDate(), e = we.getDate()
  if (ws.getMonth() === we.getMonth())
    return `${s}–${e} ${MONTHS_PT_SHORT[ws.getMonth()]} ${ws.getFullYear()}`
  return `${s} ${MONTHS_PT_SHORT[ws.getMonth()]} – ${e} ${MONTHS_PT_SHORT[we.getMonth()]} ${we.getFullYear()}`
}

/* ── RRULE parser (GCal → nosso formato) ────────────────────── */
function parseRRule(rrule: string): { freq: string; interval: number; until: string } | null {
  try {
    const map: Record<string, string> = {}
    for (const part of rrule.replace(/^RRULE:/, '').split(';')) {
      const [k, v] = part.split('='); if (k && v !== undefined) map[k] = v
    }
    let freq = ''
    if      (map.FREQ === 'DAILY')   freq = 'daily'
    else if (map.FREQ === 'WEEKLY')  freq = map.BYDAY === 'MO,TU,WE,TH,FR' ? 'weekdays' : 'weekly'
    else if (map.FREQ === 'MONTHLY') freq = 'monthly'
    else if (map.FREQ === 'YEARLY')  freq = 'yearly'
    if (!freq) return null
    const interval = map.INTERVAL ? parseInt(map.INTERVAL) || 1 : 1
    let until = ''
    if (map.UNTIL) {
      const u = map.UNTIL.replace(/T.*$/, '')
      until = u.length === 8 ? `${u.slice(0,4)}-${u.slice(4,6)}-${u.slice(6,8)}` : u
    }
    return { freq, interval, until }
  } catch { return null }
}

/* ── Recurrence expansion ────────────────────────────────────── */
interface Occurrence extends LocalCalEvent { occurrenceDate: string }

function nextOccurrence(d: Date, freq: string, interval: number): Date {
  const c = new Date(d)
  if      (freq === 'daily')    { c.setDate(c.getDate() + interval) }
  else if (freq === 'weekly')   { c.setDate(c.getDate() + 7 * interval) }
  else if (freq === 'monthly')  { c.setMonth(c.getMonth() + interval) }
  else if (freq === 'yearly')   { c.setFullYear(c.getFullYear() + interval) }
  else if (freq === 'weekdays') {
    do { c.setDate(c.getDate() + 1) } while (c.getDay() === 0 || c.getDay() === 6)
  }
  return c
}

function expandForRange(events: LocalCalEvent[], viewStart: Date, viewEnd: Date): Occurrence[] {
  const result: Occurrence[] = []
  for (const ev of events) {
    const base = new Date(ev.date + 'T00:00:00')
    if (!ev.recurrence) {
      if (base >= viewStart && base < viewEnd) result.push({ ...ev, occurrenceDate: ev.date })
      continue
    }
    const { freq, interval, until } = ev.recurrence
    const untilDate = until ? new Date(until + 'T23:59:59') : null
    let cur = new Date(base)
    while (cur < viewStart) cur = nextOccurrence(cur, freq, interval)
    while (cur < viewEnd) {
      if (untilDate && cur > untilDate) break
      result.push({ ...ev, occurrenceDate: fmtDate(cur) })
      cur = nextOccurrence(cur, freq, interval)
    }
  }
  return result
}

function expandForMonth(events: LocalCalEvent[], year: number, month: number): Occurrence[] {
  const viewStart = new Date(year, month, 1)
  viewStart.setDate(viewStart.getDate() - viewStart.getDay())
  const viewEnd = new Date(viewStart); viewEnd.setDate(viewStart.getDate() + 42)
  return expandForRange(events, viewStart, viewEnd)
}

/* ── Modal ───────────────────────────────────────────────────── */
interface DraftEvent {
  title: string; date: string; startTime: string; endTime: string
  allDay: boolean; color: EventColor; recurrenceFreq: string
  recurrenceInterval: number; recurrenceUntil: string; syncGcal: boolean
  /** Escopo para edição/exclusão de eventos GCal recorrentes */
  editScope: 'this' | 'all'
}

const emptyDraft = (date: string): DraftEvent => ({
  title: '', date, startTime: '09:00', endTime: '10:00',
  allDay: true, color: 'terracotta', recurrenceFreq: '',
  recurrenceInterval: 1, recurrenceUntil: '', syncGcal: isConnected(),
  editScope: 'this',
})

const EventModal = memo(({
  draft, setDraft, onSave, onDelete, onClose, isEdit, isGcalRecurring,
}: {
  draft: DraftEvent; setDraft: (d: DraftEvent) => void
  onSave: () => void; onDelete?: () => void; onClose: () => void
  isEdit: boolean; isGcalRecurring: boolean
}) => {
  const set = (patch: Partial<DraftEvent>) => setDraft({ ...draft, ...patch })
  return (
    <div className="cal-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cal-modal">
        <div className="cal-modal__head">
          <h3>{isEdit ? 'Editar evento' : 'Novo evento'}</h3>
          <button className="cal-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="cal-modal__field">
          <input
            className="cal-modal__input cal-modal__input--title"
            placeholder="Título do evento"
            value={draft.title}
            onChange={e => set({ title: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && onSave()}
            autoFocus
          />
        </div>

        <div className="cal-modal__row">
          <div className="cal-modal__field">
            <label className="cal-modal__label">Data</label>
            <input type="date" className="cal-modal__input" value={draft.date}
              onChange={e => set({ date: e.target.value })} />
          </div>
          <label className="cal-modal__toggle">
            <input type="checkbox" checked={draft.allDay} onChange={e => set({ allDay: e.target.checked })} />
            <span>Dia todo</span>
          </label>
        </div>

        {!draft.allDay && (
          <div className="cal-modal__row">
            <div className="cal-modal__field">
              <label className="cal-modal__label">Início</label>
              <input type="time" className="cal-modal__input" value={draft.startTime}
                onChange={e => set({ startTime: e.target.value })} />
            </div>
            <div className="cal-modal__field">
              <label className="cal-modal__label">Fim</label>
              <input type="time" className="cal-modal__input" value={draft.endTime}
                onChange={e => set({ endTime: e.target.value })} />
            </div>
          </div>
        )}

        <div className="cal-modal__field">
          <label className="cal-modal__label">Cor</label>
          <div className="cal-modal__colors">
            {COLORS.map(c => (
              <button key={c.value} className="cal-modal__color-swatch"
                data-color={c.value} data-active={draft.color === c.value || undefined}
                title={c.label} onClick={() => set({ color: c.value })} />
            ))}
          </div>
        </div>

        <div className="cal-modal__row">
          <div className="cal-modal__field" style={{ flex: 1 }}>
            <label className="cal-modal__label">Repetição</label>
            <select className="cal-modal__input" value={draft.recurrenceFreq}
              onChange={e => set({ recurrenceFreq: e.target.value })}>
              {RECURRENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {draft.recurrenceFreq && draft.recurrenceFreq !== 'weekdays' && (
            <div className="cal-modal__field" style={{ width: 64 }}>
              <label className="cal-modal__label">A cada</label>
              <input type="number" className="cal-modal__input" min={1} max={99}
                value={draft.recurrenceInterval}
                onChange={e => set({ recurrenceInterval: Math.max(1, +e.target.value) })} />
            </div>
          )}
        </div>

        {draft.recurrenceFreq && (
          <div className="cal-modal__field">
            <label className="cal-modal__label">Repetir até (opcional)</label>
            <input type="date" className="cal-modal__input" value={draft.recurrenceUntil}
              onChange={e => set({ recurrenceUntil: e.target.value })} />
          </div>
        )}

        {isConnected() && (
          <label className="cal-modal__toggle">
            <input type="checkbox" checked={draft.syncGcal} onChange={e => set({ syncGcal: e.target.checked })} />
            <span>Sincronizar com Google Calendar</span>
          </label>
        )}

        {/* Seletor de escopo — aparece apenas em eventos GCal recorrentes */}
        {isGcalRecurring && (
          <div className="cal-modal__field">
            <label className="cal-modal__label">Aplicar a</label>
            <div className="cal-modal__scope">
              {(['this', 'all'] as const).map(s => (
                <label key={s} className="cal-modal__scope-option">
                  <input type="radio" name="editScope" value={s}
                    checked={draft.editScope === s}
                    onChange={() => set({ editScope: s })} />
                  <span>{s === 'this' ? 'Este evento' : 'Todos os eventos'}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="cal-modal__actions">
          {isEdit && onDelete && (
            <button className="cal-modal__btn cal-modal__btn--danger" onClick={onDelete}>
              {isGcalRecurring && draft.editScope === 'all' ? 'Excluir todos' : 'Excluir'}
            </button>
          )}
          <button className="cal-modal__btn cal-modal__btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="cal-modal__btn cal-modal__btn--primary" onClick={onSave}
            disabled={!draft.title.trim()}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
})

/* ── Day cell (month view) ───────────────────────────────────── */
const DayCell = memo(({
  dateStr, isToday, isCurrentMonth, occurrences, gcalOccs,
  onClickDay, onClickEvent, onClickGcalEvent, gcalColors,
}: {
  dateStr: string; isToday: boolean; isCurrentMonth: boolean
  occurrences: Occurrence[]; gcalOccs: GcalEvent[]
  onClickDay: (date: string) => void
  onClickEvent: (id: string) => void
  onClickGcalEvent: (ev: GcalEvent) => void
  gcalColors: Record<string, EventColor>
}) => {
  const day = Number(dateStr.split('-')[2])
  const allEvts = [...occurrences, ...gcalOccs]
  const overflow = allEvts.length - 3

  return (
    <div className="cal-cell" data-other={!isCurrentMonth || undefined}
      onClick={() => onClickDay(dateStr)}>
      <span className="cal-cell__num" data-today={isToday || undefined}>{day}</span>
      <div className="cal-cell__events" onClick={e => e.stopPropagation()}>
        {occurrences.slice(0, 3).map(ev => (
          <button key={ev.id + ev.occurrenceDate} className="cal-event-pill"
            data-color={ev.color}
            onClick={e => { e.stopPropagation(); onClickEvent(ev.id) }}>
            {!ev.allDay && ev.startTime && <span className="cal-event-pill__time">{ev.startTime}</span>}
            <span className="cal-event-pill__title">{ev.title}</span>
          </button>
        ))}
        {gcalOccs.slice(0, Math.max(0, 3 - occurrences.length)).map(ev => {
          const savedColor = gcalColors[ev.recurringEventId ?? ev.id] as EventColor | undefined
          return (
            <button key={ev.id}
              className={savedColor ? 'cal-event-pill' : 'cal-event-pill cal-event-pill--gcal'}
              data-color={savedColor ?? undefined}
              onClick={e => { e.stopPropagation(); onClickGcalEvent(ev) }}>
              <span className="cal-event-pill__title">{ev.summary}</span>
            </button>
          )
        })}
        {overflow > 0 && <span className="cal-cell__overflow">+{overflow} mais</span>}
      </div>
    </div>
  )
})

/* ── Week view ───────────────────────────────────────────────── */
const WeekView = memo(({
  weekStart, occurrences, gcalEvts, onClickDay, onClickEvent, onClickGcalEvent, gcalColors,
}: {
  weekStart: Date
  occurrences: Occurrence[]
  gcalEvts: GcalEvent[]
  onClickDay: (date: string) => void
  onClickEvent: (id: string) => void
  onClickGcalEvent: (ev: GcalEvent) => void
  gcalColors: Record<string, EventColor>
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const today     = new Date()
  const todayStr  = fmtDate(today)

  // Scroll to current time when switching to this view / changing week
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = Math.max(0, (today.getHours() - 2) * HOUR_H)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
    return { dateStr: fmtDate(d), dayNum: d.getDate(), dow: d.getDay(), isToday: fmtDate(d) === todayStr }
  }), [weekStart, todayStr])

  const { allDayMap, timedMap } = useMemo(() => {
    const ad = new Map<string, Occurrence[]>()
    const tm = new Map<string, Occurrence[]>()
    for (const occ of occurrences) {
      const target = (occ.allDay || !occ.startTime) ? ad : tm
      const arr = target.get(occ.occurrenceDate) ?? []; arr.push(occ)
      target.set(occ.occurrenceDate, arr)
    }
    return { allDayMap: ad, timedMap: tm }
  }, [occurrences])

  const { gcalAdMap, gcalTmMap } = useMemo(() => {
    const ad = new Map<string, GcalEvent[]>()
    const tm = new Map<string, GcalEvent[]>()
    for (const ev of gcalEvts) {
      if (ev.start.date) {
        const arr = ad.get(ev.start.date) ?? []; arr.push(ev); ad.set(ev.start.date, arr)
      } else if (ev.start.dateTime) {
        const ds = fmtDate(new Date(ev.start.dateTime))
        const arr = tm.get(ds) ?? []; arr.push(ev); tm.set(ds, arr)
      }
    }
    return { gcalAdMap: ad, gcalTmMap: tm }
  }, [gcalEvts])

  const hasAllDay = weekDays.some(d =>
    (allDayMap.get(d.dateStr)?.length ?? 0) + (gcalAdMap.get(d.dateStr)?.length ?? 0) > 0
  )

  const nowPct = today.getHours() + today.getMinutes() / 60

  return (
    <div className="cal-week">
      {/*
        ─── Everything is inside ONE scroll container ───────────────
        Header + allday-band are position:sticky so they pin to the
        top while the time-grid scrolls. This avoids the classic
        scrollbar-width misalignment between a fixed header and a
        scrollable body.
      */}
      <div className="cal-week-scroll" ref={scrollRef}>

        {/* ── Sticky day-of-week header ── */}
        <div className="cal-week-head">
          <div className="cal-week-corner" />
          {weekDays.map(d => (
            <div key={d.dateStr} className="cal-week-head-day"
              onClick={() => onClickDay(d.dateStr)} title="Clique para novo evento">
              <span className="cal-week-head-wd">{WEEKDAYS_SHORT[d.dow]}</span>
              <span className="cal-week-head-num" data-today={d.isToday || undefined}>{d.dayNum}</span>
            </div>
          ))}
        </div>

        {/* ── Sticky all-day band (only when needed) ── */}
        {hasAllDay && (
          <div className="cal-week-allday-row">
            <div className="cal-week-corner cal-week-corner--sm">dia<br/>todo</div>
            {weekDays.map(d => (
              <div key={d.dateStr} className="cal-week-allday-col"
                onClick={() => onClickDay(d.dateStr)}>
                {(allDayMap.get(d.dateStr) ?? []).map(ev => (
                  <button key={ev.id + ev.occurrenceDate}
                    className="cal-event-pill" data-color={ev.color}
                    onClick={e => { e.stopPropagation(); onClickEvent(ev.id) }}>
                    <span className="cal-event-pill__title">{ev.title}</span>
                  </button>
                ))}
                {(gcalAdMap.get(d.dateStr) ?? []).map(ev => {
                  const savedColor = gcalColors[ev.recurringEventId ?? ev.id] as EventColor | undefined
                  return (
                    <button key={ev.id}
                      className={savedColor ? 'cal-event-pill' : 'cal-event-pill cal-event-pill--gcal'}
                      data-color={savedColor ?? undefined}
                      onClick={e => { e.stopPropagation(); onClickGcalEvent(ev) }}>
                      <span className="cal-event-pill__title">{ev.summary}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* ── Time grid ── */}
        <div className="cal-week-grid">
          {/* Hour labels (sticky left) */}
          <div className="cal-week-times">
            {HOURS.map(h => (
              <div key={h} className="cal-week-time">
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(d => (
            <div key={d.dateStr} className="cal-week-col"
              data-today={d.isToday || undefined}
              onClick={() => onClickDay(d.dateStr)}>

              {/* Hour-slot background lines */}
              {HOURS.map(h => <div key={h} className="cal-week-hour-line" />)}

              {/* Current-time indicator */}
              {d.isToday && (
                <div className="cal-week-now" style={{ top: `${nowPct * HOUR_H}px` }}>
                  <span className="cal-week-now__dot" />
                  <span className="cal-week-now__line" />
                </div>
              )}

              {/* Local timed events — stopPropagation on every button */}
              {(timedMap.get(d.dateStr) ?? []).map(ev => {
                const sh = parseHours(ev.startTime!)
                const eh = ev.endTime ? parseHours(ev.endTime) : sh + 1
                return (
                  <button key={ev.id + ev.occurrenceDate}
                    className="cal-week-event" data-color={ev.color}
                    style={{ top: `${sh * HOUR_H}px`, height: `${Math.max(MIN_EVT_H, (eh - sh) * HOUR_H)}px` }}
                    onClick={e => { e.stopPropagation(); onClickEvent(ev.id) }}>
                    <span className="cal-week-event__time">{ev.startTime}</span>
                    <span className="cal-week-event__title">{ev.title}</span>
                  </button>
                )
              })}

              {/* GCal timed events — clickable to edit, colored if set */}
              {(gcalTmMap.get(d.dateStr) ?? []).map(ev => {
                const sd = new Date(ev.start.dateTime!)
                const ed = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(sd.getTime() + 3_600_000)
                const sh = sd.getHours() + sd.getMinutes() / 60
                const eh = ed.getHours() + ed.getMinutes() / 60
                const savedColor = gcalColors[ev.recurringEventId ?? ev.id] as EventColor | undefined
                return (
                  <button key={ev.id}
                    className={savedColor ? 'cal-week-event' : 'cal-week-event cal-week-event--gcal'}
                    data-color={savedColor ?? undefined}
                    style={{ top: `${sh * HOUR_H}px`, height: `${Math.max(MIN_EVT_H, (eh - sh) * HOUR_H)}px` }}
                    onClick={e => { e.stopPropagation(); onClickGcalEvent(ev) }}>
                    <span className="cal-week-event__time">
                      {String(sd.getHours()).padStart(2,'0')}:{String(sd.getMinutes()).padStart(2,'0')}
                    </span>
                    <span className="cal-week-event__title">{ev.summary}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

/* ── Main CalendarMode ───────────────────────────────────────── */
export function CalendarMode() {
  const user    = useAuthStore(s => s.user)
  const setMode = useUIStore(s => s.setMode)
  const { events, add, update, remove, gcalColors, setGcalColor } = useCalendarEvents()

  const today  = new Date()
  const [view,      setView]      = useState<'month' | 'week'>('month')
  const [year,      setYear]      = useState(today.getFullYear())
  const [month,     setMonth]     = useState(today.getMonth())
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today))

  const [modalOpen,            setModalOpen]            = useState(false)
  const [editingId,            setEditingId]            = useState<string | null>(null)
  const [editingGcalId,        setEditingGcalId]        = useState<string | null>(null)
  const [editingGcalRecurringId, setEditingGcalRecurringId] = useState<string | null>(null)
  const [draft,                setDraft]                = useState<DraftEvent>(emptyDraft(fmtDate(today)))

  const [gcalEvts,    setGcalEvts]    = useState<GcalEvent[]>([])
  const [gcalLoading, setGcalLoading] = useState(false)

  /* ── Fetch Google Calendar events ── */
  const loadGcal = useCallback(async () => {
    if (!isConnected()) return
    setGcalLoading(true)
    try {
      if (view === 'week') {
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 7)
        setGcalEvts(await fetchEventsInRange(weekStart, weekEnd))
      } else {
        setGcalEvts(await fetchMonthEvents(year, month))
      }
    } catch {}
    finally { setGcalLoading(false) }
  }, [year, month, view, weekStart])

  useEffect(() => { loadGcal() }, [loadGcal])

  /* ── Calendar grid (month view) ── */
  const gridDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const startSun = new Date(firstDay); startSun.setDate(firstDay.getDate() - firstDay.getDay())
    const days: { dateStr: string; isToday: boolean; isCurrentMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(startSun); d.setDate(startSun.getDate() + i)
      days.push({
        dateStr: fmtDate(d),
        isToday: fmtDate(d) === fmtDate(today),
        isCurrentMonth: d.getMonth() === month,
      })
    }
    return days
  }, [year, month])

  /* ── Expanded local occurrences ── */
  const occurrenceMap = useMemo(() => {
    const map = new Map<string, Occurrence[]>()
    for (const occ of expandForMonth(events, year, month)) {
      const arr = map.get(occ.occurrenceDate) ?? []
      arr.push(occ); map.set(occ.occurrenceDate, arr)
    }
    return map
  }, [events, year, month])

  const weekOccurrences = useMemo(() => {
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7)
    return expandForRange(events, weekStart, weekEnd)
  }, [events, weekStart])

  /* ── Deduplicate: GCal IDs that already have a local counterpart ── */
  const localGcalIds = useMemo(
    () => new Set(events.flatMap(e => e.gcalEventId ? [e.gcalEventId] : [])),
    [events],
  )
  const filteredGcalEvts = useMemo(
    () => gcalEvts.filter(ev => !localGcalIds.has(ev.id)),
    [gcalEvts, localGcalIds],
  )

  /* ── GCal by date (month view, deduped) ── */
  const gcalMap = useMemo(() => {
    const map = new Map<string, GcalEvent[]>()
    for (const ev of filteredGcalEvts) {
      const dateStr = ev.start.date ?? ev.start.dateTime?.split('T')[0] ?? ''
      if (!dateStr) continue
      const arr = map.get(dateStr) ?? []
      arr.push(ev); map.set(dateStr, arr)
    }
    return map
  }, [filteredGcalEvts])

  /* ── Navigation ── */
  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0)  } else setMonth(m => m + 1) }
  const goToday   = () => {
    setYear(today.getFullYear()); setMonth(today.getMonth())
    setWeekStart(getWeekStart(today))
  }
  const prevWeek = () => setWeekStart(s => { const d = new Date(s); d.setDate(d.getDate() - 7); return d })
  const nextWeek = () => setWeekStart(s => { const d = new Date(s); d.setDate(d.getDate() + 7); return d })

  const goPrev = view === 'week' ? prevWeek : prevMonth
  const goNext = view === 'week' ? nextWeek : nextMonth

  /* ── Open modal ── */
  const openAdd = useCallback((dateStr: string) => {
    setEditingId(null); setEditingGcalId(null)
    setDraft(emptyDraft(dateStr)); setModalOpen(true)
  }, [])

  const openEdit = useCallback((id: string) => {
    const ev = events.find(e => e.id === id); if (!ev) return
    setEditingId(id); setEditingGcalId(null)
    setDraft({
      title: ev.title, date: ev.date,
      startTime: ev.startTime ?? '09:00', endTime: ev.endTime ?? '10:00',
      allDay: ev.allDay, color: ev.color,
      recurrenceFreq:     ev.recurrence?.freq     ?? '',
      recurrenceInterval: ev.recurrence?.interval ?? 1,
      recurrenceUntil:    ev.recurrence?.until    ?? '',
      syncGcal: !!ev.gcalEventId && isConnected(),
      editScope: 'this',
    })
    setModalOpen(true)
  }, [events])

  /* Editar evento que existe apenas no Google Calendar */
  const openEditGcal = useCallback(async (ev: GcalEvent) => {
    const allDay = !!ev.start.date
    const date   = ev.start.date ?? fmtDate(new Date(ev.start.dateTime!))
    let startTime = '09:00', endTime = '10:00'
    if (ev.start.dateTime) {
      const sd = new Date(ev.start.dateTime)
      startTime = `${String(sd.getHours()).padStart(2,'0')}:${String(sd.getMinutes()).padStart(2,'0')}`
    }
    if (ev.end?.dateTime) {
      const ed = new Date(ev.end.dateTime)
      endTime = `${String(ed.getHours()).padStart(2,'0')}:${String(ed.getMinutes()).padStart(2,'0')}`
    }

    /* Se for instância de evento recorrente, busca o mestre para ler a RRULE */
    let recurrenceFreq = '', recurrenceInterval = 1, recurrenceUntil = ''
    const masterEventId = ev.recurringEventId ?? null
    if (masterEventId) {
      try {
        const master = await fetchGcalEvent(masterEventId)
        const parsed = master.recurrence?.[0] ? parseRRule(master.recurrence[0]) : null
        if (parsed) {
          recurrenceFreq     = parsed.freq
          recurrenceInterval = parsed.interval
          recurrenceUntil    = parsed.until
        }
      } catch { /* mostra sem recorrência se falhar */ }
    }

    // Cor salva previamente para esta série/evento (chave = master ou instance)
    const colorKey = masterEventId ?? ev.id
    const savedColor = gcalColors[colorKey] as EventColor | undefined

    setEditingId(null)
    setEditingGcalId(ev.id)
    setEditingGcalRecurringId(masterEventId)
    setDraft({
      title: ev.summary ?? '', date, startTime, endTime,
      allDay, color: savedColor ?? 'electric',
      recurrenceFreq, recurrenceInterval, recurrenceUntil,
      editScope: 'this', syncGcal: true,
    })
    setModalOpen(true)
  }, [gcalColors])

  /* ── Save (create or update) ── */
  const handleSave = useCallback(async () => {
    if (!draft.title.trim()) return
    const recurrence: Recurrence | undefined = draft.recurrenceFreq
      ? { freq: draft.recurrenceFreq as Recurrence['freq'], interval: draft.recurrenceInterval, until: draft.recurrenceUntil || undefined }
      : undefined
    const gcalOpts = {
      title: draft.title.trim(), date: draft.date,
      startTime: draft.allDay ? undefined : draft.startTime,
      endTime:   draft.allDay ? undefined : draft.endTime,
      allDay: draft.allDay, recurrence,
    }
    const payload: Omit<LocalCalEvent, 'id'> = { ...gcalOpts, color: draft.color }

    /* ── Caso 1: editando evento local existente ── */
    if (editingId) {
      const existingGcalId = events.find(e => e.id === editingId)?.gcalEventId
      let gcalEventId: string | undefined = existingGcalId
      if (draft.syncGcal && isConnected()) {
        try {
          if (existingGcalId) {
            await updateCalEvent(existingGcalId, gcalOpts)
          } else {
            const gcalEv = await createCalEvent(gcalOpts)
            gcalEventId = gcalEv.id
          }
        } catch { toast.error('Sincronização com Google Calendar falhou') }
      }
      update(editingId, { ...payload, gcalEventId })
      setModalOpen(false)
      if (draft.syncGcal) loadGcal()
      toast.success('Evento atualizado')
      return
    }

    /* ── Caso 2: editando evento que só existe no Google Calendar ── */
    if (editingGcalId) {
      if (isConnected()) {
        const targetId = (draft.editScope === 'all' && editingGcalRecurringId)
          ? editingGcalRecurringId : editingGcalId
        try { await updateCalEvent(targetId, gcalOpts) }
        catch { toast.error('Sincronização com Google Calendar falhou') }
      }
      // Persiste a cor escolhida — chave: master (aplica à série) ou instância
      const colorKey = editingGcalRecurringId ?? editingGcalId
      setGcalColor(colorKey, draft.color)

      // Só cria entrada local para "este evento" (override de instância única, SEM recorrência)
      if (draft.editScope === 'this') {
        add({ ...payload, recurrence: undefined, gcalEventId: editingGcalId })
      }
      setEditingGcalId(null); setEditingGcalRecurringId(null)
      setModalOpen(false); loadGcal()
      toast.success('Evento atualizado')
      return
    }

    /* ── Caso 3: criando novo evento ── */
    let gcalEventId: string | undefined
    if (draft.syncGcal && isConnected()) {
      try {
        const gcalEv = await createCalEvent(gcalOpts)
        gcalEventId = gcalEv.id
      } catch { toast.error('Sincronização com Google Calendar falhou') }
    }
    add({ ...payload, gcalEventId })
    setModalOpen(false)
    if (draft.syncGcal) loadGcal()
    toast.success('Evento criado')
  }, [draft, editingId, editingGcalId, editingGcalRecurringId, events, add, update, setGcalColor, loadGcal])

  /* ── Delete ── */
  const handleDelete = useCallback(async () => {
    /* Deletar evento GCal-only */
    if (editingGcalId && !editingId) {
      // "Todos os eventos" → deleta o mestre; "Este evento" → deleta a instância
      const targetId = (draft.editScope === 'all' && editingGcalRecurringId)
        ? editingGcalRecurringId : editingGcalId
      try { await deleteGcalEvent(targetId) } catch {}
      setEditingGcalId(null); setEditingGcalRecurringId(null); setModalOpen(false)
      loadGcal()
      toast.success(draft.editScope === 'all' ? 'Série de eventos excluída' : 'Evento excluído')
      return
    }
    if (!editingId) return
    const ev = events.find(e => e.id === editingId)
    if (ev?.gcalEventId) {
      try { await deleteGcalEvent(ev.gcalEventId) } catch {}
    }
    remove(editingId); setModalOpen(false)
    toast.success('Evento excluído')
  }, [draft.editScope, editingId, editingGcalId, editingGcalRecurringId, events, remove, loadGcal])

  /* ── Export today → tasks ── */
  const exportToday = useCallback(() => {
    const uid    = (user?.id ?? 'local').slice(0, 8)
    const key    = `hm.tasks.v2.${uid}`
    const todayStr = fmtDate(today)

    const todayLocal = expandForMonth(events, today.getFullYear(), today.getMonth())
      .filter(o => o.occurrenceDate === todayStr)
    const todayGcal = gcalEvts.filter(ev => {
      const d = ev.start.date ?? ev.start.dateTime?.split('T')[0]
      return d === todayStr
    })

    let existing: { id: string; gcalEventId?: string }[] = []
    try { existing = JSON.parse(localStorage.getItem(key) ?? '[]') } catch {}

    const existingIds = new Set([
      ...existing.map(t => t.id),
      ...existing.map(t => t.gcalEventId).filter(Boolean),
    ])
    const newTasks = [
      ...todayLocal
        .filter(ev => !existingIds.has(ev.id) && !existingIds.has(ev.gcalEventId ?? ''))
        .map(ev => ({ id: 'cal_' + ev.id, text: ev.title, tag: 'agenda', tagCls: 'electric', done: false, gcalEventId: ev.gcalEventId })),
      ...todayGcal
        .filter(ev => !existingIds.has(ev.id))
        .map(ev => ({ id: 'gcal_' + ev.id, text: ev.summary, tag: 'agenda', tagCls: 'electric', done: false, gcalEventId: ev.id })),
    ]
    if (newTasks.length === 0) { toast('Nenhum evento novo para exportar hoje'); return }
    localStorage.setItem(key, JSON.stringify([...existing, ...newTasks]))
    toast.success(`${newTasks.length} evento${newTasks.length > 1 ? 's' : ''} exportado${newTasks.length > 1 ? 's' : ''} como tarefas`)
    setMode('home')
  }, [events, gcalEvts, user, setMode])

  /* ── Header title ── */
  const headerTitle = view === 'week'
    ? fmtWeekRange(weekStart)
    : `${MONTHS_PT[month]} ${year}`

  return (
    <div className="cal-page">
      {/* Header */}
      <header className="cal-header">
        <div className="cal-header__nav">
          <button className="cal-nav-btn" onClick={goPrev}>‹</button>
          <h2 className="cal-header__title">
            {view === 'week'
              ? <span>{headerTitle}</span>
              : <>{MONTHS_PT[month]} <em>{year}</em></>
            }
          </h2>
          <button className="cal-nav-btn" onClick={goNext}>›</button>
        </div>

        <div className="cal-header__actions">
          {/* View toggle */}
          <div className="cal-view-toggle">
            <button className="cal-view-btn" data-active={view === 'month' || undefined}
              onClick={() => setView('month')}>Mês</button>
            <button className="cal-view-btn" data-active={view === 'week' || undefined}
              onClick={() => setView('week')}>Semana</button>
          </div>

          <button className="cal-action-btn" onClick={goToday}>Hoje</button>
          {gcalLoading && <span className="cal-sync-dot"/>}
          <button className="cal-action-btn cal-action-btn--primary" onClick={() => openAdd(fmtDate(today))}>
            + Evento
          </button>
          <button className="cal-action-btn cal-action-btn--export" onClick={exportToday}
            title="Exportar eventos de hoje como tarefas e ir para Hoje">
            ↓ Exportar hoje
          </button>
        </div>
      </header>

      {/* Content */}
      {view === 'week' ? (
        <WeekView
          weekStart={weekStart}
          occurrences={weekOccurrences}
          gcalEvts={filteredGcalEvts}
          onClickDay={openAdd}
          onClickEvent={openEdit}
          onClickGcalEvent={openEditGcal}
          gcalColors={gcalColors}
        />
      ) : (
        <div className="cal-grid-wrap">
          <div className="cal-weekday-row">
            {WEEKDAYS_SHORT.map(d => <span key={d} className="cal-weekday">{d}</span>)}
          </div>
          <div className="cal-grid">
            {gridDays.map(({ dateStr, isToday, isCurrentMonth }) => (
              <DayCell
                key={dateStr}
                dateStr={dateStr}
                isToday={isToday}
                isCurrentMonth={isCurrentMonth}
                occurrences={occurrenceMap.get(dateStr) ?? []}
                gcalOccs={gcalMap.get(dateStr) ?? []}
                onClickDay={openAdd}
                onClickEvent={openEdit}
                onClickGcalEvent={openEditGcal}
                gcalColors={gcalColors}
              />
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <EventModal
          draft={draft} setDraft={setDraft}
          onSave={handleSave}
          onDelete={(editingId || editingGcalId) ? handleDelete : undefined}
          onClose={() => { setEditingId(null); setEditingGcalId(null); setEditingGcalRecurringId(null); setModalOpen(false) }}
          isEdit={!!(editingId || editingGcalId)}
          isGcalRecurring={!!editingGcalRecurringId}
        />
      )}
    </div>
  )
}
