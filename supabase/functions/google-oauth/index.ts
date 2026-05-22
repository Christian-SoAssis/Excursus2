/**
 * google-oauth Edge Function
 *
 * Handles the server-side OAuth token operations so that the Google
 * client_secret and the user's refresh_token never reach the browser.
 *
 * Deploy secrets before deploying this function:
 *   supabase secrets set GOOGLE_CLIENT_ID=<your-client-id>
 *   supabase secrets set GOOGLE_CLIENT_SECRET=<your-client-secret>
 *
 * Actions:
 *   exchange  – exchange auth code for tokens; stores refresh_token in DB
 *   refresh   – use stored refresh_token to obtain a new access_token
 *   disconnect – delete the user's stored tokens
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const supabaseUrl      = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey          = Deno.env.get('SUPABASE_ANON_KEY')!
    const googleClientId   = Deno.env.get('GOOGLE_CLIENT_ID')!
    const googleSecret     = Deno.env.get('GOOGLE_CLIENT_SECRET')!

    // Validate the caller's Supabase JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Invalid or expired token' }, 401)

    // Admin client — bypasses RLS so we can read/write google_tokens
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json()
    const { action } = body

    /* ── exchange: trade auth code for tokens ─────────────────────── */
    if (action === 'exchange') {
      const { code, code_verifier, redirect_uri } = body

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:     googleClientId,
          client_secret: googleSecret,
          code_verifier,
          redirect_uri,
          grant_type:    'authorization_code',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return json({ error: err }, 400)
      }

      const data = await res.json()

      if (!data.refresh_token) {
        return json(
          { error: 'No refresh_token received. Revoke access at myaccount.google.com and try again.' },
          400,
        )
      }

      // Persist refresh_token server-side only — never returned to the client
      await admin.from('google_tokens').upsert(
        { user_id: user.id, refresh_token: data.refresh_token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )

      const expires_at = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000
      // Return only the short-lived access_token to the browser
      return json({ access_token: data.access_token, expires_at })
    }

    /* ── refresh: obtain a new access_token from the stored refresh_token ── */
    if (action === 'refresh') {
      const { data: row, error: dbErr } = await admin
        .from('google_tokens')
        .select('refresh_token')
        .eq('user_id', user.id)
        .single()

      if (dbErr || !row) return json({ error: 'Not connected to Google Calendar' }, 404)

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     googleClientId,
          client_secret: googleSecret,
          refresh_token: row.refresh_token,
          grant_type:    'refresh_token',
        }),
      })

      if (!res.ok) {
        // Token was revoked — clean up so the user is prompted to reconnect
        await admin.from('google_tokens').delete().eq('user_id', user.id)
        return json({ error: 'Google session expired. Please reconnect.' }, 400)
      }

      const data = await res.json()

      // Rotate refresh_token when Google issues a new one
      if (data.refresh_token) {
        await admin.from('google_tokens').update({
          refresh_token: data.refresh_token,
          updated_at:    new Date().toISOString(),
        }).eq('user_id', user.id)
      }

      const expires_at = Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000
      return json({ access_token: data.access_token, expires_at })
    }

    /* ── disconnect: delete stored tokens ─────────────────────────── */
    if (action === 'disconnect') {
      await admin.from('google_tokens').delete().eq('user_id', user.id)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)

  } catch (e) {
    console.error('[google-oauth]', e)
    return json({ error: 'Internal server error' }, 500)
  }
})
