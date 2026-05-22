import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { toast } from 'sonner'
import { useCalendarEvents } from '../../store/calendarEvents'
import type { LocalCalEvent, EventColor, Recurrence } from '../../store/calendarEvents'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { isConnected } from '../../lib/googleAuth'
import { fetchMonthEvents, createCalEvent, deleteEvent as deleteGcalEvent } from '../../lib/googleCalendar'
import type { CalendarEvent as GcalEvent } from '../../lib/googleCalendar'

/* ── Constants ───────────────────────────────────────────────── */
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
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
const fmtDate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/* ── Recurrence expansion ────────────────────────────────────── */
interface Occurrence extends LocalCalEvent { occurrenceDate: string }

function nextOccurrence(d: Date, freq: string, interval: number): Date {
  const c = new Date(d)
  if (freq === 'daily')    { c.setDate(c.getDate() + interval) }
  else if (freq === 'weekly')   { c.setDate(c.getDate() + 7 * interval) }
  else if (freq === 'monthly')  { c.setMonth(c.getMonth() + interval) }
  else if (freq === 'yearly')   { c.setFullYear(c.getFullYear() + interval) }
  else if (freq === 'weekdays') {
    do { c.setDate(c.getDate() + 1) } while (c.getDay() === 0 || c.getDay() === 6)
  }
  return c
}

function expandForMonth(events: LocalCalEvent[], year: number, month: number): Occurrence[] {
  const viewStart = new Date(year, month, 1)
  viewStart.setDate(viewStart.getDate() - viewStart.getDay()) // go to Sunday
  const viewEnd = new Date(viewStart); viewEnd.setDate(viewStart.getDate() + 42)
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

/* ── Modal ───────────────────────────────────────────────────── */
interface DraftEvent {
  title: string; date: string; startTime: string; endTime: string
  allDay: boolean; color: EventColor; recurrenceFreq: string
  recurrenceInterval: number; recurrenceUntil: string; syncGcal: boolean
}

const emptyDraft = (date: string): DraftEvent => ({
  title: '', date, startTime: '09:00', endTime: '10:00',
  allDay: true, color: 'terracotta', recurrenceFreq: '',
  recurrenceInterval: 1, recurrenceUntil: '', syncGcal: isConnected(),
})

const EventModal = memo(({
  draft, setDraft, onSave, onDelete, onClose, isEdit,
}: {
  draft: DraftEvent; setDraft: (d: DraftEvent) => void
  onSave: () => void; onDelete?: () => void; onClose: () => void; isEdit: boolean
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

        <div className="cal-modal__actions">
          {isEdit && onDelete && (
            <button className="cal-modal__btn cal-modal__btn--danger" onClick={onDelete}>Excluir</button>
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

/* ── Day cell ────────────────────────────────────────────────── */
const DayCell = memo(({
  dateStr, isToday, isCurrentMonth, occurrences, gcalOccs, onClickDay, onClickEvent,
}: {
  dateStr: string; isToday: boolean; isCurrentMonth: boolean
  occurrences: Occurrence[]; gcalOccs: GcalEvent[]
  onClickDay: (date: string) => void; onClickEvent: (id: string) => void
}) => {
  const day = Number(dateStr.split('-')[2])
  const allEvts = [...occurrences, ...gcalOccs]
  const visible = allEvts.slice(0, 3)
  const overflow = allEvts.length - visible.length

  return (
    <div className="cal-cell" data-other={!isCurrentMonth || undefined}
      onClick={() => onClickDay(dateStr)}>
      <span className="cal-cell__num" data-today={isToday || undefined}>{day}</span>
      <div className="cal-cell__events">
        {occurrences.slice(0, 3).map(ev => (
          <button key={ev.id + ev.occurrenceDate} className="cal-event-pill"
            data-color={ev.color}
            onClick={e => { e.stopPropagation(); onClickEvent(ev.id) }}>
            {!ev.allDay && ev.startTime && <span className="cal-event-pill__time">{ev.startTime}</span>}
            <span className="cal-event-pill__title">{ev.title}</span>
          </button>
        ))}
        {gcalOccs.slice(0, Math.max(0, 3 - occurrences.length)).map(ev => (
          <div key={ev.id} className="cal-event-pill cal-event-pill--gcal">
            <span className="cal-event-pill__title">{ev.summary}</span>
          </div>
        ))}
        {overflow > 0 && <span className="cal-cell__overflow">+{overflow} mais</span>}
      </div>
    </div>
  )
})

/* ── Main CalendarMode ───────────────────────────────────────── */
export function CalendarMode() {
  const user    = useAuthStore(s => s.user)
  const setMode = useUIStore(s => s.setMode)
  const { events, add, update, remove } = useCalendarEvents()

  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [modalOpen,  setModalOpen]  = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [draft,      setDraft]      = useState<DraftEvent>(emptyDraft(fmtDate(today)))

  const [gcalEvts,   setGcalEvts]   = useState<GcalEvent[]>([])
  const [gcalLoading, setGcalLoading] = useState(false)

  /* ── Fetch Google Calendar events for current month ── */
  const loadGcal = useCallback(async () => {
    if (!isConnected()) return
    setGcalLoading(true)
    try { setGcalEvts(await fetchMonthEvents(year, month)) }
    catch {}
    finally { setGcalLoading(false) }
  }, [year, month])

  useEffect(() => { loadGcal() }, [loadGcal])

  /* ── Calendar grid ── */
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

  /* ── Google Calendar events by date ── */
  const gcalMap = useMemo(() => {
    const map = new Map<string, GcalEvent[]>()
    for (const ev of gcalEvts) {
      const dateStr = ev.start.date ?? ev.start.dateTime?.split('T')[0] ?? ''
      if (!dateStr) continue
      const arr = map.get(dateStr) ?? []
      arr.push(ev); map.set(dateStr, arr)
    }
    return map
  }, [gcalEvts])

  /* ── Navigation ── */
  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0)  } else setMonth(m => m + 1) }
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  /* ── Open modal ── */
  const openAdd = useCallback((dateStr: string) => {
    setEditingId(null); setDraft(emptyDraft(dateStr)); setModalOpen(true)
  }, [])

  const openEdit = useCallback((id: string) => {
    const ev = events.find(e => e.id === id); if (!ev) return
    setEditingId(id)
    setDraft({
      title: ev.title, date: ev.date,
      startTime: ev.startTime ?? '09:00', endTime: ev.endTime ?? '10:00',
      allDay: ev.allDay, color: ev.color,
      recurrenceFreq:     ev.recurrence?.freq     ?? '',
      recurrenceInterval: ev.recurrence?.interval ?? 1,
      recurrenceUntil:    ev.recurrence?.until    ?? '',
      syncGcal: false,
    })
    setModalOpen(true)
  }, [events])

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    if (!draft.title.trim()) return
    const recurrence: Recurrence | undefined = draft.recurrenceFreq
      ? { freq: draft.recurrenceFreq as Recurrence['freq'], interval: draft.recurrenceInterval, until: draft.recurrenceUntil || undefined }
      : undefined

    const payload: Omit<LocalCalEvent, 'id'> = {
      title: draft.title.trim(), date: draft.date,
      startTime: draft.allDay ? undefined : draft.startTime,
      endTime:   draft.allDay ? undefined : draft.endTime,
      allDay: draft.allDay, color: draft.color, recurrence,
    }

    let gcalEventId: string | undefined
    if (draft.syncGcal && isConnected()) {
      try {
        const gcalEv = await createCalEvent({
          title: payload.title, date: payload.date,
          startTime: payload.startTime, endTime: payload.endTime,
          allDay: payload.allDay, recurrence: payload.recurrence,
        })
        gcalEventId = gcalEv.id
      } catch { toast.error('Sincronização com Google Calendar falhou') }
    }

    if (editingId) {
      update(editingId, { ...payload, gcalEventId })
    } else {
      add({ ...payload, gcalEventId })
    }
    setModalOpen(false)
    if (draft.syncGcal) loadGcal()
    toast.success(editingId ? 'Evento atualizado' : 'Evento criado')
  }, [draft, editingId, add, update, loadGcal])

  /* ── Delete ── */
  const handleDelete = useCallback(async () => {
    if (!editingId) return
    const ev = events.find(e => e.id === editingId)
    if (ev?.gcalEventId) {
      try { await deleteGcalEvent(ev.gcalEventId) } catch {}
    }
    remove(editingId); setModalOpen(false)
    toast.success('Evento excluído')
  }, [editingId, events, remove])

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

    if (newTasks.length === 0) {
      toast('Nenhum evento novo para exportar hoje'); return
    }

    localStorage.setItem(key, JSON.stringify([...existing, ...newTasks]))
    toast.success(`${newTasks.length} evento${newTasks.length > 1 ? 's' : ''} exportado${newTasks.length > 1 ? 's' : ''} como tarefas`)
    setMode('home')
  }, [events, gcalEvts, user, setMode])

  return (
    <div className="cal-page">
      {/* Header */}
      <header className="cal-header">
        <div className="cal-header__nav">
          <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
          <h2 className="cal-header__title">{MONTHS_PT[month]} <em>{year}</em></h2>
          <button className="cal-nav-btn" onClick={nextMonth}>›</button>
        </div>
        <div className="cal-header__actions">
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

      {/* Grid */}
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
            />
          ))}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <EventModal
          draft={draft} setDraft={setDraft}
          onSave={handleSave}
          onDelete={editingId ? handleDelete : undefined}
          onClose={() => setModalOpen(false)}
          isEdit={!!editingId}
        />
      )}
    </div>
  )
}
