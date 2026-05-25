import { useState, useEffect, useCallback } from 'react'
import { TUTORIAL_STEPS } from './TutorialData'
import { useTutorialStore } from '../../store/tutorial'

/* ── Progress dots ─────────────────────────────────────────────── */
function Dots({ total, current, onClick }: { total: number; current: number; onClick: (i: number) => void }) {
  return (
    <div className="tut-dots">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          className={`tut-dot ${i === current ? 'tut-dot--active' : i < current ? 'tut-dot--done' : ''}`}
          onClick={() => onClick(i)}
          aria-label={`Ir para passo ${i + 1}`}
        />
      ))}
    </div>
  )
}

/* ── Icon hero ─────────────────────────────────────────────────── */
function StepHero({ icon, color, animate }: { icon: string; color: string; animate: boolean }) {
  return (
    <div className="tut-hero" style={{ '--tut-color': color } as React.CSSProperties}>
      <div className="tut-hero__ring tut-hero__ring--outer" />
      <div className="tut-hero__ring tut-hero__ring--inner" />
      <span className={`tut-hero__icon ${animate ? 'tut-hero__icon--pop' : ''}`}>
        {icon}
      </span>
    </div>
  )
}

/* ── Main overlay ──────────────────────────────────────────────── */
export function TutorialOverlay() {
  const { isOpen, startStep, markOnboardingDone } = useTutorialStore()

  const [current,   setCurrent]   = useState(startStep)
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd')
  const [animKey,   setAnimKey]   = useState(0)
  const [iconAnim,  setIconAnim]  = useState(true)

  const total = TUTORIAL_STEPS.length
  const step  = TUTORIAL_STEPS[current]
  const isLast   = current === total - 1
  const isFirst  = current === 0

  // Sync startStep when it changes (re-watch from settings)
  useEffect(() => {
    if (isOpen) {
      setCurrent(startStep)
      setAnimKey(k => k + 1)
      setIconAnim(true)
    }
  }, [isOpen, startStep])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') goNext()
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'Escape')     handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, current])

  const navigate = useCallback((nextIdx: number, dir: 'fwd' | 'back') => {
    setDirection(dir)
    setAnimKey(k => k + 1)
    setIconAnim(true)
    setCurrent(nextIdx)
    const t = setTimeout(() => setIconAnim(false), 700)
    return () => clearTimeout(t)
  }, [])

  const goNext = useCallback(() => {
    if (current < total - 1) navigate(current + 1, 'fwd')
    else handleDone()
  }, [current, total])

  const goPrev = useCallback(() => {
    if (current > 0) navigate(current - 1, 'back')
  }, [current])

  const jumpTo = useCallback((idx: number) => {
    navigate(idx, idx > current ? 'fwd' : 'back')
  }, [current])

  const handleClose = () => {
    markOnboardingDone()
  }

  const handleDone = () => {
    markOnboardingDone()
  }

  if (!isOpen) return null

  const enterClass = direction === 'fwd' ? 'tut-card--enter-right' : 'tut-card--enter-left'

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" aria-label="Tutorial do Excursus">

      {/* Backdrop — click to close */}
      <div className="tut-backdrop" onClick={handleClose} />

      {/* Card */}
      <div
        className={`tut-card ${enterClass}`}
        key={animKey}
      >
        {/* Skip / close */}
        <button className="tut-skip" onClick={handleClose} aria-label="Fechar tutorial">
          {isLast ? '' : 'Pular'} ✕
        </button>

        {/* Step counter */}
        <div className="tut-counter">
          {current + 1} / {total}
        </div>

        {/* Hero */}
        <StepHero icon={step.icon} color={step.iconColor} animate={iconAnim} />

        {/* Content */}
        <div className="tut-content">
          <p className="tut-subtitle" style={{ color: step.iconColor }}>{step.subtitle}</p>
          <h2 className="tut-title">{step.title}</h2>
          <p className="tut-desc">{step.desc}</p>

          {step.tips.length > 0 && (
            <ul className="tut-tips">
              {step.tips.map((tip, i) => (
                <li key={i} className="tut-tip">
                  <span className="tut-tip__icon">{tip.icon}</span>
                  <span
                    className="tut-tip__text"
                    dangerouslySetInnerHTML={{
                      __html: tip.text
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Navigation */}
        <div className="tut-nav">
          <button
            className="tut-nav__btn tut-nav__btn--prev"
            onClick={goPrev}
            disabled={isFirst}
            aria-label="Passo anterior"
          >
            ← Anterior
          </button>

          <Dots total={total} current={current} onClick={jumpTo} />

          <button
            className="tut-nav__btn tut-nav__btn--next"
            onClick={goNext}
            aria-label={isLast ? 'Concluir tutorial' : 'Próximo passo'}
          >
            {isLast ? 'Começar ✓' : 'Próximo →'}
          </button>
        </div>
      </div>
    </div>
  )
}
