import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthStore {
  user:          User | null
  loading:       boolean
  initialize:    () => void
  signIn:        (email: string, password: string) => Promise<string | null>
  signUp:        (email: string, password: string) => Promise<string | null>
  signOut:       () => Promise<void>
  deleteAccount: () => Promise<void>
  updateAvatar:  (file: File) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user:    null,
  loading: true,

  initialize: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null, loading: false })
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, loading: false })
    })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return error.message
    if (data.user && !data.session) return 'check_email'
    return null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },

  /**
   * Deletes the current user's account via the `delete_user` Postgres function
   * (defined in supabase/migrations). After deletion, signs out locally.
   */
  deleteAccount: async () => {
    const { error } = await supabase.rpc('delete_user')
    if (error) throw new Error(error.message)
    await supabase.auth.signOut()
    set({ user: null })
  },

  /**
   * Uploads an avatar image to the `avatars` Supabase Storage bucket and
   * saves the public URL in the user's metadata.
   */
  updateAvatar: async (file: File) => {
    const { user } = get()
    if (!user) throw new Error('Não autenticado')

    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadErr) throw new Error(uploadErr.message)

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    const { data, error: updateErr } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    })
    if (updateErr) throw new Error(updateErr.message)
    if (data.user) set({ user: data.user })
  },
}))
