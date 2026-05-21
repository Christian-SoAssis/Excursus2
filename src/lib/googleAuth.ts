const STORAGE_KEY = 'google_tokens'
const SCOPES = 'https://www.googleapis.com/auth/calendar'
const POPUP_MESSAGE_TYPE = 'google-oauth-code'

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  expires_at: number
}

/** True when running inside a Tauri desktop window. */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function getTokens(): GoogleTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as GoogleTokens) : null
  } catch {
    return null
  }
}

export function saveTokens(tokens: GoogleTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function isConnected(): boolean {
  return !!getTokens()
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = getTokens()
  if (!tokens) throw new Error('Não conectado ao Google Calendar')
  if (Date.now() < tokens.expires_at) return tokens.access_token

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) {
    clearTokens()
    throw new Error('Sessão expirada. Reconecte o Google Calendar.')
  }
  const data = await res.json()
  const updated: GoogleTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
  }
  saveTokens(updated)
  return updated.access_token
}

function generateCodeVerifier(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function buildAuthUrl(clientId: string, redirectUri: string, codeChallenge: string): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  return url.toString()
}

async function exchangeCode(
  code: string,
  clientId: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<void> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Falha ao trocar código por token: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  if (!data.refresh_token) {
    throw new Error(
      'Refresh token não recebido. Revogue o acesso em myaccount.google.com e tente novamente.',
    )
  }
  saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
  })
}

/* ─── Web flow (popup + postMessage) ─────────────────────────── */

async function connectWeb(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const redirectUri = window.location.origin

  const popup = window.open(
    buildAuthUrl(clientId, redirectUri, codeChallenge),
    'google-oauth',
    'width=520,height=640,left=200,top=100',
  )
  if (!popup) throw new Error('Popup bloqueado pelo navegador. Permita popups para este site.')

  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      popup.close()
      reject(new Error('Timeout de 5 minutos — autenticação não concluída'))
    }, 5 * 60 * 1000)

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== POPUP_MESSAGE_TYPE) return
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.code as string)
    }

    window.addEventListener('message', onMessage)
  })

  await exchangeCode(code, clientId, codeVerifier, redirectUri)
}

/**
 * Call this once on app startup (e.g. in App.tsx useEffect).
 * If the current page is an OAuth popup callback it posts the code
 * to the opener and closes itself.
 * Returns true when it handled a callback so the caller can bail out early.
 */
export function handleOAuthPopupCallback(): boolean {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const error = params.get('error')

  if ((!code && !error) || !window.opener) return false

  try {
    window.opener.postMessage(
      { type: POPUP_MESSAGE_TYPE, code, error },
      window.location.origin,
    )
  } catch {}
  window.close()
  return true
}

/* ─── Tauri flow (local TCP server + system browser) ─────────── */

async function connectTauri(): Promise<void> {
  // Dynamic imports so the bundle doesn't break in web mode
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const { openUrl } = await import('@tauri-apps/plugin-opener')

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const port: number = await invoke('start_oauth_server')
  const redirectUri = `http://127.0.0.1:${port}`

  const codePromise = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timeout de 5 minutos — autenticação não concluída')),
      5 * 60 * 1000,
    )
    let unlistenCode: (() => void) | null = null
    let unlistenError: (() => void) | null = null

    const cleanup = () => {
      clearTimeout(timer)
      unlistenCode?.()
      unlistenError?.()
    }

    listen<string>('google-oauth-code', event => {
      cleanup(); resolve(event.payload)
    }).then(fn => { unlistenCode = fn })

    listen<string>('google-oauth-error', event => {
      cleanup(); reject(new Error(`Erro de autenticação: ${event.payload}`))
    }).then(fn => { unlistenError = fn })
  })

  await openUrl(buildAuthUrl(clientId, redirectUri, codeChallenge))

  const code = await codePromise
  await exchangeCode(code, clientId, codeVerifier, redirectUri)
}

/* ─── Public entry point ──────────────────────────────────────── */

export async function connectGoogleCalendar(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID não configurado no arquivo .env.local')

  if (isTauri()) {
    return connectTauri()
  } else {
    return connectWeb()
  }
}
