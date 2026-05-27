import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { createLogger } from '../lib/logger'
import type { User } from '@supabase/supabase-js'

const log = createLogger('auth')

interface AuthStore {
  user:           User | null
  loading:        boolean
  isRecovering:   boolean          // true while the user is in password-reset flow
  initialize:     () => void
  signIn:         (email: string, password: string) => Promise<string | null>
  signUp:         (email: string, password: string) => Promise<string | null>
  signOut:        () => Promise<void>
  resetPassword:  (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  deleteAccount:  () => Promise<void>
  updateAvatar:   (file: File) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user:         null,
  loading:      true,
  isRecovering: false,

  initialize: () => {
    log.info('inicializando sessão')
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null
      log.info('sessão inicial', { userId: user?.id ?? null, hasSession: !!data.session })
      set({ user, loading: false })
    })
    supabase.auth.onAuthStateChange((event, session) => {
      log.info(`auth state change: ${event}`, { userId: session?.user?.id ?? null })
      set({ user: session?.user ?? null, loading: false })
      if (event === 'PASSWORD_RECOVERY') {
        log.info('entrando no modo de recuperação de senha')
        set({ isRecovering: true })
      }
    })
  },

  signIn: async (email, password) => {
    log.info('tentativa de login', { email })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) log.error('falha no login', { email, error: error.message })
    else       log.info('login bem-sucedido', { email })
    return error?.message ?? null
  },

  signUp: async (email, password) => {
    log.info('tentativa de cadastro', { email })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { log.error('falha no cadastro', { email, error: error.message }); return error.message }
    if (data.user && !data.session) { log.info('cadastro pendente — verificar e-mail', { email }); return 'check_email' }
    log.info('cadastro bem-sucedido', { email })
    return null
  },

  resetPassword: async (email) => {
    log.info('solicitação de reset de senha', { email, redirectTo: window.location.origin })
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}`,
    })
    if (error) log.error('falha ao enviar reset de senha', { email, error: error.message })
    else       log.info('e-mail de reset enviado', { email })
    return error?.message ?? null
  },

  updatePassword: async (password) => {
    log.info('atualizando senha')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { log.error('falha ao atualizar senha', error.message); return error.message }
    log.info('senha atualizada com sucesso')
    set({ isRecovering: false })
    return null
  },

  signOut: async () => {
    log.info('saindo da conta')
    await supabase.auth.signOut()
    set({ user: null })
    log.info('sessão encerrada')
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
