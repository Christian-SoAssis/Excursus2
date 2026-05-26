import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGanttStore, type GanttProject, type GanttTask, type ZoomLevel } from '../../store/gantt'
import { Editor } from '../editor/Editor'

// ─── Layout constants ────────────────────────────────────────────────────────
const ROW_H     = 44
const BAR_H     = 26
const HDR_TOP   = 30
const HDR_SUB   = 26
const HDR_H     = HDR_TOP + HDR_SUB
const SIDEBAR_W = 224
const NOTE_W    = 380

const PX: Record<ZoomLevel, number> = { month: 7, week: 20, day: 40 }

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const DAYS   = ['D','S','T','Q','Q','S','S']
const PALETTE = [
  '#FF6B6B','#FFA94D','#FFD43B','#69DB7C',
  '#4DABF7','#748FFC','#E599F7','#F783AC','#63E6BE','#A9E34B',
]

// ─── Date helpers ─────────────────────────────────────────────────────────────
const toDate   = (iso: string) => { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d) }
const fromDate = (d: Date)     => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays  = (iso: string, n: number) => { const d = toDate(iso); d.setDate(d.getDate()+n); return fromDate(d) }
const diffDays = (a: string, b: string)   => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000)
const todayISO = () => fromDate(new Date())

// ─── Timeline builder ─────────────────────────────────────────────────────────
interface TimeCell { label: string; left: number; width: number }
interface SubCell  extends TimeCell { isWeekend: boolean; isToday: boolean }

function buildTimeline(
  chartStart: string, chartEnd: string, pxPerDay: number, zoom: ZoomLevel
): { topCells: TimeCell[]; subCells: SubCell[] } {
  const totalDays = diffDays(chartStart, chartEnd) + 1
  const today     = todayISO()
  const topCells: TimeCell[] = []
  const subCells: SubCell[]  = []

  // top row: months
  let cur = toDate(chartStart)
  const endDate = toDate(chartEnd)
  while (cur <= endDate) {
    const y = cur.getFullYear(), m = cur.getMonth()
    const segStart  = fromDate(cur)
    const segEndRaw = new Date(y, m + 1, 0)
    const segEnd    = segEndRaw > endDate ? fromDate(endDate) : fromDate(segEndRaw)
    const w         = (diffDays(segStart, segEnd) + 1) * pxPerDay
    topCells.push({ label: `${MONTHS[m]} ${y}`, left: diffDays(chartStart, segStart) * pxPerDay, width: w })
    cur = new Date(y, m + 1, 1)
  }

  if (zoom === 'month') {
    // sub row: weeks
    let c = toDate(chartStart)
    let wn = 1
    while (c <= endDate) {
      const segStart = fromDate(c)
      const dow = c.getDay()
      const toSunday = new Date(c); toSunday.setDate(toSunday.getDate() + (6 - dow))
      const toMonthEnd = new Date(c.getFullYear(), c.getMonth() + 1, 0)
      const rawEnd = toSunday < toMonthEnd ? toSunday : toMonthEnd
      const segEnd = rawEnd > endDate ? fromDate(endDate) : fromDate(rawEnd)
      const w = (diffDays(segStart, segEnd) + 1) * pxPerDay
      subCells.push({ label: `S${wn}`, left: diffDays(chartStart, segStart) * pxPerDay, width: w, isWeekend: false, isToday: false })
      const prevMonth = c.getMonth()
      c = toDate(addDays(segEnd, 1))
      wn = c.getMonth() !== prevMonth ? 1 : wn + 1
    }
  } else {
    // sub row: individual days
    for (let i = 0; i < totalDays; i++) {
      const d   = toDate(addDays(chartStart, i))
      const dow = d.getDay()
      const iso = fromDate(d)
      subCells.push({
        label:     zoom === 'week' ? String(d.getDate()) : DAYS[dow],
        left:      i * pxPerDay,
        width:     pxPerDay,
        isWeekend: dow === 0 || dow === 6,
        isToday:   iso === today,
      })
    }
  }

  return { topCells, subCells }
}

// ─── Project modal ────────────────────────────────────────────────────────────
function ProjectModal({ initial, onSave, onClose }: {
  initial?: GanttProject
  onSave: (name: string, color: string) => void
  onClose: () => void
}) {
  const [name,  setName]  = useState(initial?.name  ?? '')
  const [color, setColor] = useState(initial?.color ?? PALETTE[0])

  return (
    <div className="gm-overlay" onClick={onClose}>
      <div className="gm-modal" onClick={e => e.stopPropagation()}>
        <h3 className="gm-modal__title">{initial ? 'Editar projeto' : 'Novo projeto'}</h3>
        <label className="gm-field">
          <span className="gm-field__label">Nome</span>
          <input className="gm-input" value={name} autoFocus placeholder="Nome do projeto"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && onSave(name.trim(), color)}
          />
        </label>
        <label className="gm-field">
          <span className="gm-field__label">Cor</span>
          <div className="gm-palette">
            {PALETTE.map(c => (
              <button key={c} className={`gm-swatch${c === color ? ' gm-swatch--on' : ''}`}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </label>
        <div className="gm-modal__foot">
          <button className="gm-btn gm-btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="gm-btn gm-btn--primary" disabled={!name.trim()}
            onClick={() => name.trim() && onSave(name.trim(), color)}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Task modal ───────────────────────────────────────────────────────────────
function TaskModal({ initial, onSave, onClose }: {
  initial?: GanttTask
  onSave: (t: Pick<GanttTask, 'name' | 'start' | 'end' | 'progress'>) => void
  onClose: () => void
}) {
  const today = todayISO()
  const [name,     setName]     = useState(initial?.name     ?? '')
  const [start,    setStart]    = useState(initial?.start    ?? today)
  const [end,      setEnd]      = useState(initial?.end      ?? addDays(today, 7))
  const [progress, setProgress] = useState(initial?.progress ?? 0)

  const valid    = name.trim() && start <= end
  const durDays  = start <= end ? diffDays(start, end) + 1 : 0

  return (
    <div className="gm-overlay" onClick={onClose}>
      <div className="gm-modal" onClick={e => e.stopPropagation()}>
        <h3 className="gm-modal__title">{initial ? 'Editar tarefa' : 'Nova tarefa'}</h3>
        <label className="gm-field">
          <span className="gm-field__label">Nome</span>
          <input className="gm-input" value={name} autoFocus placeholder="Nome da tarefa"
            onChange={e => setName(e.target.value)} />
        </label>
        <div className="gm-field-row">
          <label className="gm-field">
            <span className="gm-field__label">Início</span>
            <input type="date" className="gm-input" value={start} onChange={e => setStart(e.target.value)} />
          </label>
          <label className="gm-field">
            <span className="gm-field__label">Término</span>
            <input type="date" className="gm-input" value={end} onChange={e => setEnd(e.target.value)} />
          </label>
        </div>
        {durDays > 0 && (
          <p className="gm-dur">Duração: <strong>{durDays} dia{durDays !== 1 ? 's' : ''}</strong></p>
        )}
        <label className="gm-field">
          <span className="gm-field__label">Progresso — <strong>{progress}%</strong></span>
          <div className="gm-slider-wrap">
            <input type="range" min={0} max={100} value={progress} className="gm-slider"
              onChange={e => setProgress(Number(e.target.value))} />
            <div className="gm-slider-track">
              <div className="gm-slider-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </label>
        <div className="gm-modal__foot">
          <button className="gm-btn gm-btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="gm-btn gm-btn--primary" disabled={!valid}
            onClick={() => valid && onSave({ name: name.trim(), start, end, progress })}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose }: {
  message: string; onConfirm: () => void; onClose: () => void
}) {
  return (
    <div className="gm-overlay" onClick={onClose}>
      <div className="gm-modal gm-modal--sm" onClick={e => e.stopPropagation()}>
        <p className="gm-modal__body">{message}</p>
        <div className="gm-modal__foot">
          <button className="gm-btn gm-btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="gm-btn gm-btn--danger" onClick={() => { onConfirm(); onClose() }}>Excluir</button>
        </div>
      </div>
    </div>
  )
}

// ─── Note panel ───────────────────────────────────────────────────────────────
function NotePanel({ task, onClose }: { task: GanttTask; onClose: () => void }) {
  return (
    <div className="gm-note-panel">
      <div className="gm-note-panel__head">
        <span className="gm-note-panel__tag">📋</span>
        <span className="gm-note-panel__title" title={task.name}>{task.name}</span>
        <button className="gm-icon-btn" onClick={onClose} title="Fechar">✕</button>
      </div>
      <div className="gm-note-panel__meta">
        <span>{task.start.split('-').reverse().join('/')}</span>
        <span>→</span>
        <span>{task.end.split('-').reverse().join('/')}</span>
        <span className="gm-note-panel__sep" />
        <span>{task.progress}% concluído</span>
      </div>
      <div className="gm-note-panel__body">
        {task.noteId
          ? <Editor noteId={task.noteId} />
          : <div className="gm-note-panel__loading">Carregando nota…</div>
        }
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function GanttMode() {
  const {
    projects, tasks, activeProjectId, zoom,
    addProject, updateProject, deleteProject, setActive, setZoom,
    addTask, updateTask, deleteTask, ensureNoteForTask,
  } = useGanttStore()

  type Modal =
    | { kind: 'proj-new' }
    | { kind: 'proj-edit'; proj: GanttProject }
    | { kind: 'task-new' }
    | { kind: 'task-edit'; task: GanttTask }
    | { kind: 'del-proj'; id: string }
    | { kind: 'del-task'; id: string }

  const [modal,        setModal]        = useState<Modal | null>(null)
  const [openTask,     setOpenTask]      = useState<GanttTask | null>(null)
  const [openingNote,  setOpeningNote]   = useState(false)  // loading spinner for ensureNote

  const leftRef  = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null
  const projectTasks  = useMemo(
    () => tasks.filter(t => t.projectId === activeProjectId).sort((a,b) => a.order - b.order),
    [tasks, activeProjectId]
  )

  // keep openTask in sync with store updates (e.g. after ensureNoteForTask populates noteId)
  useEffect(() => {
    if (!openTask) return
    const updated = tasks.find(t => t.id === openTask.id)
    if (updated) setOpenTask(updated)
  }, [tasks])

  // ── Chart math ──────────────────────────────────────────────────────────────
  const { chartStart, chartEnd, pxPerDay, chartWidth, todayLeft } = useMemo(() => {
    const pxPerDay = PX[zoom]
    const today    = todayISO()
    let chartStart: string, chartEnd: string

    if (projectTasks.length > 0) {
      const minStart = projectTasks.map(t => t.start).reduce((a,b) => a < b ? a : b)
      const maxEnd   = projectTasks.map(t => t.end  ).reduce((a,b) => a > b ? a : b)
      chartStart = addDays(minStart, -14)
      chartEnd   = addDays(maxEnd,   +21)
    } else {
      const d = new Date()
      chartStart = fromDate(new Date(d.getFullYear(), d.getMonth(), 1))
      chartEnd   = fromDate(new Date(d.getFullYear(), d.getMonth() + 3, 0))
    }
    if (today < chartStart) chartStart = addDays(today, -7)
    if (today > chartEnd)   chartEnd   = addDays(today, +14)

    const totalDays  = diffDays(chartStart, chartEnd) + 1
    const chartWidth = totalDays * pxPerDay
    const todayLeft  = diffDays(chartStart, today) * pxPerDay
    return { chartStart, chartEnd, pxPerDay, totalDays, chartWidth, todayLeft }
  }, [projectTasks, zoom])

  const { topCells, subCells } = useMemo(
    () => buildTimeline(chartStart, chartEnd, pxPerDay, zoom),
    [chartStart, chartEnd, pxPerDay, zoom]
  )

  // ── Scroll sync ─────────────────────────────────────────────────────────────
  const syncScroll = useCallback(() => {
    if (leftRef.current && rightRef.current)
      leftRef.current.scrollTop = rightRef.current.scrollTop
  }, [])

  const scrollToToday = useCallback(() => {
    if (!rightRef.current) return
    rightRef.current.scrollLeft = Math.max(0, todayLeft - rightRef.current.clientWidth / 3)
  }, [todayLeft])

  useEffect(() => { scrollToToday() }, [activeProjectId, zoom])

  // ── Horizontal wheel scroll ──────────────────────────────────────────────────
  // Convert vertical mouse-wheel delta → horizontal scroll on the chart.
  // Must use a non-passive listener so we can call preventDefault().
  useEffect(() => {
    const el = rightRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // If the user is already scrolling horizontally (trackpad), let it pass.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])  // rightRef is stable, no deps needed

  // ── Open note for a task (creating it lazily if needed) ──────────────────────
  const handleOpenNote = useCallback(async (task: GanttTask) => {
    if (task.noteId) {
      setOpenTask(task)
      return
    }
    // Legacy task — create note lazily
    setOpeningNote(true)
    await ensureNoteForTask(task.id)
    setOpeningNote(false)
    // useEffect above will update openTask once the store updates with the new noteId
    const updated = useGanttStore.getState().tasks.find(t => t.id === task.id)
    if (updated) setOpenTask(updated)
  }, [ensureNoteForTask])

  // ── Stats ───────────────────────────────────────────────────────────────────
  const today   = todayISO()
  const total   = projectTasks.length
  const done    = projectTasks.filter(t => t.progress === 100).length
  const overdue = projectTasks.filter(t => t.end < today && t.progress < 100).length
  const avgPct  = total === 0 ? 0 : Math.round(projectTasks.reduce((s,t) => s + t.progress, 0) / total)

  const canvasH = Math.max(projectTasks.length, 6) * ROW_H

  return (
    <div className="gm">

      {/* ── Toolbar ── */}
      <div className="gm-tb">
        <div className="gm-tb__left">
          <select className="gm-select" value={activeProjectId ?? ''}
            onChange={e => { setActive(e.target.value || null); setOpenTask(null) }}>
            <option value="">— Projeto —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="gm-btn gm-btn--outline" onClick={() => setModal({ kind: 'proj-new' })}>+ Projeto</button>
          {activeProject && <>
            <button className="gm-icon-btn" title="Editar projeto"
              onClick={() => setModal({ kind: 'proj-edit', proj: activeProject })}>✎</button>
            <button className="gm-icon-btn gm-icon-btn--danger" title="Excluir projeto"
              onClick={() => setModal({ kind: 'del-proj', id: activeProject.id })}>✕</button>
          </>}
        </div>

        {activeProject && (
          <div className="gm-tb__center">
            <div className="gm-pbar">
              <div className="gm-pbar__fill" style={{ width: `${avgPct}%`, background: activeProject.color }} />
            </div>
            <span className="gm-stat"><strong>{avgPct}%</strong> concluído</span>
            <span className="gm-stat-sep" />
            <span className="gm-stat"><strong>{done}/{total}</strong> tarefas</span>
            {overdue > 0 && <>
              <span className="gm-stat-sep" />
              <span className="gm-stat gm-stat--warn">⚠ <strong>{overdue}</strong> atrasada{overdue > 1 ? 's' : ''}</span>
            </>}
          </div>
        )}

        <div className="gm-tb__right">
          {activeProject && (
            <button className="gm-btn gm-btn--primary" onClick={() => setModal({ kind: 'task-new' })}>+ Tarefa</button>
          )}
          <div className="gm-zoom">
            {(['month','week','day'] as ZoomLevel[]).map(z => (
              <button key={z}
                className={`gm-zoom__btn${zoom === z ? ' gm-zoom__btn--on' : ''}`}
                onClick={() => setZoom(z)}>
                {z === 'month' ? 'Mês' : z === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>
          <button className="gm-btn gm-btn--ghost" onClick={scrollToToday}>Hoje</button>
        </div>
      </div>

      {/* ── Body ── */}
      {!activeProject ? (
        <div className="gm-empty">
          <div className="gm-empty__icon">📋</div>
          <p className="gm-empty__text">Selecione ou crie um projeto para começar</p>
          <button className="gm-btn gm-btn--primary" onClick={() => setModal({ kind: 'proj-new' })}>Criar projeto</button>
        </div>
      ) : (
        <div className="gm-body">

          {/* Left sidebar — task labels */}
          <div className="gm-sb" style={{ width: SIDEBAR_W }}>
            <div className="gm-sb__head" style={{ height: HDR_H }}>
              <span>Tarefas</span>
              <span className="gm-sb__count">{total}</span>
            </div>
            <div ref={leftRef} className="gm-sb__list">
              {projectTasks.map(task => (
                <div
                  key={task.id}
                  className={`gm-sb__row${openTask?.id === task.id ? ' gm-sb__row--active' : ''}`}
                  style={{ height: ROW_H }}
                >
                  <div className="gm-sb__dot" style={{ background: activeProject.color, opacity: 0.3 + task.progress / 143 }} />
                  <div className="gm-sb__info">
                    <span className="gm-sb__name" title={task.name}>{task.name}</span>
                    <span className="gm-sb__dates">
                      {toDate(task.start).getDate()}/{toDate(task.start).getMonth()+1} →{' '}
                      {toDate(task.end).getDate()}/{toDate(task.end).getMonth()+1}
                    </span>
                  </div>
                  <div className="gm-sb__actions">
                    {/* ✎ edit conditions */}
                    <button
                      className="gm-icon-btn"
                      title="Editar tarefa"
                      onClick={e => { e.stopPropagation(); setModal({ kind: 'task-edit', task }) }}
                    >✎</button>
                    {/* ✕ delete */}
                    <button
                      className="gm-icon-btn gm-icon-btn--danger"
                      title="Excluir tarefa"
                      onClick={e => { e.stopPropagation(); setModal({ kind: 'del-task', id: task.id }) }}
                    >✕</button>
                  </div>
                </div>
              ))}
              {total === 0 && <div className="gm-sb__empty">Adicione uma tarefa →</div>}
            </div>
          </div>

          {/* Chart */}
          <div ref={rightRef} className="gm-right" onScroll={syncScroll}>
            <div style={{ minWidth: chartWidth, width: chartWidth }}>

              {/* Timeline header */}
              <div className="gm-tl" style={{ minWidth: chartWidth }}>
                <div className="gm-tl__top" style={{ height: HDR_TOP }}>
                  {topCells.map((c, i) => (
                    <div key={i} className="gm-tl__cell" style={{ left: c.left, width: c.width }}>{c.label}</div>
                  ))}
                </div>
                <div className="gm-tl__sub" style={{ height: HDR_SUB }}>
                  {subCells.map((c, i) => (
                    <div key={i}
                      className={['gm-tl__subcell', c.isWeekend ? 'gm-tl__subcell--we' : '', c.isToday ? 'gm-tl__subcell--today' : ''].join(' ')}
                      style={{ left: c.left, width: c.width }}
                    >{c.label}</div>
                  ))}
                </div>
              </div>

              {/* Canvas */}
              <div className="gm-canvas" style={{ height: canvasH, minWidth: chartWidth }}>
                {subCells.filter(c => c.isWeekend).map((c, i) => (
                  <div key={i} className="gm-we-col" style={{ left: c.left, width: c.width, height: canvasH }} />
                ))}
                {todayLeft >= 0 && todayLeft <= chartWidth && (
                  <div className="gm-today-line" style={{ left: todayLeft, height: canvasH }} />
                )}
                {projectTasks.map((_, idx) => (
                  <div key={idx}
                    className={`gm-row-stripe${idx % 2 === 1 ? ' gm-row-stripe--alt' : ''}`}
                    style={{ top: idx * ROW_H, height: ROW_H, width: chartWidth }}
                  />
                ))}

                {/* Task bars — click opens note panel */}
                {projectTasks.map((task, idx) => {
                  const left = Math.max(0, diffDays(chartStart, task.start)) * pxPerDay
                  const right = Math.min(chartWidth, (diffDays(chartStart, task.end) + 1) * pxPerDay)
                  const barW  = Math.max(pxPerDay * 0.5, right - left)
                  const top   = idx * ROW_H + Math.round((ROW_H - BAR_H) / 2)
                  const isOpen = openTask?.id === task.id

                  return (
                    <div
                      key={task.id}
                      className={`gm-bar${isOpen ? ' gm-bar--open' : ''}`}
                      style={{
                        left, top, width: barW, height: BAR_H,
                        background: activeProject.color + '28',
                        border: `1.5px solid ${isOpen ? activeProject.color : activeProject.color + '60'}`,
                        boxShadow: isOpen ? `0 0 0 2px ${activeProject.color}40` : undefined,
                      }}
                      onClick={() => handleOpenNote(task)}
                      title={`${task.name} — clique para abrir a nota`}
                    >
                      <div className="gm-bar__fill"
                        style={{ width: `${task.progress}%`, background: activeProject.color }} />
                      {barW > 72 && <span className="gm-bar__label">{task.name}</span>}
                      {task.progress === 100 && <span className="gm-bar__done">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Note panel */}
          {openingNote && (
            <div className="gm-note-panel gm-note-panel--loading" style={{ width: NOTE_W }}>
              <div className="gm-note-panel__spinner">Criando nota…</div>
            </div>
          )}
          {openTask && !openingNote && (
            <NotePanel task={openTask} onClose={() => setOpenTask(null)} />
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {modal?.kind === 'proj-new' && (
        <ProjectModal onClose={() => setModal(null)}
          onSave={(name, color) => { addProject(name, color); setModal(null) }} />
      )}
      {modal?.kind === 'proj-edit' && (
        <ProjectModal initial={modal.proj} onClose={() => setModal(null)}
          onSave={(name, color) => { updateProject(modal.proj.id, { name, color }); setModal(null) }} />
      )}
      {modal?.kind === 'task-new' && activeProject && (
        <TaskModal onClose={() => setModal(null)}
          onSave={t => {
            setModal(null)
            addTask({ ...t, projectId: activeProject.id })  // async, fire-and-forget
          }} />
      )}
      {modal?.kind === 'task-edit' && (
        <TaskModal initial={modal.task} onClose={() => setModal(null)}
          onSave={t => { updateTask(modal.task.id, t); setModal(null) }} />
      )}
      {modal?.kind === 'del-proj' && (
        <ConfirmModal message="Excluir projeto e todas as suas tarefas e notas?"
          onConfirm={() => { deleteProject(modal.id); setOpenTask(null) }}
          onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'del-task' && (
        <ConfirmModal message="Excluir esta tarefa e a nota vinculada?"
          onConfirm={() => {
            if (openTask?.id === modal.id) setOpenTask(null)
            deleteTask(modal.id)
          }}
          onClose={() => setModal(null)} />
      )}
    </div>
  )
}
