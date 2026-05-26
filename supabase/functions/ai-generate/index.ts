/**
 * ai-generate Edge Function
 *
 * Proxy seguro para chamadas de IA. As chaves de API vivem apenas no banco
 * (tabela user_ai_keys com RLS deny-all) e nunca chegam ao browser.
 *
 * Ações:
 *   save     – salva/atualiza chave(s) do usuário no banco
 *   delete   – remove chave(s) do usuário
 *   status   – retorna quais provedores têm chave configurada (sem expor as chaves)
 *   generate – faz a chamada à API de IA usando a chave armazenada
 *
 * Deploy:
 *   supabase functions deploy ai-generate
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/* ── CORS ─────────────────────────────────────────────────────────── */
const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/* ── Env ──────────────────────────────────────────────────────────── */
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

/* ── URL validation (protects against SSRF via customBaseUrl) ─────── */
function validateBaseUrl(url: string): void {
  let parsed: URL
  try { parsed = new URL(url) } catch {
    throw new Error('customBaseUrl inválida — use o formato https://api.exemplo.com/v1')
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('customBaseUrl deve usar HTTPS.')
  }
  // Block internal/private address ranges
  const hostname = parsed.hostname
  const blocked = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^::1$/,
    /^0\.0\.0\.0$/,
    /\.internal$/i,
    /\.local$/i,
  ]
  if (blocked.some(r => r.test(hostname))) {
    throw new Error('customBaseUrl não pode apontar para endereços internos ou localhost.')
  }
}

/* ── AI providers ─────────────────────────────────────────────────── */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const GEMINI_MODEL_MAP: Record<string, string> = {
  'gemini-2.5-flash':      'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash':      'gemini-2.0-flash',
  'gemini-1.5-flash':      'gemini-1.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.0-flash-lite',
}

async function callGemini(
  apiKey:  string,
  model:   string,
  system:  string,
  message: string,
): Promise<string> {
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: message }] }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini: ${(err as Record<string, Record<string, string>>)?.error?.message ?? `HTTP ${res.status}`}`)
  }
  const data = await res.json()
  const text: string = (data as Record<string, Record<string, Record<string, Record<string, string>[]>[]>[]>)
    ?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) throw new Error('Gemini: resposta vazia')
  return text
}

async function callOpenAI(
  apiKey:  string,
  model:   string,
  baseUrl: string,
  system:  string,
  message: string,
): Promise<string> {
  const url = baseUrl.replace(/\/$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system  },
        { role: 'user',   content: message },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI: ${(err as Record<string, Record<string, string>>)?.error?.message ?? `HTTP ${res.status}`}`)
  }
  const data = await res.json()
  const text: string = (data as Record<string, Record<string, Record<string, string>>[]>)
    ?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('OpenAI: resposta vazia')
  return text
}

/* ── Main handler ─────────────────────────────────────────────────── */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verificar JWT do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Invalid or expired token' }, 401)

    // Cliente admin — bypassa RLS para ler/escrever user_ai_keys
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const body = await req.json()
    const { action } = body

    /* ── save: salva chave(s) no banco ────────────────────────── */
    if (action === 'save') {
      const updates: Record<string, string | null> = {
        updated_at: new Date().toISOString(),
      }

      // Inclui apenas os campos enviados (undefined = não alterar)
      if ('geminiKey' in body) updates.gemini_key = body.geminiKey || null
      if ('openaiKey' in body) updates.openai_key  = body.openaiKey  || null
      if ('customKey' in body) updates.custom_key  = body.customKey  || null

      const { error } = await admin
        .from('user_ai_keys')
        .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })

      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    /* ── delete: apaga chave(s) do banco ──────────────────────── */
    if (action === 'delete') {
      const { providers } = body as { providers: ('gemini' | 'openai' | 'custom')[] }
      if (!Array.isArray(providers) || providers.length === 0) {
        return json({ error: 'providers array is required' }, 400)
      }

      const nullFields: Record<string, null> = { updated_at: null }
      if (providers.includes('gemini')) nullFields.gemini_key = null
      if (providers.includes('openai')) nullFields.openai_key  = null
      if (providers.includes('custom')) nullFields.custom_key  = null

      const { error } = await admin
        .from('user_ai_keys')
        .update({ ...nullFields, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (error) throw new Error(error.message)
      return json({ ok: true })
    }

    /* ── status: retorna quais chaves estão configuradas ──────── */
    if (action === 'status') {
      const { data: row } = await admin
        .from('user_ai_keys')
        .select('gemini_key, openai_key, custom_key')
        .eq('user_id', user.id)
        .maybeSingle()

      return json({
        gemini: !!(row?.gemini_key),
        openai: !!(row?.openai_key),
        custom: !!(row?.custom_key),
      })
    }

    /* ── generate: chama a API de IA ─────────────────────────── */
    if (action === 'generate') {
      const {
        selectedModel,
        systemPrompt,
        userMessage,
        openaiModel,
        customBaseUrl,
        customModel,
      } = body as {
        selectedModel: string
        systemPrompt:  string
        userMessage:   string
        openaiModel?:  string
        customBaseUrl?: string
        customModel?:  string
      }

      // Lê as chaves do banco (somente o campo necessário)
      const { data: keys } = await admin
        .from('user_ai_keys')
        .select('gemini_key, openai_key, custom_key')
        .eq('user_id', user.id)
        .maybeSingle()

      let text: string

      if (selectedModel === 'openai') {
        const key = keys?.openai_key
        if (!key) return json({ error: 'Chave OpenAI não configurada. Acesse Configurações → IA.' }, 400)
        text = await callOpenAI(key, openaiModel || 'gpt-4o-mini', 'https://api.openai.com/v1', systemPrompt, userMessage)

      } else if (selectedModel === 'custom') {
        const key = keys?.custom_key
        if (!key) return json({ error: 'Chave do provider customizado não configurada.' }, 400)
        if (!customBaseUrl || !customModel) return json({ error: 'customBaseUrl e customModel são obrigatórios.' }, 400)

        // Valida URL para evitar SSRF server-side
        validateBaseUrl(customBaseUrl)

        text = await callOpenAI(key, customModel, customBaseUrl, systemPrompt, userMessage)

      } else {
        // Modelos Gemini
        const key = keys?.gemini_key
        if (!key) return json({ error: 'Chave do Google AI Studio não configurada. Acesse Configurações → IA.' }, 400)
        const apiModel = GEMINI_MODEL_MAP[selectedModel] ?? 'gemini-2.0-flash'
        text = await callGemini(key, apiModel, systemPrompt, userMessage)
      }

      return json({ text })
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400)

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    console.error('[ai-generate]', msg)
    return json({ error: msg }, 500)
  }
})
