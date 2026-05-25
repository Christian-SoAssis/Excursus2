import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useUIStore, type Accent, type UILanguage } from '../store/ui'
import { useAiStore } from '../store/ai'
import { useAuthStore } from '../store/auth'
import { FONTS, type UIFont } from '../lib/fonts'
import { useTutorialStore } from '../store/tutorial'
import { TUTORIAL_STEPS, REWATCHABLE_STEPS } from './tutorial/TutorialData'

/* ── Accent colours ─────────────────────────────────────────── */
const ACCENTS: { value: Accent; label: string; cssVar: string }[] = [
  { value: 'terracotta', label: 'Terracotta', cssVar: 'var(--accent-terracotta)' },
  { value: 'amber',      label: 'Âmbar',      cssVar: 'var(--accent-amber)'      },
  { value: 'electric',   label: 'Elétrico',   cssVar: 'var(--accent-electric)'   },
  { value: 'emerald',    label: 'Esmeralda',  cssVar: 'var(--accent-emerald)'    },
]

/* ── Language options ────────────────────────────────────────── */
const LANGUAGES: { value: UILanguage | 'en'; label: string; soon?: true }[] = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English',  soon: true },
]

/* ── Font list in display order ──────────────────────────────── */
const FONT_ORDER: UIFont[] = ['inter', 'dm-sans', 'newsreader', 'playfair', 'jetbrains-mono']

/* ── Sub-components ─────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="cfg-section-label">{children}</h3>
}

function Row({ children, stack }: { children: React.ReactNode; stack?: boolean }) {
  return <div className={`cfg-row ${stack ? 'cfg-row--stack' : 'cfg-row--inline'}`}>{children}</div>
}

/* ── Avatar area ─────────────────────────────────────────────── */
function AvatarSection() {
  const { user, updateAvatar } = useAuthStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined
  const initials  = (user?.email ?? '?')[0].toUpperCase()

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await updateAvatar(file)
      toast.success('Foto de perfil atualizada!')
    } catch (err) {
      toast.error(`Erro ao atualizar foto: ${String(err)}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="cfg-account">
      {/* Clickable avatar */}
      <button
        className="cfg-avatar-btn"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Trocar foto de perfil"
        aria-label="Trocar foto de perfil"
      >
        {avatarUrl
          ? <img src={avatarUrl} alt="Avatar" className="cfg-avatar-img" />
          : <span className="cfg-avatar-initials">{initials}</span>
        }
        <span className="cfg-avatar-overlay">
          {uploading ? '…' : '📷'}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <div className="cfg-account-info">
        <span className="cfg-account-email">{user?.email}</span>
        <button
          className="cfg-avatar-change-hint"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Enviando…' : 'Trocar foto de perfil'}
        </button>
      </div>
    </div>
  )
}

/* ── Delete account — two-step ────────────────────────────────── */
function DeleteAccountSection() {
  const { deleteAccount } = useAuthStore()
  const [step, setStep]   = useState<'idle' | 'confirm' | 'deleting'>('idle')

  const handleDelete = async () => {
    setStep('deleting')
    try {
      await deleteAccount()
    } catch (err) {
      toast.error(`Erro ao excluir conta: ${String(err)}`)
      setStep('idle')
    }
  }

  if (step === 'idle') {
    return (
      <button className="cfg-danger-btn" onClick={() => setStep('confirm')}>
        Excluir conta
      </button>
    )
  }

  if (step === 'confirm') {
    return (
      <div className="cfg-delete-confirm">
        <p className="cfg-delete-warn">
          ⚠ Esta ação é permanente e irreversível. Todos os seus dados serão apagados.
        </p>
        <div className="cfg-delete-actions">
          <button className="cfg-delete-cancel" onClick={() => setStep('idle')}>
            Cancelar
          </button>
          <button className="cfg-delete-final" onClick={handleDelete}>
            Sim, excluir permanentemente
          </button>
        </div>
      </div>
    )
  }

  // deleting
  return (
    <div className="cfg-delete-confirm">
      <p className="cfg-delete-warn">Excluindo conta…</p>
    </div>
  )
}

/* ── Tutorial section ────────────────────────────────────────── */
function TutorialSection({ onOpenTutorial }: { onOpenTutorial: (step: number) => void }) {
  const [openGuide, setOpenGuide] = useState<string | null>(null)

  const toggleGuide = (id: string) =>
    setOpenGuide(prev => (prev === id ? null : id))

  return (
    <div className="cfg-tutorial-replay">
      {/* Re-watch full onboarding */}
      <button
        className="cfg-tutorial-full-btn"
        onClick={() => onOpenTutorial(0)}
      >
        <span className="cfg-tutorial-full-btn__icon">▶</span>
        <span className="cfg-tutorial-full-btn__text">
          Rever tutorial completo
          <span className="cfg-tutorial-full-btn__sub">Percorre todos os {TUTORIAL_STEPS.length} passos do onboarding</span>
        </span>
      </button>

      {/* Individual mode entries */}
      {REWATCHABLE_STEPS.map(step => {
        const idx      = TUTORIAL_STEPS.findIndex(s => s.id === step.id)
        const isOpen   = openGuide === step.id
        const hasGuide = step.written.length > 0

        return (
          <div key={step.id} className="cfg-tut-item">
            <div className="cfg-tut-item__header">
              <span className="cfg-tut-item__icon" style={{ color: step.iconColor }}>
                {step.icon}
              </span>
              <span className="cfg-tut-item__name">{step.label}</span>

              <div className="cfg-tut-item__actions">
                {/* Watch animation */}
                <button
                  className="cfg-tut-watch-btn"
                  onClick={() => onOpenTutorial(idx)}
                  title={`Ver animação: ${step.label}`}
                >
                  ▶ Animação
                </button>

                {/* Toggle written guide */}
                {hasGuide && (
                  <button
                    className={`cfg-tut-toggle-btn ${isOpen ? 'cfg-tut-toggle-btn--open' : ''}`}
                    onClick={() => toggleGuide(step.id)}
                    title={isOpen ? 'Fechar guia' : 'Ler guia escrito'}
                  >
                    {isOpen ? '▲' : '▼'}
                  </button>
                )}
              </div>
            </div>

            {/* Written guide — collapsible */}
            {isOpen && hasGuide && (
              <div className="cfg-tut-guide">
                <div className="cfg-tut-guide__label">Guia escrito</div>
                <div className="cfg-tut-guide__paras">
                  {step.written.map((para, i) => (
                    <p key={i} className="cfg-tut-guide__p">{para}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main modal ──────────────────────────────────────────────── */
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    theme, accent, fontScale, uiFont, language, showHandles,
    setTheme, setAccent, setFontScale, setUIFont, setLanguage, setShowHandles,
  } = useUIStore()
  const { apiKey, setApiKey } = useAiStore()
  const { signOut } = useAuthStore()
  const { openTutorial } = useTutorialStore()

  const handleOpenTutorial = (step: number) => {
    onClose()                          // fecha o painel de settings
    setTimeout(() => openTutorial(step), 200)  // abre o tutorial com leve delay
  }

  if (!open) return null

  return (
    <>
      <div className="cfg-overlay" onClick={onClose} />

      <aside className="cfg-panel" role="dialog" aria-label="Configurações">

        {/* ── Header ── */}
        <div className="cfg-header">
          <span className="cfg-title">Configurações</span>
          <button className="cfg-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="cfg-body">

          {/* ══ CONTA ══════════════════════════════════════════ */}
          <section className="cfg-section">
            <SectionLabel>Perfil</SectionLabel>
            <AvatarSection />
          </section>

          <div className="cfg-sep" />

          <section className="cfg-section">
            <SectionLabel>Sessão</SectionLabel>
            <button
              className="cfg-signout"
              onClick={() => { onClose(); signOut() }}
            >
              Sair da conta
            </button>
          </section>

          <div className="cfg-sep" />

          <section className="cfg-section">
            <SectionLabel>Zona de perigo</SectionLabel>
            <DeleteAccountSection />
          </section>

          <div className="cfg-sep" />

          {/* ══ APARÊNCIA ══════════════════════════════════════ */}
          <section className="cfg-section">
            <SectionLabel>Aparência</SectionLabel>

            {/* Theme */}
            <Row>
              <span className="cfg-row-label">Tema</span>
              <div className="cfg-seg">
                <button className={theme === 'dark'  ? 'is-active' : ''} onClick={() => setTheme('dark')}>
                  ◑ Clay
                </button>
                <button className={theme === 'light' ? 'is-active' : ''} onClick={() => setTheme('light')}>
                  ◎ Archive
                </button>
              </div>
            </Row>

            {/* Accent */}
            <Row>
              <span className="cfg-row-label">Cor de acento</span>
              <div className="cfg-accents">
                {ACCENTS.map(a => (
                  <button
                    key={a.value}
                    className={`cfg-accent ${accent === a.value ? 'is-active' : ''}`}
                    style={{ '--cfg-accent-clr': a.cssVar } as React.CSSProperties}
                    title={a.label}
                    onClick={() => setAccent(a.value)}
                    aria-label={a.label}
                  />
                ))}
              </div>
            </Row>

            {/* Font scale */}
            <Row stack>
              <div className="cfg-row-head">
                <span className="cfg-row-label">Escala de fonte</span>
                <span className="cfg-row-value">{fontScale.toFixed(2)}×</span>
              </div>
              <input
                type="range" className="cfg-slider"
                min={0.85} max={1.2} step={0.05}
                value={fontScale}
                onChange={e => setFontScale(Number(e.target.value))}
              />
              <div className="cfg-slider-ticks">
                <span>Pequena</span><span>Padrão</span><span>Grande</span>
              </div>
            </Row>

            {/* Drag handles */}
            <Row>
              <div>
                <div className="cfg-row-label">Drag handles</div>
                <div className="cfg-row-hint">Alças de arrastar nos blocos do editor</div>
              </div>
              <button
                className="cfg-toggle"
                data-on={showHandles ? '1' : '0'}
                onClick={() => setShowHandles(!showHandles)}
                aria-pressed={showHandles}
              ><i /></button>
            </Row>
          </section>

          <div className="cfg-sep" />

          {/* ══ FONTE ══════════════════════════════════════════ */}
          <section className="cfg-section">
            <SectionLabel>Fonte de interface</SectionLabel>
            <div className="cfg-fonts">
              {FONT_ORDER.map(id => {
                const meta    = FONTS[id]
                const active  = uiFont === id
                return (
                  <button
                    key={id}
                    className={`cfg-font-item ${active ? 'is-active' : ''}`}
                    onClick={() => setUIFont(id)}
                  >
                    <div className="cfg-font-item__left">
                      <span className="cfg-font-item__name" style={{ fontFamily: meta.family }}>
                        {meta.label}
                      </span>
                      <span className="cfg-font-item__meta">
                        <span className={`cfg-font-cat cfg-font-cat--${meta.category}`}>
                          {meta.category}
                        </span>
                        <span className="cfg-font-item__sample" style={{ fontFamily: meta.family }}>
                          {meta.sample}
                        </span>
                      </span>
                    </div>
                    <span className={`cfg-radio ${active ? 'is-active' : ''}`} />
                  </button>
                )
              })}
            </div>
          </section>

          <div className="cfg-sep" />

          {/* ══ IDIOMA ═════════════════════════════════════════ */}
          <section className="cfg-section">
            <SectionLabel>Idioma</SectionLabel>
            <div className="cfg-langs">
              {LANGUAGES.map(lang => {
                const active = language === lang.value && !lang.soon
                return (
                  <button
                    key={lang.value}
                    className={`cfg-lang-item ${active ? 'is-active' : ''} ${lang.soon ? 'is-soon' : ''}`}
                    onClick={() => !lang.soon && setLanguage(lang.value as UILanguage)}
                    disabled={!!lang.soon}
                  >
                    <span className="cfg-lang-item__label">{lang.label}</span>
                    {lang.soon
                      ? <span className="cfg-badge cfg-badge--soon">Em breve</span>
                      : active
                        ? <span className="cfg-badge cfg-badge--active">Ativo</span>
                        : null
                    }
                    {!lang.soon && <span className={`cfg-radio ${active ? 'is-active' : ''}`} />}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="cfg-sep" />

          {/* ══ TUTORIAL ════════════════════════════════════════ */}
          <section className="cfg-section">
            <SectionLabel>Tutorial & Ajuda</SectionLabel>
            <TutorialSection onOpenTutorial={handleOpenTutorial} />
          </section>

          <div className="cfg-sep" />

          {/* ══ IA ═════════════════════════════════════════════ */}
          <section className="cfg-section">
            <SectionLabel>Inteligência Artificial</SectionLabel>
            <Row stack>
              <span className="cfg-row-label">Gemini API Key</span>
              <input
                type="password"
                className="cfg-field"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
              />
              <span className="cfg-row-hint">
                Necessária para o assistente no modo AI.
              </span>
            </Row>
          </section>

        </div>
      </aside>
    </>
  )
}
