import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Annotation {
  id: string
  tag: string
  body: string
}

interface AiStore {
  apiKey: string
  annotations: Annotation[]
  loading: boolean
  setApiKey: (key: string) => void
  addAnnotation: (tag: string, body: string) => void
  removeAnnotation: (id: string) => void
  clearAnnotations: () => void
  setLoading: (loading: boolean) => void
}

export const useAiStore = create<AiStore>()(
  persist(
    (set) => ({
      apiKey: '',
      annotations: [],
      loading: false,
      setApiKey: (key) => set({ apiKey: key }),
      addAnnotation: (tag, body) =>
        set((s) => ({
          annotations: [
            ...s.annotations,
            { id: crypto.randomUUID(), tag, body },
          ],
        })),
      removeAnnotation: (id) =>
        set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),
      clearAnnotations: () => set({ annotations: [] }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'excursus-ai',
      partialize: (s) => ({ apiKey: s.apiKey }),
    }
  )
)
