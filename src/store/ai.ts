/**
 * AI Store
 *
 * Guarda APENAS configurações não-sensíveis no localStorage.
 * As chaves de API vivem exclusivamente no banco (user_ai_keys, RLS deny-all).
 *
 * keyStatus → cache booleano por provedor (atualizado ao salvar/remover chaves)
 *             Seguro em localStorage: indica apenas se a chave existe, nunca a chave.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIModelId } from '../lib/ai-providers'

export type AIKeyStatus = Record<'google' | 'openai' | 'custom', boolean>

interface Annotation {
  id:   string
  tag:  string
  body: string
}

interface AiStore {
  // ── Configurações não-sensíveis (localStorage) ───────────────────
  selectedModel: AIModelId
  openaiModel:   string
  customBaseUrl: string
  customModel:   string

  // ── Status das chaves (booleanos — não são as chaves em si) ──────
  keyStatus:       AIKeyStatus
  keyStatusLoaded: boolean   // true após a primeira consulta ao servidor

  // ── Estado de sessão (não persistido) ────────────────────────────
  annotations: Annotation[]
  loading:     boolean

  // ── Actions ──────────────────────────────────────────────────────
  setSelectedModel:   (m: AIModelId) => void
  setOpenaiModel:     (m: string) => void
  setCustomBaseUrl:   (u: string) => void
  setCustomModel:     (m: string) => void
  setKeyStatus:       (s: Partial<AIKeyStatus>) => void
  setKeyStatusLoaded: (v: boolean) => void

  addAnnotation:    (tag: string, body: string) => void
  removeAnnotation: (id: string) => void
  clearAnnotations: () => void
  setLoading:       (v: boolean) => void
}

export const useAiStore = create<AiStore>()(
  persist(
    (set, get) => ({
      selectedModel:   'gemini-2.0-flash',
      openaiModel:     'gpt-4o-mini',
      customBaseUrl:   '',
      customModel:     '',
      keyStatus:       { google: false, openai: false, custom: false },
      keyStatusLoaded: false,
      annotations:     [],
      loading:         false,

      setSelectedModel:   (selectedModel)   => set({ selectedModel }),
      setOpenaiModel:     (openaiModel)     => set({ openaiModel }),
      setCustomBaseUrl:   (customBaseUrl)   => set({ customBaseUrl }),
      setCustomModel:     (customModel)     => set({ customModel }),
      setKeyStatus:       (patch)           => set(s => ({ keyStatus: { ...s.keyStatus, ...patch } })),
      setKeyStatusLoaded: (keyStatusLoaded) => set({ keyStatusLoaded }),

      addAnnotation: (tag, body) =>
        set(s => ({
          annotations: [...s.annotations, { id: crypto.randomUUID(), tag, body }],
        })),
      removeAnnotation: (id) =>
        set(s => ({ annotations: s.annotations.filter(a => a.id !== id) })),
      clearAnnotations: () => set({ annotations: [] }),
      setLoading: (loading) => set({ loading }),

      // Silence unused warning for `get`
      _get: get,
    }),
    {
      name: 'excursus-ai',
      // Persiste APENAS configurações não-sensíveis
      partialize: (s) => ({
        selectedModel:   s.selectedModel,
        openaiModel:     s.openaiModel,
        customBaseUrl:   s.customBaseUrl,
        customModel:     s.customModel,
        keyStatus:       s.keyStatus,       // booleanos — não são chaves
        keyStatusLoaded: s.keyStatusLoaded,
      }),
    }
  )
)
