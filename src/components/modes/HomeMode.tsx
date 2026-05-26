import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '../../store/auth'
import { useSyncStore } from '../../store/sync'
import { loadHomeData, saveHomeData } from '../../lib/homeData'
import type { Habit, Task, ReflectStore } from '../../lib/homeData'
import { connectGoogleCalendar, disconnectGoogleCalendar, isConnected } from '../../lib/googleAuth'
import { fetchTodayEvents, createEvent, updateEventSummary, deleteEvent } from '../../lib/googleCalendar'
import type { CalendarEvent } from '../../lib/googleCalendar'

/* ── date helpers ── */
const getToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const fmtKey = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c }
const WEEKDAYS_PT    = ['domingo','segunda','terça','quarta','quinta','sexta','sábado']
const MONTHS_PT_FULL = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const MONTHS_PT_SHORT= ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const greeting = () => { const h = new Date().getHours(); if (h<5) return 'Boa madrugada'; if (h<12) return 'Bom dia'; if (h<18) return 'Boa tarde'; return 'Boa noite' }

/* ── types (imported from lib/homeData) ── */

/* ── seeds ── */
const HABIT_SEED_DEF = [
  { id: 'meditar',  name: 'Meditar',            glyph: '◯', glyphCls: '',         sub: '10 min · manhã' },
  { id: 'ler',      name: 'Ler',                glyph: '⌇', glyphCls: '',         sub: 'antes de dormir' },
  { id: 'mover',    name: 'Movimento',          glyph: '↗', glyphCls: 'emerald',  sub: '30 min · qualquer hora' },
  { id: 'escrever', name: 'Escrever no diário', glyph: '✎', glyphCls: 'amber',    sub: 'reflexão noturna' },
  { id: 'agua',     name: 'Beber água',         glyph: '~', glyphCls: 'electric', sub: '2L distribuídos' },
  { id: 'estudar',  name: 'Estudar idioma',     glyph: '§', glyphCls: '',         sub: '20 min · Anki' },
]
const TASK_SEED_DEF: Task[] = [
  { id: 't1', text: 'Revisar PR da feature de busca semântica', tag: 'trabalho', tagCls: 'electric', done: false },
  { id: 't2', text: 'Comprar café em grão e leite vegetal',     tag: 'casa',     tagCls: '',         done: false },
  { id: 't3', text: 'Responder e-mail do conselheiro do TCC',   tag: 'estudo',   tagCls: 'amber',    done: true  },
  { id: 't4', text: 'Marcar consulta com a dentista',           tag: 'saúde',    tagCls: 'emerald',  done: false },
]
const REFLECT_PROMPTS = [
  'O que pediu sua atenção hoje, mesmo que você não tenha dado?',
  'O que você quer levar de hoje pra amanhã?',
  'Em que você foi gentil consigo mesmo nas últimas 24h?',
  'Algo te surpreendeu hoje? Em que direção?',
  'Qual conversa de hoje você ainda está digerindo?',
]
const MOODS      = ['↓', '~', '↗', '↑', '✦']
const MOOD_LABELS= ['baixo', 'neutro', 'bem', 'ótimo', 'em chamas']

function seedAll(): Habit[] { return HABIT_SEED_DEF.map(h => ({ ...h, history: {} })) }

/* ── localStorage hook — saves synchronously inside setter to avoid async races ── */
function useLocal<T>(key: string, init: T | (() => T)): [T, (action: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {}
    return typeof init === 'function' ? (init as () => T)() : init
  })

  const set = useCallback((action: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action
      try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      return next
    })
  }, [key])

  return [state, set]
}

/* ── streak ── */
function computeStreak(habits: Habit[]) {
  const today = getToday()
  let s = 0
  for (let i = 0; i < 365; i++) {
    if (habits.some(h => h.history[fmtKey(addDays(today, -i))])) s++; else break
  }
  return s
}
function todayCompletion(habits: Habit[]) {
  const k = fmtKey(getToday()); return { done: habits.filter(h => h.history[k]).length, total: habits.length }
}
function weekCompletion(habits: Habit[]) {
  const today = getToday()
  let done = 0, total = 0
  for (let i = 0; i < 7; i++) { const k = fmtKey(addDays(today,-i)); for (const h of habits) { total++; if (h.history[k]) done++ } }
  return Math.round((done/total)*100)
}

/* ── icons ── */
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12l5 5 11-12"/>
  </svg>
)

/* ── task text input — isolated so parent re-renders don't reset in-flight edits ── */
const TaskTextInput = memo(({ value, done, onChange }: { value: string; done: boolean; onChange: (t: string) => void }) => {
  const [text, setText] = useState(value)
  const editing = useRef(false)

  const prevValue = useRef(value)
  if (prevValue.current !== value && !editing.current) {
    setText(value)
    prevValue.current = value
  }

  return (
    <input
      className="hm-task__text"
      data-done={done}
      value={text}
      onChange={e => { editing.current = true; setText(e.target.value) }}
      onBlur={e => { editing.current = false; onChange(e.target.value) }}
      onFocus={() => { editing.current = true }}
    />
  )
})

/* ================================================================
   HabitsCard
================================================================ */
const HabitsCard = memo(({ habits, setHabits }: { habits: Habit[]; setHabits: (a: Habit[] | ((p: Habit[]) => Habit[])) => void }) => {
  const [addingHabit, setAddingHabit] = useState(false)
  const [habitDraft, setHabitDraft] = useState({ name: '', glyph: '○', sub: '' })

  const toggle = useCallback((habitId: string) => {
    const k = fmtKey(getToday())
    setHabits(hs => hs.map(h => h.id === habitId
      ? { ...h, history: { ...h.history, [k]: h.history[k] ? 0 : 1 } }
      : h))
  }, [setHabits])

  const remove = useCallback((habitId: string) => {
    setHabits(hs => hs.filter(h => h.id !== habitId))
  }, [setHabits])

  const addHabit = () => {
    const name = habitDraft.name.trim()
    if (!name) return
    setHabits(hs => [...hs, {
      id: 'h_' + Date.now(),
      name,
      glyph: habitDraft.glyph.trim() || '○',
      glyphCls: '',
      sub: habitDraft.sub.trim() || 'diariamente',
      history: {},
    }])
    setHabitDraft({ name: '', glyph: '○', sub: '' })
    setAddingHabit(false)
  }

  const habitStreak = (h: Habit) => {
    const today = getToday()
    let s = 0; for (let i = 0; i < 200; i++) { if (h.history[fmtKey(addDays(today,-i))]) s++; else break }; return s
  }
  const lastSeven = (h: Habit) => {
    const today = getToday()
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, -(6-i)); return { date: d, done: !!h.history[fmtKey(d)], isToday: i === 6 }
    })
  }

  const todayKey = fmtKey(getToday())

  return (
    <div className="hm-card">
      <div className="hm-card__head">
        <h2 className="hm-card__title">Hábitos <em>· hoje</em></h2>
        <div className="hm-card__meta hm-card__meta--row">
          <span><b>{habits.filter(h => h.history[todayKey]).length}</b> / {habits.length}</span>
          <button className="hm-habit-add-btn" onClick={() => setAddingHabit(v => !v)} title="Adicionar hábito">+</button>
        </div>
      </div>
      <div className="hm-habits">
        {habits.map(h => {
          const done = !!h.history[todayKey]
          const streak = habitStreak(h)
          return (
            <div key={h.id} className="hm-habit" data-done={done}>
              <div className={`hm-habit__glyph hm-habit__glyph--${h.glyphCls || 'default'}`}>{h.glyph}</div>
              <div className="hm-habit__info">
                <div className="hm-habit__name">{h.name}</div>
                <div className="hm-habit__sub">
                  <span>{h.sub}</span>
                  {streak > 1 && <span><b>{streak}d</b> seguidos</span>}
                </div>
              </div>
              <div className="hm-habit__week" title="últimos 7 dias">
                {lastSeven(h).map((d, i) => (
                  <div key={i} className="hm-habit__week-dot"
                    data-done={d.done || undefined}
                    data-today={d.isToday || undefined}
                    title={`${WEEKDAYS_PT[d.date.getDay()]} · ${d.done ? 'feito' : 'pendente'}`}/>
                ))}
              </div>
              <button className="hm-habit__del" onClick={() => remove(h.id)} title="Remover hábito">×</button>
              <button className="hm-habit__check" data-done={done} onClick={() => toggle(h.id)}
                aria-label={done ? `Desmarcar ${h.name}` : `Marcar ${h.name} como feito`}>
                <CheckIcon />
              </button>
            </div>
          )
        })}
        {addingHabit && (
          <div className="hm-habit-form">
            <input
              className="hm-habit-form__glyph"
              value={habitDraft.glyph}
              onChange={e => setHabitDraft(d => ({ ...d, glyph: e.target.value }))}
              maxLength={2}
              title="Ícone (emoji ou símbolo)"
            />
            <input
              className="hm-habit-form__name"
              placeholder="Nome do hábito"
              value={habitDraft.name}
              onChange={e => setHabitDraft(d => ({ ...d, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
              autoFocus
            />
            <input
              className="hm-habit-form__sub"
              placeholder="Descrição (opcional)"
              value={habitDraft.sub}
              onChange={e => setHabitDraft(d => ({ ...d, sub: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && addHabit()}
            />
            <button className="hm-habit-form__confirm" onClick={addHabit}>adicionar</button>
            <button className="hm-habit-form__cancel" onClick={() => setAddingHabit(false)}>×</button>
          </div>
        )}
      </div>
    </div>
  )
})

/* ================================================================
   CalendarCard
================================================================ */
const CalendarIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="2" width="14" height="13" rx="2"/>
    <path d="M1 6h14M5 1v2M11 1v2"/>
  </svg>
)

const CalendarCard = memo(({
  connected, events, loading, error, tasks,
  onConnect, onDisconnect, onImport, onRefresh, connecting,
}: {
  connected: boolean; events: CalendarEvent[]; loading: boolean; error: string | null
  tasks: Task[]; onConnect: () => void; onDisconnect: () => void
  onImport: (e: CalendarEvent) => void; onRefresh: () => void; connecting: boolean
}) => {
  const importedIds = new Set(tasks.map(t => t.gcalEventId).filter(Boolean))

  const formatTime = (ev: CalendarEvent) => {
    if (ev.start.date && !ev.start.dateTime) return 'dia todo'
    const dt = new Date(ev.start.dateTime!)
    return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="hm-card">
      <div className="hm-card__head">
        <h2 className="hm-card__title">Calendário <em>· hoje</em></h2>
        <div className="hm-card__meta hm-card__meta--row">
          {connected && <>
            <span><b>{events.length}</b> eventos</span>
            <button className="hm-habit-add-btn" onClick={onRefresh} disabled={loading} title="Atualizar">
              {loading ? '…' : '↻'}
            </button>
          </>}
        </div>
      </div>

      {!connected ? (
        <div className="hm-gcal-connect">
          <p className="hm-gcal-connect__desc">
            Veja e sincronize seus eventos do Google Calendar com as tarefas de hoje.
          </p>
          <button className="hm-gcal-connect__btn" onClick={onConnect} disabled={connecting}>
            {connecting ? 'Aguardando autorização…' : 'Conectar Google Calendar'}
          </button>
        </div>
      ) : error ? (
        <div className="hm-gcal-state">
          <span className="hm-gcal-state__msg">{error}</span>
          <button className="hm-gcal-state__retry" onClick={onRefresh}>Tentar novamente</button>
        </div>
      ) : loading ? (
        <div className="hm-gcal-state"><span className="hm-gcal-state__msg">Carregando…</span></div>
      ) : events.length === 0 ? (
        <div className="hm-gcal-state"><span className="hm-gcal-state__msg">Nenhum evento para hoje.</span></div>
      ) : (
        <div className="hm-gcal-events">
          {events.map(ev => {
            const isTask = importedIds.has(ev.id)
            return (
              <div key={ev.id} className="hm-gcal-event" data-imported={isTask || undefined}>
                <span className="hm-gcal-event__time">{formatTime(ev)}</span>
                <span className="hm-gcal-event__title">{ev.summary}</span>
                {isTask
                  ? <span className="hm-gcal-event__badge">✓ tarefa</span>
                  : <button className="hm-gcal-event__import" onClick={() => onImport(ev)}>+ tarefa</button>
                }
              </div>
            )
          })}
        </div>
      )}

      {connected && (
        <button className="hm-gcal-disconnect" onClick={onDisconnect}>Desconectar calendário</button>
      )}
    </div>
  )
})

/* ================================================================
   TasksCard
================================================================ */
const TasksCard = memo(({
  tasks, setTasks, gcalConnected, onSyncToggle, onToggle, onRemove,
}: {
  tasks: Task[]
  setTasks: (a: Task[] | ((p: Task[]) => Task[])) => void
  gcalConnected: boolean
  onSyncToggle: (task: Task) => void
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}) => {
  const [draft, setDraft] = useState('')
  const open = tasks.filter(t => !t.done).length

  const editText = useCallback((id: string, text: string) => setTasks(ts => ts.map(t => t.id === id ? { ...t, text } : t)), [setTasks])
  const add = () => {
    const txt = draft.trim(); if (!txt) return
    setTasks(ts => [...ts, { id: 'u_' + Date.now(), text: txt, tag: 'hoje', tagCls: '', done: false }])
    setDraft('')
  }

  return (
    <div className="hm-card">
      <div className="hm-card__head">
        <h2 className="hm-card__title">Tarefas <em>· de hoje</em></h2>
        <div className="hm-card__meta"><span><b>{open}</b> em aberto</span></div>
      </div>
      <div className="hm-tasks">
        {tasks.map(t => (
          <div key={t.id} className="hm-task" data-done={t.done}>
            <button className="hm-task__check" data-done={t.done} onClick={() => onToggle(t.id)}
              aria-label={t.done ? 'Desmarcar tarefa' : 'Concluir tarefa'}><CheckIcon /></button>
            <div className="hm-task__body">
              <TaskTextInput value={t.text} done={t.done} onChange={text => editText(t.id, text)} />
              <div className="hm-task__meta">
                <span className={`hm-task__tag hm-task__tag--${t.tagCls || 'clay'}`}>{t.tag}</span>
              </div>
            </div>
            {gcalConnected && (
              <button
                className="hm-task__cal-btn"
                data-synced={!!t.gcalEventId || undefined}
                onClick={() => onSyncToggle(t)}
                title={t.gcalEventId ? 'Remover do Google Calendar' : 'Adicionar ao Google Calendar'}
              >
                <CalendarIcon />
              </button>
            )}
            <button className="hm-task__del" onClick={() => onRemove(t.id)} title="remover">×</button>
          </div>
        ))}
        <form className="hm-task-add" onSubmit={e => { e.preventDefault(); add() }}>
          <input placeholder="Adicionar tarefa…" value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}/>
          <button type="submit" className="hm-task-add__btn" aria-label="Adicionar tarefa">+</button>
        </form>
      </div>
    </div>
  )
})

/* ================================================================
   ReflectionCard
================================================================ */
const ReflectionCard = memo(({ reflect, setReflect }: { reflect: ReflectStore; setReflect: (a: ReflectStore | ((p: ReflectStore) => ReflectStore)) => void }) => {
  const today = getToday()
  const key   = fmtKey(today)
  const entry = reflect[key] ?? { text: '', mood: -1 }
  const prompt = REFLECT_PROMPTS[today.getDate() % REFLECT_PROMPTS.length]
  const setText = useCallback((text: string) => setReflect(r => ({ ...r, [key]: { ...r[key] ?? { mood: -1 }, text } })), [setReflect, key])
  const setMood = useCallback((mood: number) => setReflect(r => { const e = r[key] ?? { text: '', mood: -1 }; return { ...r, [key]: { ...e, mood: e.mood === mood ? -1 : mood } } }), [setReflect, key])
  const words = entry.text?.trim() ? entry.text.trim().split(/\s+/).length : 0

  return (
    <div className="hm-card hm-reflect">
      <div className="hm-card__head">
        <h2 className="hm-card__title">Reflexão <em>· do dia</em></h2>
        <div className="hm-card__meta"><span>{WEEKDAYS_PT[today.getDay()]}</span></div>
      </div>
      <div className="hm-reflect__prompt">{prompt}</div>
      <textarea className="hm-reflect__field"
        placeholder="Comece a escrever sem se preocupar com a estrutura…"
        value={entry.text} onChange={e => setText(e.target.value)}/>
      <div className="hm-reflect__foot">
        <div className="hm-reflect__count"><b>{words}</b> palavras</div>
        <div className="hm-reflect__moods" title="humor de hoje">
          {MOODS.map((m, i) => (
            <button key={i} className="hm-reflect__mood"
              data-active={entry.mood === i || undefined}
              title={MOOD_LABELS[i]} onClick={() => setMood(i)}>{m}</button>
          ))}
        </div>
      </div>
    </div>
  )
})

/* ================================================================
   Heatmap
================================================================ */
const Heatmap = memo(({ habits, filter, setFilter }: { habits: Habit[]; filter: string; setFilter: (f: string) => void }) => {
  const today     = getToday()
  const todayDow  = today.getDay()
  const startDate = addDays(today, -(13*7 - 1 - (6 - todayDow)))
  type Cell = { col: number; row: number; date: Date; inRange: boolean; level: number; value: number; totalHabits: number; isToday: boolean }
  const cells: Cell[] = []
  for (let col = 0; col < 13; col++) {
    for (let row = 0; row < 7; row++) {
      const date = addDays(startDate, col*7+row); const inRange = date <= today
      let level = 0, value = 0, totalHabits = 0
      if (inRange) {
        const k = fmtKey(date)
        if (filter === 'all') { for (const h of habits) { totalHabits++; if (h.history[k]) value++ }; const p = totalHabits ? value/totalHabits : 0; level = p>=.85?4:p>=.6?3:p>=.35?2:p>0?1:0 }
        else {
          const h = habits.find(hab => hab.id === filter)
          totalHabits = 1; value = h?.history[k] ? 1 : 0
          if (h) {
            let wk = 0
            for (let j = 0; j < 7; j++) if (h.history[fmtKey(addDays(date, -j))]) wk++
            const p = wk / 7
            level = p >= .85 ? 4 : p >= .6 ? 3 : p >= .35 ? 2 : p > 0 ? 1 : 0
          }
        }
      }
      cells.push({ col, row, date, inRange, level, value, totalHabits, isToday: fmtKey(date)===fmtKey(today) })
    }
  }
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  for (let col = 0; col < 13; col++) {
    const fd = addDays(startDate, col*7); const m = fd.getMonth()
    if ((m!==lastMonth && fd.getDate()<=14) || col===0) { monthLabels.push({ col, label: MONTHS_PT_SHORT[m] }); lastMonth=m }
    else monthLabels.push({ col, label: '' })
  }
  const totalActive  = cells.filter(c => c.inRange && c.level > 0).length
  const totalInRange = cells.filter(c => c.inRange).length

  return (
    <div className="hm-card">
      <div className="hm-card__head">
        <h2 className="hm-card__title">Consistência <em>· 13 semanas</em></h2>
        <div className="hm-card__meta"><span><b>{totalActive}</b> / {totalInRange} dias</span></div>
      </div>
      <div className="hm-heatmap__filter">
        <button className="hm-heatmap__pill" data-active={filter==='all'||undefined} onClick={() => setFilter('all')}>todos os hábitos</button>
        {habits.map(h => (
          <button key={h.id} className="hm-heatmap__pill" data-active={filter===h.id||undefined} onClick={() => setFilter(h.id)}>
            {h.name.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="hm-heatmap">
        <div className="hm-heatmap__days">
          <span>dom</span><span>seg</span><span></span><span>qua</span><span></span><span>sex</span><span></span>
        </div>
        <div className="hm-heatmap__cols">
          <div className="hm-heatmap__months">{monthLabels.map((m,i) => <span key={i}>{m.label}</span>)}</div>
          <div className="hm-heatmap__grid">
            {cells.map((c, i) => (
              <div key={i} className="hm-heatmap__cell"
                data-level={c.level} data-empty={!c.inRange||undefined} data-today={c.isToday||undefined}>
                {c.inRange && (
                  <div className="hm-heatmap__tip">
                    {c.date.getDate()} {MONTHS_PT_SHORT[c.date.getMonth()]} · {filter==='all' ? `${c.value}/${c.totalHabits} hábitos` : (c.value?'feito':'pendente')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hm-heatmap__legend">
        <span>menos</span>
        <div className="hm-heatmap__legend-scale">
          <span className="swatch"/>
          <span className="swatch" data-level="1"/><span className="swatch" data-level="2"/>
          <span className="swatch" data-level="3"/><span className="swatch" data-level="4"/>
        </div>
        <span>mais</span>
      </div>
    </div>
  )
})

/* ================================================================
   ConsistencyChart
================================================================ */
const ConsistencyChart = memo(({ habits }: { habits: Habit[] }) => {
  const today = getToday()
  const DAYS = 30, W = 520, H = 200
  const PAD  = { l: 8, r: 8, t: 14, b: 26 }
  const iW   = W - PAD.l - PAD.r
  const iH   = H - PAD.t - PAD.b
  const data = Array.from({ length: DAYS }, (_, i) => {
    const d = addDays(today, -(DAYS-1-i)); const k = fmtKey(d)
    let done = 0; for (const h of habits) if (h.history[k]) done++
    return { date: d, value: habits.length ? done/habits.length : 0, raw: done }
  })
  const xp = (i: number) => PAD.l + (i/(DAYS-1)) * iW
  const yp = (v: number) => PAD.t + (1-v) * iH
  const linePath = (() => {
    const pts = data.map((d, i) => [xp(i), yp(d.value)])
    let p = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0,y0]=pts[Math.max(0,i-1)],[x1,y1]=pts[i],[x2,y2]=pts[i+1],[x3,y3]=pts[Math.min(pts.length-1,i+2)]
      const t=.18; p += ` C ${(x1+(x2-x0)*t).toFixed(2)} ${(y1+(y2-y0)*t).toFixed(2)}, ${(x2-(x3-x1)*t).toFixed(2)} ${(y2-(y3-y1)*t).toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`
    }
    return p
  })()
  const areaPath = `${linePath} L ${xp(DAYS-1)} ${PAD.t+iH} L ${xp(0)} ${PAD.t+iH} Z`
  const avg  = data.reduce((s,d) => s+d.value, 0) / data.length
  const avgY = yp(avg)
  const [hover, setHover] = useState<number | null>(null)
  const xLabels = [
    { i: 0,              label: `${data[0].date.getDate()} ${MONTHS_PT_SHORT[data[0].date.getMonth()]}` },
    { i: Math.floor(DAYS/2), label: `${data[Math.floor(DAYS/2)].date.getDate()} ${MONTHS_PT_SHORT[data[Math.floor(DAYS/2)].date.getMonth()]}` },
    { i: DAYS-1,         label: 'hoje' },
  ]

  return (
    <div className="hm-card hm-chart">
      <div className="hm-card__head">
        <h2 className="hm-card__title">Tendência <em>· últimos 30 dias</em></h2>
        <div className="hm-card__meta"><span>média <b>{Math.round(avg*100)}%</b></span></div>
      </div>
      <div className="hm-chart__wrap">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="hmArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgb(var(--accent-terracotta-rgb))" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="rgb(var(--accent-terracotta-rgb))" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[0,.25,.5,.75,1].map((v,i) => <line key={i} className="hm-chart__grid" x1={PAD.l} x2={W-PAD.r} y1={yp(v)} y2={yp(v)} strokeDasharray={v===0||v===1?'0':'2 4'}/>)}
          {[0,.5,1].map((v,i) => <text key={i} className="hm-chart__axis-label" x={W-PAD.r-2} y={yp(v)-4} textAnchor="end">{Math.round(v*100)}%</text>)}
          <path className="hm-chart__area" d={areaPath}/>
          <path className="hm-chart__line" d={linePath}/>
          <line className="hm-chart__avg" x1={PAD.l} x2={W-PAD.r} y1={avgY} y2={avgY}/>
          <text className="hm-chart__axis-label" x={PAD.l+4} y={avgY-4} fill="var(--text-faint)">média</text>
          {hover!=null && <line className="hm-chart__hover-line" x1={xp(hover)} x2={xp(hover)} y1={PAD.t} y2={PAD.t+iH}/>}
          <circle className="hm-chart__dot" cx={xp(DAYS-1)} cy={yp(data[DAYS-1].value)} r="4"/>
          {hover!=null && hover!==DAYS-1 && <circle className="hm-chart__dot" cx={xp(hover)} cy={yp(data[hover].value)} r="4"/>}
          {data.map((_,i) => <rect key={i} x={xp(i)-iW/(DAYS-1)/2} y={PAD.t} width={iW/(DAYS-1)} height={iH} fill="transparent" onMouseEnter={() => setHover(i)}/>)}
          {xLabels.map((l,i) => <text key={i} className="hm-chart__axis-label" x={xp(l.i)} y={H-8} textAnchor={i===0?'start':i===xLabels.length-1?'end':'middle'}>{l.label}</text>)}
        </svg>
        {hover!=null && (() => { const d=data[hover]; return (
          <div className="hm-chart__tip" style={{ left: `${(xp(hover)/W)*100}%`, top: `${(yp(d.value)/H)*100}%` }}>
            <b>{Math.round(d.value*100)}%</b> · {d.raw}/{habits.length}
            <span>{d.date.getDate()} {MONTHS_PT_FULL[d.date.getMonth()]} · {WEEKDAYS_PT[d.date.getDay()].slice(0,3)}</span>
          </div>
        )})()}
      </div>
      <div className="hm-chart__legend">
        <div className="hm-chart__legend-row">
          <div className="hm-chart__legend-key"><span className="line"/><span>conclusão diária</span></div>
          <div className="hm-chart__legend-key"><span className="line dash"/><span>média 30d</span></div>
        </div>
        <span>{habits.length} hábitos rastreados</span>
      </div>
    </div>
  )
})

/* ================================================================
   HomeMode
================================================================ */
export function HomeMode() {
  const user   = useAuthStore(s => s.user)
  const userId = user?.id ?? 'local'
  const uid    = userId.slice(0, 8)

  const [habits,     _setHabits]  = useLocal<Habit[]>(`hm.habits.v2.${uid}`, seedAll)
  const [tasks,      _setTasks]   = useLocal<Task[]>(`hm.tasks.v2.${uid}`, () => [])
  const [reflect,    _setReflect] = useLocal<ReflectStore>(`hm.reflect.v2.${uid}`, {})
  const [heatFilter, setHeatFilter] = useState('all')

  /* ── Google Calendar state ── */
  const [gcalConnected,  setGcalConnected]  = useState(isConnected)
  const [calEvents,      setCalEvents]      = useState<CalendarEvent[]>([])
  const [calLoading,     setCalLoading]     = useState(false)
  const [calError,       setCalError]       = useState<string | null>(null)
  const [gcalConnecting, setGcalConnecting] = useState(false)

  /* ── Supabase sync ── */
  const { online, setHomeSyncing, setHomePending } = useSyncStore()
  const pendingRef  = useRef(false)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const habitsRef   = useRef(habits)
  const tasksRef    = useRef(tasks)
  const reflectRef  = useRef(reflect)
  habitsRef.current  = habits
  tasksRef.current   = tasks
  reflectRef.current = reflect

  const flush = useCallback(async () => {
    if (!pendingRef.current || !user) return
    setHomeSyncing(true)
    try {
      await saveHomeData(user.id, {
        habits:  habitsRef.current,
        tasks:   tasksRef.current,
        reflect: reflectRef.current,
      })
      pendingRef.current = false
      setHomePending(false)
    } catch {
      // will retry on next mutation or reconnect
    } finally {
      setHomeSyncing(false)
    }
  }, [user, setHomeSyncing, setHomePending])

  const scheduleUpsert = useCallback(() => {
    if (!user) return
    pendingRef.current = true
    setHomePending(true)
    clearTimeout(timerRef.current)
    if (online) timerRef.current = setTimeout(flush, 1500)
  }, [user, online, flush, setHomePending])

  // Load from Supabase on login — overrides localStorage
  useEffect(() => {
    if (!user) return
    loadHomeData(user.id).then(data => {
      if (data) { _setHabits(data.habits); _setTasks(data.tasks); _setReflect(data.reflect) }
    }).catch(() => {})
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flush pending when coming back online
  const prevOnlineRef = useRef(online)
  useEffect(() => {
    if (online && !prevOnlineRef.current && pendingRef.current) flush()
    prevOnlineRef.current = online
  }, [online, flush])

  const setHabits = useCallback((action: Habit[] | ((p: Habit[]) => Habit[])) => {
    _setHabits(action); scheduleUpsert()
  }, [_setHabits, scheduleUpsert])

  const setTasks = useCallback((action: Task[] | ((p: Task[]) => Task[])) => {
    _setTasks(action); scheduleUpsert()
  }, [_setTasks, scheduleUpsert])

  const setReflect = useCallback((action: ReflectStore | ((p: ReflectStore) => ReflectStore)) => {
    _setReflect(action); scheduleUpsert()
  }, [_setReflect, scheduleUpsert])

  /* ── Google Calendar handlers ── */
  const loadCalEvents = useCallback(async () => {
    if (!isConnected()) return
    setCalLoading(true); setCalError(null)
    try { setCalEvents(await fetchTodayEvents()) }
    catch (e) { setCalError(String(e)) }
    finally { setCalLoading(false) }
  }, [])

  useEffect(() => { if (gcalConnected) loadCalEvents() }, [gcalConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGcalConnect = useCallback(async () => {
    setGcalConnecting(true)
    try {
      await connectGoogleCalendar()
      setGcalConnected(true)
      toast.success('Google Calendar conectado!')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setGcalConnecting(false)
    }
  }, [])

  const handleGcalDisconnect = useCallback(async () => {
    await disconnectGoogleCalendar()
    setGcalConnected(false)
    setCalEvents([])
    toast.success('Calendário desconectado')
  }, [])

  const handleImportEvent = useCallback((ev: CalendarEvent) => {
    setTasks(ts => [...ts, {
      id: 'gcal_' + ev.id,
      text: ev.summary,
      tag: 'agenda',
      tagCls: 'electric',
      done: false,
      gcalEventId: ev.id,
    }])
    toast.success('Evento importado como tarefa')
  }, [setTasks])

  const handleTaskSyncToggle = useCallback(async (task: Task) => {
    if (task.gcalEventId) {
      try { await deleteEvent(task.gcalEventId) } catch {}
      setTasks(ts => ts.map(t => t.id === task.id ? { ...t, gcalEventId: undefined } : t))
      toast.success('Removido do Google Calendar')
    } else {
      try {
        const ev = await createEvent(task.text)
        setTasks(ts => ts.map(t => t.id === task.id ? { ...t, gcalEventId: ev.id } : t))
        toast.success('Adicionado ao Google Calendar')
      } catch (e) { toast.error(String(e)) }
    }
  }, [setTasks])

  const handleTaskToggle = useCallback(async (id: string) => {
    const task = tasksRef.current.find(t => t.id === id)
    if (!task) return
    const newDone = !task.done
    setTasks(ts => ts.map(t => t.id === id ? { ...t, done: newDone } : t))
    if (task.gcalEventId && isConnected()) {
      try { await updateEventSummary(task.gcalEventId, newDone ? `✓ ${task.text}` : task.text) }
      catch {} // silent fail — local state already updated
    }
  }, [setTasks])

  const handleTaskRemove = useCallback(async (id: string) => {
    const task = tasksRef.current.find(t => t.id === id)
    setTasks(ts => ts.filter(t => t.id !== id))
    if (task?.gcalEventId && isConnected()) {
      try { await deleteEvent(task.gcalEventId) } catch {}
    }
  }, [setTasks])

  const today    = getToday()
  const dateLabel = `${WEEKDAYS_PT[today.getDay()]} · ${today.getDate()} de ${MONTHS_PT_FULL[today.getMonth()]}`
  const streak  = computeStreak(habits)
  const todayC  = todayCompletion(habits)
  const weekPct = weekCompletion(habits)

  return (
    <div className="hm-page">
      <div className="hm">
        <section className="hm-hero">
          <div>
            <div className="hm-hero__eyebrow"><span className="dot"/><span>{dateLabel}</span></div>
            <h1 className="hm-hero__title">{greeting()}. <em>Comece pequeno</em>, termine inteiro.</h1>
            <p className="hm-hero__lead">Um pouso suave antes de abrir o editor: marque o que você já moveu hoje, alinhe as tarefas que pedem você, e escreva o suficiente pra entender o que está pensando.</p>
          </div>
          <div className="hm-hero__stats">
            <div className="hm-stat">
              <div className="hm-stat__num"><em>{streak}</em></div>
              <div className="hm-stat__label">dias seguidos</div>
              <div className="hm-stat__hint">algum hábito por dia</div>
            </div>
            <div className="hm-stat">
              <div className="hm-stat__num"><em>{todayC.done}</em>/{todayC.total}</div>
              <div className="hm-stat__label">hábitos hoje</div>
              <div className="hm-stat__hint">manhã ainda em movimento</div>
            </div>
            <div className="hm-stat">
              <div className="hm-stat__num"><em>{weekPct}</em>%</div>
              <div className="hm-stat__label">média da semana</div>
              <div className="hm-stat__hint">média dos últimos 7 dias</div>
            </div>
          </div>
        </section>

        <div className="hm-grid">
          <div className="hm-col">
            <HabitsCard habits={habits} setHabits={setHabits}/>
            <TasksCard
              tasks={tasks}
              setTasks={setTasks}
              gcalConnected={gcalConnected}
              onSyncToggle={handleTaskSyncToggle}
              onToggle={handleTaskToggle}
              onRemove={handleTaskRemove}
            />
            <CalendarCard
              connected={gcalConnected}
              events={calEvents}
              loading={calLoading}
              error={calError}
              tasks={tasks}
              onConnect={handleGcalConnect}
              onDisconnect={handleGcalDisconnect}
              onImport={handleImportEvent}
              onRefresh={loadCalEvents}
              connecting={gcalConnecting}
            />
          </div>
          <div className="hm-col">
            <ReflectionCard reflect={reflect} setReflect={setReflect}/>
          </div>
        </div>

        <div className="hm-metrics">
          <Heatmap habits={habits} filter={heatFilter} setFilter={setHeatFilter}/>
          <ConsistencyChart habits={habits}/>
        </div>

        <div className="hm-quick">
          <div className="hm-quick__link">
            <div className="hm-quick__link-eyebrow">↳ continuar</div>
            <div className="hm-quick__link-title">Editor <em>de notas</em></div>
            <div className="hm-quick__link-sub">spatial, floating, AI-native, graph</div>
          </div>
          <div className="hm-quick__link">
            <div className="hm-quick__link-eyebrow">↳ escrever</div>
            <div className="hm-quick__link-title">Zen <em>mode</em></div>
            <div className="hm-quick__link-sub">modo de escrita focada sem distração</div>
          </div>
          <div className="hm-quick__link">
            <div className="hm-quick__link-eyebrow">↳ visualizar</div>
            <div className="hm-quick__link-title">Grafo <em>de notas</em></div>
            <div className="hm-quick__link-sub">force-directed · arraste nós · preview</div>
          </div>
          <div className="hm-quick__link" style={{ cursor: 'pointer', position: 'relative' }}
            onClick={() => setTasks([])}>
            <div className="hm-quick__link-eyebrow">↺ resetar</div>
            <div className="hm-quick__link-title">Limpar <em>o dia</em></div>
            <div className="hm-quick__link-sub">limpa todas as tarefas do dia</div>
          </div>
        </div>
      </div>
    </div>
  )
}
