/* ================================================================
   Excursus — AI Providers
   As chaves de API vivem SOMENTE no servidor (tabela user_ai_keys com
   RLS deny-all). O browser nunca as vê — apenas chama a Edge Function.
   ================================================================ */

import { supabase } from './supabase'

// ── Catálogo de modelos ────────────────────────────────────────────
export type AIModelId =
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash'
  | 'gemini-1.5-flash'
  | 'gemini-2.0-flash-lite'
  | 'openai'
  | 'custom'

export interface AIModelMeta {
  id:       AIModelId
  label:    string
  provider: 'google' | 'openai' | 'custom'
  free:     boolean
  badge:    string
  desc:     string
}

export const AI_MODELS: AIModelMeta[] = [
  { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      provider: 'google',  free: true,  badge: 'Grátis', desc: 'Mais recente, com raciocínio aprimorado' },
  { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash',      provider: 'google',  free: true,  badge: 'Grátis', desc: 'Padrão — rápido e capaz' },
  { id: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash',      provider: 'google',  free: true,  badge: 'Grátis', desc: 'Estável e amplamente testado' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', provider: 'google',  free: true,  badge: 'Grátis', desc: 'Ultra-rápido, ideal para tarefas simples' },
  { id: 'openai',                label: 'OpenAI',                 provider: 'openai',  free: false, badge: 'Pago',   desc: 'GPT-4o, GPT-4o-mini e outros modelos' },
  { id: 'custom',                label: 'Custom',                 provider: 'custom',  free: false, badge: 'Pago',   desc: 'Qualquer API compatível com OpenAI' },
]

export const FREE_MODELS = AI_MODELS.filter(m => m.free)
export const PAID_MODELS = AI_MODELS.filter(m => !m.free)

/** Retorna o provider do modelo selecionado. */
export function modelProvider(id: AIModelId): 'google' | 'openai' | 'custom' {
  return AI_MODELS.find(m => m.id === id)?.provider ?? 'google'
}

// ── Chamada à Edge Function ────────────────────────────────────────
async function callEdgeFn(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado no Supabase')

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-generate`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json() as Record<string, unknown>
  if (!res.ok) throw new Error((data.error as string) || `HTTP ${res.status}`)
  return data
}

// ── Config de chamada (sem chaves — ficam no servidor) ─────────────
export interface AICallConfig {
  selectedModel: AIModelId
  openaiModel:   string
  customBaseUrl: string
  customModel:   string
}

// ── API pública ────────────────────────────────────────────────────

/** Gera texto via IA usando a chave armazenada server-side. */
export async function runAI(
  cfg:          AICallConfig,
  systemPrompt: string,
  userMessage:  string,
): Promise<string> {
  const data = await callEdgeFn({
    action:       'generate',
    selectedModel: cfg.selectedModel,
    systemPrompt,
    userMessage,
    openaiModel:   cfg.openaiModel  || undefined,
    customBaseUrl: cfg.customBaseUrl || undefined,
    customModel:   cfg.customModel  || undefined,
  })
  return data.text as string
}

/** Salva chave(s) de API no servidor. Passa apenas os campos que quer atualizar. */
export async function saveAiKeys(keys: {
  geminiKey?: string
  openaiKey?: string
  customKey?: string
}): Promise<void> {
  await callEdgeFn({ action: 'save', ...keys })
}

/** Remove chave(s) de API do servidor. */
export async function deleteAiKeys(providers: ('gemini' | 'openai' | 'custom')[]): Promise<void> {
  await callEdgeFn({ action: 'delete', providers })
}

/** Retorna quais provedores têm chave configurada (sem expor as chaves).
 *  O campo 'google' agrupa todos os modelos Gemini (DB usa coluna gemini_key). */
export async function fetchAiKeyStatus(): Promise<{
  google: boolean
  openai: boolean
  custom: boolean
}> {
  const data = await callEdgeFn({ action: 'status' })
  return {
    google: !!(data.gemini),   // Edge Function returns 'gemini', we map to 'google'
    openai: !!(data.openai),
    custom: !!(data.custom),
  }
}
