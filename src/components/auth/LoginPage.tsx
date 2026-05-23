import { useState } from 'react'
import { useAuthStore } from '../../store/auth'
import { useNotesStore } from '../../store/notes'
import { ExcursusWordmark } from '../ExcursusLogo'

export function LoginPage() {
  const { signIn, signUp } = useAuthStore()
  const loadNotes = useNotesStore(s => s.loadNotes)

  const [tab, setTab]         = useState<'login' | 'register'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [info, setInfo]       = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)

    if (tab === 'login') {
      const err = await signIn(email, password)
      if (err) { setError(err); setBusy(false); return }
      await loadNotes()
    } else {
      const result = await signUp(email, password)
      if (result === 'check_email') {
        setInfo('Verifique sua caixa de entrada e clique no link de confirmação.')
        setBusy(false)
        return
      }
      if (result) { setError(result); setBusy(false); return }
      await loadNotes()
    }

    setBusy(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <ExcursusWordmark width={280} className="auth-wordmark" />
        </div>
        <p className="auth-tagline">notas, hábitos e pensamentos — tudo junto</p>

        <div className="auth-tabs">
          <button
            className="auth-tab"
            data-active={tab === 'login' || undefined}
            onClick={() => { setTab('login'); setError(null); setInfo(null) }}>
            Entrar
          </button>
          <button
            className="auth-tab"
            data-active={tab === 'register' || undefined}
            onClick={() => { setTab('register'); setError(null); setInfo(null) }}>
            Criar conta
          </button>
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
          <div className="auth-field">
            <label className="auth-label">Senha</label>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              minLength={6}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {info  && <div className="auth-info">{info}</div>}

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? '…' : tab === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}
