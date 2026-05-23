import { useState, useEffect, useRef } from 'react'
import { ExcursusLogo } from './ExcursusLogo'
import { LoginPage } from './auth/LoginPage'

/* ── Auth modal ──────────────────────────────────────────────────── */
function AuthModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="land-auth-overlay" onClick={onClose}>
      <div className="land-auth-wrap" onClick={e => e.stopPropagation()}>
        <LoginPage />
      </div>
    </div>
  )
}

/* ── Animated pulse hero ─────────────────────────────────────────── */
function HeroPulse() {
  return (
    <svg
      className="land-hero__pulse"
      viewBox="0 0 800 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="land-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0"   stopColor="#ff9d77" stopOpacity="0" />
          <stop offset="0.3" stopColor="#ff9d77" />
          <stop offset="0.6" stopColor="#f0bd8b" />
          <stop offset="0.85" stopColor="#c4b6ff" />
          <stop offset="1"   stopColor="#c4b6ff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="land-wire" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0"   stopColor="#cec5c1" stopOpacity="0" />
          <stop offset="0.2" stopColor="#cec5c1" stopOpacity="0.4" />
          <stop offset="0.8" stopColor="#cec5c1" stopOpacity="0.4" />
          <stop offset="1"   stopColor="#cec5c1" stopOpacity="0" />
        </linearGradient>
        <filter id="land-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* baseline wire */}
      <line x1="0" y1="100" x2="800" y2="100"
        stroke="url(#land-wire)" strokeWidth="1.2" strokeLinecap="round" />
      {/* main pulse */}
      <path
        className="land-hero__path"
        d="M280 100 C340 100 330 24 400 24 C470 24 460 100 520 100"
        fill="none"
        stroke="url(#land-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#land-glow)"
      />
      {/* secondary micro pulses */}
      <path
        className="land-hero__path land-hero__path--slow"
        d="M80 100 C105 100 100 76 116 76 C132 76 127 100 152 100"
        fill="none"
        stroke="#ff9d77"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.4"
      />
      <path
        className="land-hero__path land-hero__path--slower"
        d="M620 100 C645 100 640 68 660 68 C680 68 675 100 700 100"
        fill="none"
        stroke="#c4b6ff"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  )
}

/* ── Feature card ────────────────────────────────────────────────── */
interface Feature {
  icon:  string
  label: string
  desc:  string
  color: string
}

const FEATURES: Feature[] = [
  {
    icon:  '◈',
    label: 'Hoje',
    desc:  'Comece cada dia com intenção. Acompanhe hábitos, tarefas e reflexões em um diário diário fluido.',
    color: '#ff9d77',
  },
  {
    icon:  '◷',
    label: 'Calendário',
    desc:  'Conecte suas notas ao Google Calendar e veja compromissos e pensamentos no mesmo lugar.',
    color: '#f0bd8b',
  },
  {
    icon:  '◰',
    label: 'Floating',
    desc:  'Janelas de notas livres. Arraste, redimensione e organize como quiser na tela.',
    color: '#c4b6ff',
  },
  {
    icon:  '⊹',
    label: 'Spatial',
    desc:  'Um canvas infinito para mapear ideias no espaço e criar relações visuais entre conceitos.',
    color: '#7dd3a3',
  },
  {
    icon:  '◎',
    label: 'Graph',
    desc:  'Visualize as conexões entre suas notas como uma rede de pensamentos interligados.',
    color: '#c4b6ff',
  },
  {
    icon:  '✦',
    label: 'AI',
    desc:  'Converse com suas notas. A IA entende o contexto do que você escreveu e ajuda a expandir ideias.',
    color: '#ff9d77',
  },
  {
    icon:  '◌',
    label: 'Zen',
    desc:  'Modo de escrita imersiva. Sem distrações, só você e o texto.',
    color: '#f0bd8b',
  },
]

/* ── Step card ───────────────────────────────────────────────────── */
const STEPS = [
  {
    n:     '01',
    title: 'Escreva',
    desc:  'Notas em formato rico — markdown, links internos, matemática, listas de tarefas e muito mais. O editor nunca fica no caminho.',
  },
  {
    n:     '02',
    title: 'Conecte',
    desc:  'Crie backlinks entre notas, vincule a eventos do calendário e rastreie hábitos. Tudo no mesmo espaço, sem exportar nada.',
  },
  {
    n:     '03',
    title: 'Explore',
    desc:  'Descubra padrões nas suas ideias com o modo Graph, navegue pelo espaço no Spatial ou peça à IA para sintetizar e expandir.',
  },
]

/* ── Main component ──────────────────────────────────────────────── */
export function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const featRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* intersection observer for entrance animations */
  useEffect(() => {
    const els = document.querySelectorAll('.land-reveal')
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('land-reveal--in') }),
      { threshold: 0.12 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <div className="land">

        {/* ── Navbar ── */}
        <nav className={`land-nav ${scrolled ? 'land-nav--scrolled' : ''}`}>
          <div className="land-nav__inner">
            <div className="land-nav__brand">
              <ExcursusLogo size={26} bg />
              <span className="land-nav__name">Excursus</span>
              <span className="land-nav__em">· 2</span>
            </div>
            <div className="land-nav__links">
              <a href="#features" className="land-nav__link">Funcionalidades</a>
              <a href="#about"    className="land-nav__link">Sobre</a>
              <a href="#como"     className="land-nav__link">Como funciona</a>
            </div>
            <button className="land-nav__cta" onClick={() => setAuthOpen(true)}>
              Entrar
            </button>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="land-hero">
          <div className="land-hero__bg" aria-hidden="true">
            <div className="land-hero__blob land-hero__blob--a" />
            <div className="land-hero__blob land-hero__blob--b" />
            <div className="land-hero__blob land-hero__blob--c" />
          </div>

          <div className="land-hero__content">
            <div className="land-hero__badge">
              <span className="land-hero__badge-dot" />
              Versão beta · acesso antecipado
            </div>

            <h1 className="land-hero__h1">
              Pense.<br />
              <span className="land-hero__h1-accent">Registre.</span><br />
              Conecte.
            </h1>

            <p className="land-hero__sub">
              Um espaço onde notas, hábitos e pensamentos coexistem —
              sem fragmentar o que é naturalmente contínuo.
            </p>

            <div className="land-hero__actions">
              <button className="land-btn land-btn--primary" onClick={() => setAuthOpen(true)}>
                Começar agora
                <span className="land-btn__arrow">→</span>
              </button>
              <button
                className="land-btn land-btn--ghost"
                onClick={() => featRef.current?.scrollIntoView({ behavior: 'smooth' })}
              >
                Ver funcionalidades
              </button>
            </div>

            <p className="land-hero__free">Gratuito durante o beta · sem cartão de crédito</p>
          </div>

          <div className="land-hero__visual" aria-hidden="true">
            <HeroPulse />
            <div className="land-hero__card land-hero__card--a">
              <span className="land-hero__card-icon">◈</span>
              <span>Revisão semanal</span>
              <span className="land-hero__card-check">✓</span>
            </div>
            <div className="land-hero__card land-hero__card--b">
              <span className="land-hero__card-icon" style={{ color: '#c4b6ff' }}>✦</span>
              <span>Resuma esta nota com IA</span>
            </div>
            <div className="land-hero__card land-hero__card--c">
              <span className="land-hero__card-dot" />
              <span>12 notas conectadas</span>
            </div>
          </div>
        </section>

        {/* ── Marquee strip ── */}
        <div className="land-strip" aria-hidden="true">
          <div className="land-strip__track">
            {['Notas Ricas', 'Hábitos', 'Graph View', 'Modo Zen', 'IA Integrada', 'Canvas Espacial', 'Calendário', 'Backlinks', 'Modo Floating',
              'Notas Ricas', 'Hábitos', 'Graph View', 'Modo Zen', 'IA Integrada', 'Canvas Espacial', 'Calendário', 'Backlinks', 'Modo Floating'].map((t, i) => (
              <span key={i} className="land-strip__item">
                {t} <span className="land-strip__sep">◆</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Features ── */}
        <section className="land-section" id="features" ref={featRef as any}>
          <div className="land-container">
            <div className="land-label land-reveal">Funcionalidades</div>
            <h2 className="land-h2 land-reveal">Sete formas de pensar,<br />um único lugar.</h2>
            <p className="land-p land-reveal">
              Cada modo foi desenhado para um estado mental diferente.
              Alterne sem perder o fio da meada.
            </p>

            <div className="land-features">
              {FEATURES.map((f, i) => (
                <div
                  key={f.label}
                  className="land-feat land-reveal"
                  style={{ '--feat-color': f.color, animationDelay: `${i * 60}ms` } as React.CSSProperties}
                >
                  <div className="land-feat__icon">{f.icon}</div>
                  <div className="land-feat__label">{f.label}</div>
                  <p className="land-feat__desc">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── About ── */}
        <section className="land-section land-section--about" id="about">
          <div className="land-container">
            <div className="land-about">
              <div className="land-about__left land-reveal">
                <div className="land-label">O projeto</div>
                <h2 className="land-h2">Nasceu da fragmentação.</h2>
                <p className="land-p">
                  O Excursus surgiu da frustração de usar dezenas de ferramentas separadas —
                  uma para notas, outra para hábitos, outra para tarefas, outra para calendário.
                  O resultado era sempre o mesmo: contexto perdido na troca entre apps.
                </p>
                <p className="land-p">
                  A ideia central é simples: <em>o pensamento é contínuo, as ferramentas não deveriam fragmentá-lo.</em>
                  Uma nota pode virar um hábito. Uma reflexão pode se ligar a um evento.
                  Um conceito solto pode se tornar o centro de uma rede de ideias.
                </p>
                <div className="land-about__tags">
                  <span className="land-tag">Open-minded</span>
                  <span className="land-tag">Sem assinatura*</span>
                  <span className="land-tag">Privacy-first</span>
                  <span className="land-tag">Keyboard-driven</span>
                </div>
              </div>

              <div className="land-about__right land-reveal">
                <div className="land-manifesto">
                  <div className="land-manifesto__line" />
                  <blockquote className="land-manifesto__quote">
                    "Ferramentas deveriam desaparecer.<br />
                    O que deve aparecer é o seu pensamento."
                  </blockquote>
                  <div className="land-manifesto__stats">
                    <div className="land-stat">
                      <span className="land-stat__n">7</span>
                      <span className="land-stat__l">modos de visualização</span>
                    </div>
                    <div className="land-stat">
                      <span className="land-stat__n">∞</span>
                      <span className="land-stat__l">notas e conexões</span>
                    </div>
                    <div className="land-stat">
                      <span className="land-stat__n">1</span>
                      <span className="land-stat__l">lugar para tudo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="land-section" id="como">
          <div className="land-container">
            <div className="land-label land-reveal">Como funciona</div>
            <h2 className="land-h2 land-reveal">Simples de começar,<br />profundo o suficiente para durar.</h2>

            <div className="land-steps">
              {STEPS.map((s, i) => (
                <div key={s.n} className="land-step land-reveal" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="land-step__n">{s.n}</div>
                  <div className="land-step__body">
                    <div className="land-step__title">{s.title}</div>
                    <p className="land-step__desc">{s.desc}</p>
                  </div>
                  {i < STEPS.length - 1 && <div className="land-step__connector" aria-hidden="true" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Editor preview ── */}
        <section className="land-section land-section--editor">
          <div className="land-container">
            <div className="land-editor-preview land-reveal">
              <div className="land-editor-preview__bar">
                <span className="land-editor-preview__dot" style={{ background: '#ff5f57' }} />
                <span className="land-editor-preview__dot" style={{ background: '#ffbd2e' }} />
                <span className="land-editor-preview__dot" style={{ background: '#28c840' }} />
                <span className="land-editor-preview__title">Revisão da semana — 22 mai. 2026</span>
              </div>
              <div className="land-editor-preview__body">
                <div className="land-editor-preview__line">
                  <span className="land-ep__h1"># O que aprendi essa semana</span>
                </div>
                <div className="land-editor-preview__line">
                  <span className="land-ep__muted">→</span>
                  <span> Leitura profunda requer contexto acumulado, não apenas tempo.</span>
                </div>
                <div className="land-editor-preview__line">
                  <span className="land-ep__muted">→</span>
                  <span> Sistemas simples sobrevivem mais do que sistemas perfeitos.</span>
                </div>
                <div className="land-editor-preview__line" style={{ marginTop: 12 }}>
                  <span className="land-ep__h2">## Hábitos</span>
                </div>
                <div className="land-editor-preview__line land-ep__habit">
                  <span className="land-ep__check">✓</span>
                  <span>Escrita diária</span>
                  <span className="land-ep__streak">7 dias seguidos 🔥</span>
                </div>
                <div className="land-editor-preview__line land-ep__habit">
                  <span className="land-ep__check">✓</span>
                  <span>Revisão de notas antigas</span>
                  <span className="land-ep__streak">3 dias</span>
                </div>
                <div className="land-editor-preview__line" style={{ marginTop: 12 }}>
                  <span className="land-ep__tag">[[Leitura profunda]]</span>
                  <span className="land-ep__tag">[[Sistemas]]</span>
                  <span className="land-ep__tag">[[Semana 21]]</span>
                </div>
                <div className="land-editor-preview__cursor" aria-hidden="true" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="land-cta">
          <div className="land-cta__bg" aria-hidden="true">
            <div className="land-cta__blob" />
          </div>
          <div className="land-container land-reveal">
            <ExcursusLogo size={48} bg className="land-cta__logo" />
            <h2 className="land-cta__h2">Pronto para começar?</h2>
            <p className="land-cta__p">
              Crie uma conta gratuita e comece a escrever agora mesmo.
              Sem limite de notas durante o beta.
            </p>
            <div className="land-hero__actions" style={{ justifyContent: 'center' }}>
              <button className="land-btn land-btn--primary land-btn--lg" onClick={() => setAuthOpen(true)}>
                Criar conta gratuita
                <span className="land-btn__arrow">→</span>
              </button>
              <button className="land-btn land-btn--ghost" onClick={() => setAuthOpen(true)}>
                Já tenho conta
              </button>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="land-footer">
          <div className="land-container">
            <div className="land-footer__inner">
              <div className="land-footer__brand">
                <ExcursusLogo size={20} bg />
                <span>Excursus · 2</span>
              </div>
              <p className="land-footer__copy">
                Construído com cuidado. Feito para durar.
              </p>
              <p className="land-footer__copy land-footer__small">
                * Excursus é gratuito durante o período de beta. Funcionalidades premium podem ser introduzidas no futuro.
              </p>
            </div>
          </div>
        </footer>

      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  )
}
