import { useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { useNotesStore } from '../../store/notes'
import { ExcursusWordmark } from '../ExcursusLogo'

type Tab = 'login' | 'register' | 'forgot'

// ─── Password rules ───────────────────────────────────────────────────────────
const RULES = [
  { id: 'len',   label: 'Pelo menos 6 caracteres',  test: (p: string) => p.length >= 6 },
  { id: 'upper', label: 'Uma letra maiúscula (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Uma letra minúscula (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { id: 'sym',   label: 'Um símbolo especial (!@#…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function passwordValid(p: string) {
  return RULES.every(r => r.test(p))
}

// ─── Password strength indicator ─────────────────────────────────────────────
function PasswordRules({ password, visible }: { password: string; visible: boolean }) {
  if (!visible) return null
  return (
    <ul className="auth-rules">
      {RULES.map(rule => {
        const ok = rule.test(password)
        return (
          <li key={rule.id} className={`auth-rule${ok ? ' auth-rule--ok' : ''}`}>
            <span className="auth-rule__icon">{ok ? '✓' : '○'}</span>
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}

// ─── Password input with show/hide ───────────────────────────────────────────
function PasswordInput({
  value, onChange, placeholder, minLength, required,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minLength?: number
  required?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="auth-pw-wrap">
      <input
        className="auth-input auth-input--pw"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="auth-pw-toggle"
        onClick={() => setShow(s => !s)}
        tabIndex={-1}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {show ? '🙈' : '👁'}
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuthStore()
  const loadNotes = useNotesStore(s => s.loadNotes)

  const [tab,      setTab]      = useState<Tab>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [info,     setInfo]     = useState<string | null>(null)
  const [busy,     setBusy]     = useState(false)
  // show rules only after the user starts typing in register tab
  const [pwTouched, setPwTouched] = useState(false)

  const switchTab = (t: Tab) => {
    setTab(t)
    setError(null)
    setInfo(null)
    setPwTouched(false)
  }

  const isRegister = tab === 'register'
  const pwOk       = !isRegister || passwordValid(password)

  /* ── Submit ── */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Extra client-side guard for register
    if (isRegister && !passwordValid(password)) {
      setError('A senha não cumpre todos os requisitos.')
      return
    }

    setBusy(true)
    setError(null)
    setInfo(null)

    if (tab === 'login') {
      const err = await signIn(email, password)
      if (err) { setError(err); setBusy(false); return }
      await loadNotes()

    } else if (tab === 'register') {
      const result = await signUp(email, password)
      if (result === 'check_email') {
        setInfo('Verifique sua caixa de entrada e clique no link de confirmação.')
        setBusy(false)
        return
      }
      if (result) { setError(result); setBusy(false); return }
      await loadNotes()

    } else {
      // forgot password
      const err = await resetPassword(email)
      if (err) {
        setError(err)
      } else {
        setInfo(`Link enviado para ${email}. Verifique sua caixa de entrada.`)
      }
    }

    setBusy(false)
  }

  /* ── Forgot password view ── */
  if (tab === 'forgot') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <ExcursusWordmark width={280} className="auth-wordmark" />
          </div>
          <p className="auth-tagline">notas, hábitos e pensamentos — tudo junto</p>

          <div className="auth-forgot-head">
            <button className="auth-back" onClick={() => switchTab('login')}>← Voltar</button>
            <span className="auth-forgot-title">Recuperar senha</span>
          </div>

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <label className="auth-label">E-mail</label>
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                required
                autoFocus
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {info  && <div className="auth-info">{info}</div>}

            {!info ? (
              <button className="auth-submit" type="submit" disabled={busy}>
                {busy ? '…' : 'Enviar link de recuperação'}
              </button>
            ) : (
              <button className="auth-submit auth-submit--ghost" type="button"
                onClick={() => switchTab('login')}>
                Voltar para o login
              </button>
            )}
          </form>
        </div>
      </div>
    )
  }

  /* ── Login / Register view ── */
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <ExcursusWordmark width={280} className="auth-wordmark" />
        </div>
        <p className="auth-tagline">notas, hábitos e pensamentos — tudo junto</p>

        {/* Tab selector */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' auth-tab--active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Entrar
          </button>
          <button
            className={`auth-tab${tab === 'register' ? ' auth-tab--active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Criar conta
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {/* E-mail */}
          <div className="auth-field">
            <label className="auth-label">E-mail</label>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              required
              autoFocus
            />
          </div>

          {/* Senha */}
          <div className="auth-field">
            <div className="auth-label-row">
              <label className="auth-label">Senha</label>
              {tab === 'login' && (
                <button type="button" className="auth-forgot-link" onClick={() => switchTab('forgot')}>
                  Esqueceu a senha?
                </button>
              )}
            </div>

            <PasswordInput
              value={password}
              onChange={v => { setPassword(v); if (!pwTouched && v.length > 0) setPwTouched(true) }}
              placeholder={isRegister ? 'Mín. 6 chars, maiúsc., símbolo' : 'sua senha'}
              minLength={isRegister ? 6 : undefined}
              required
            />

            {/* Live requirements — only on register, after first keystroke */}
            <PasswordRules password={password} visible={isRegister && pwTouched} />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {info  && <div className="auth-info">{info}</div>}

          <button
            className="auth-submit"
            type="submit"
            disabled={busy || (isRegister && !pwOk)}
          >
            {busy ? '…' : tab === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}
