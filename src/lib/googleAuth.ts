/**
 * googleAuth.ts — Google Calendar OAuth helpers
 *
 * Security model (3 fixes applied):
 *   Fix 1 – client_secret never lives in the browser; all token operations
 *            are proxied through the Supabase Edge Function "google-oauth".
 *   Fix 2 – state parameter included in every OAuth request; validated on
 *            return to prevent CSRF attacks.
 *   Fix 3 – refresh_token is stored server-side only (DB via Edge Function).
 *            The browser keeps only a short-lived access_token in module memory
 *            (wiped on page unload) and a boolean `gcal_connected` flag in
 *            localStorage so the UI can show the connected state after reload.
 */

import { supabase } from './supabase'

/* ── module-level in-memory token cache (Fix 3: never persisted) ─── */
let _accessToken: string | null = null
let _expiresAt = 0

const CONNECTED_KEY   = 'gcal_connected'
const STATE_KEY       = 'google_oauth_state'
const SCOPES          = 'https://www.googleapis.com/auth/calendar'
const POPUP_MSG_TYPE  = 'google-oauth-code'

/* ── environment detection ─────────────────────────────────────────── */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/* ── connection state (Fix 3: only a boolean flag in localStorage) ── */
export function isConnected(): boolean {
  return localStorage.getItem(CONNECTED_KEY) === 'true'
}

function setConnected(val: boolean): void {
  if (val) localStorage.setItem(CONNECTED_KEY, 'true')
  else localStorage.removeItem(CONNECTED_KEY)
}

function cacheToken(accessToken: string, expiresAt: number): void {
  _accessToken = accessToken
  _expiresAt   = expiresAt
}

/** Clear in-memory token and the localStorage flag (sync, no network). */
export function clearTokens(): void {
  _accessToken = null
  _expiresAt   = 0
  setConnected(false)
}

/* ── Edge Function proxy (Fix 1) ──────────────────────────────────── */
async function callEdgeFn(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado no Supabase')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(JSON.stringify(err))
  }
  return res.json()
}

/* ── Token getter (used by googleCalendar.ts) ─────────────────────── */
export async function getValidAccessToken(): Promise<string> {
  if (!isConnected()) throw new Error('Não conectado ao Google Calendar')

  // Return cached token if it is still valid
  if (_accessToken && Date.now() < _expiresAt) return _accessToken

  // Refresh via Edge Function — refresh_token stays server-side (Fix 1 + Fix 3)
  try {
    const data = await callEdgeFn({ action: 'refresh' })
    if (!data.access_token) throw new Error('Sem access_token na resposta')
    cacheToken(data.access_token as string, data.expires_at as number)
    return _accessToken!
  } catch {
    // Treat any refresh failure as a disconnection so the UI prompts reconnect
    clearTokens()
    throw new Error('Sessão expirada. Reconecte o Google Calendar.')
  }
}

/* ── PKCE helpers ─────────────────────────────────────────────────── */
function generateCodeVerifier(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data   = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/* ── Auth URL builder (Fix 2: state included) ─────────────────────── */
function buildAuthUrl(
  clientId:      string,
  redirectUri:   string,
  codeChallenge: string,
  state:         string,
): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id',             clientId)
  url.searchParams.set('redirect_uri',          redirectUri)
  url.searchParams.set('response_type',         'code')
  url.searchParams.set('scope',                 SCOPES)
  url.searchParams.set('code_challenge',        codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type',           'offline')
  url.searchParams.set('prompt',                'consent')
  url.searchParams.set('state',                 state)   // Fix 2
  return url.toString()
}

/* ── Code exchange via Edge Function (Fix 1: no client_secret in browser) ── */
async function exchangeCode(
  code:         string,
  codeVerifier: string,
  redirectUri:  string,
): Promise<void> {
  const data = await callEdgeFn({
    action:       'exchange',
    code,
    code_verifier: codeVerifier,
    redirect_uri:  redirectUri,
  })
  if (!data.access_token) throw new Error('Falha na troca do código OAuth')
  cacheToken(data.access_token as string, data.expires_at as number)
  setConnected(true)  // only the boolean flag goes to localStorage (Fix 3)
}

/* ── Web flow: popup + postMessage ────────────────────────────────── */
async function connectWeb(): Promise<void> {
  const clientId     = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const redirectUri  = window.location.origin
  const state        = crypto.randomUUID()          // Fix 2
  sessionStorage.setItem(STATE_KEY, state)

  const popup = window.open(
    buildAuthUrl(clientId, redirectUri, codeChallenge, state),
    'google-oauth',
    'width=520,height=640,left=200,top=100',
  )
  if (!popup) throw new Error('Popup bloqueado pelo navegador. Permita popups para este site.')

  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      popup.close()
      sessionStorage.removeItem(STATE_KEY)
      reject(new Error('Timeout de 5 minutos — autenticação não concluída'))
    }, 5 * 60 * 1000)

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== POPUP_MSG_TYPE) return

      // Fix 2: validate state before trusting the code
      const savedState = sessionStorage.getItem(STATE_KEY)
      sessionStorage.removeItem(STATE_KEY)
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)

      if (!savedState || event.data.state !== savedState) {
        reject(new Error('Falha de segurança: estado OAuth inválido'))
        return
      }
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.code as string)
    }

    window.addEventListener('message', onMessage)
  })

  await exchangeCode(code, codeVerifier, redirectUri)
}

/**
 * Call once on app startup (App.tsx useEffect).
 * If this page is the OAuth popup callback it relays the code+state to the
 * opener window and closes itself.
 * Returns true when it handled a callback so the caller can exit early.
 */
export function handleOAuthPopupCallback(): boolean {
  const params = new URLSearchParams(window.location.search)
  const code   = params.get('code')
  const error  = params.get('error')
  const state  = params.get('state')   // Fix 2: forward state to opener

  if ((!code && !error) || !window.opener) return false

  try {
    window.opener.postMessage(
      { type: POPUP_MSG_TYPE, code, error, state },
      window.location.origin,
    )
  } catch {}
  window.close()
  return true
}

/* ── Tauri flow: local TCP server + system browser ─────────────────── */
async function connectTauri(): Promise<void> {
  // Dynamic imports so the bundle doesn't break in web/browser mode
  const { invoke }  = await import('@tauri-apps/api/core')
  const { listen }  = await import('@tauri-apps/api/event')
  const { openUrl } = await import('@tauri-apps/plugin-opener')

  const clientId      = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const codeVerifier  = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state         = crypto.randomUUID()     // Fix 2
  sessionStorage.setItem(STATE_KEY, state)

  const port: number  = await invoke('start_oauth_server')
  const redirectUri   = `http://127.0.0.1:${port}`

  const codePromise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      sessionStorage.removeItem(STATE_KEY)
      reject(new Error('Timeout de 5 minutos — autenticação não concluída'))
    }, 5 * 60 * 1000)

    let unlistenCode:  (() => void) | null = null
    let unlistenError: (() => void) | null = null

    const cleanup = () => {
      clearTimeout(timer)
      unlistenCode?.()
      unlistenError?.()
    }

    // The Rust side now emits JSON {"code":"…","state":"…"} (Fix 2)
    listen<string>('google-oauth-code', event => {
      cleanup()
      try {
        const payload = JSON.parse(event.payload) as { code: string; state: string }
        const savedState = sessionStorage.getItem(STATE_KEY)
        sessionStorage.removeItem(STATE_KEY)
        if (!savedState || payload.state !== savedState) {
          reject(new Error('Falha de segurança: estado OAuth inválido'))
          return
        }
        resolve(payload.code)
      } catch {
        reject(new Error('Payload OAuth inválido recebido do servidor local'))
      }
    }).then(fn => { unlistenCode = fn })

    listen<string>('google-oauth-error', event => {
      cleanup()
      sessionStorage.removeItem(STATE_KEY)
      reject(new Error(`Erro de autenticação: ${event.payload}`))
    }).then(fn => { unlistenError = fn })
  })

  await openUrl(buildAuthUrl(clientId, redirectUri, codeChallenge, state))

  const code = await codePromise
  await exchangeCode(code, codeVerifier, redirectUri)
}

/* ── Public API ────────────────────────────────────────────────────── */

export async function connectGoogleCalendar(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado no arquivo .env.local')
  return isTauri() ? connectTauri() : connectWeb()
}

/**
 * Revoke server-side tokens via Edge Function, then clear local state.
 * Falls back to clearing local state even if the network call fails.
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  try {
    await callEdgeFn({ action: 'disconnect' })
  } catch {
    // best-effort — always clear local state regardless
  } finally {
    clearTokens()
  }
}
