import { useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { ExcursusWordmark } from '../ExcursusLogo'

// ─── Password rules (mesmas do LoginPage) ─────────────────────────────────────
const RULES = [
  { id: 'len',   label: 'Pelo menos 6 caracteres',   test: (p: string) => p.length >= 6 },
  { id: 'upper', label: 'Uma letra maiúscula (A–Z)',  test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'Uma letra minúscula (a–z)',  test: (p: string) => /[a-z]/.test(p) },
  { id: 'sym',   label: 'Um símbolo especial (!@#…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function passwordValid(p: string) {
  return RULES.every(r => r.test(p))
}

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

function PasswordInput({
  value, onChange, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
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
        required
        autoComplete="new-password"
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
export function ResetPasswordPage() {
  const { updatePassword } = useAuthStore()

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)
  const [busy,      setBusy]      = useState(false)
  const [pwTouched, setPwTouched] = useState(false)

  const pwOk      = passwordValid(password)
  const matchOk   = password === confirm
  const canSubmit = pwOk && matchOk && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwOk) { setError('A senha não cumpre todos os requisitos.'); return }
    if (!matchOk) { setError('As senhas não coincidem.'); return }

    setBusy(true)
    setError(null)

    const err = await updatePassword(password)
    if (err) {
      setError(err)
      setBusy(false)
    } else {
      setSuccess(true)
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <ExcursusWordmark width={280} className="auth-wordmark" />
        </div>
        <p className="auth-tagline">notas, hábitos e pensamentos — tudo junto</p>

        {success ? (
          /* ── Sucesso ── */
          <div className="auth-reset-success">
            <div className="auth-reset-success__icon">✓</div>
            <p className="auth-reset-success__title">Senha atualizada!</p>
            <p className="auth-reset-success__sub">
              Sua senha foi alterada com sucesso. Você já está conectado.
            </p>
          </div>
        ) : (
          /* ── Formulário ── */
          <>
            <div className="auth-forgot-head">
              <span className="auth-forgot-title">Criar nova senha</span>
            </div>

            <form className="auth-form" onSubmit={submit}>
              {/* Nova senha */}
              <div className="auth-field">
                <label className="auth-label">Nova senha</label>
                <PasswordInput
                  value={password}
                  onChange={v => { setPassword(v); if (!pwTouched && v.length > 0) setPwTouched(true) }}
                  placeholder="Mín. 6 chars, maiúsc., símbolo"
                />
                <PasswordRules password={password} visible={pwTouched} />
              </div>

              {/* Confirmar senha */}
              <div className="auth-field">
                <label className="auth-label">Confirmar senha</label>
                <PasswordInput
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Repita a nova senha"
                />
                {confirm.length > 0 && !matchOk && (
                  <p className="auth-reset-mismatch">As senhas não coincidem.</p>
                )}
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button
                className="auth-submit"
                type="submit"
                disabled={!canSubmit}
              >
                {busy ? '…' : 'Salvar nova senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
