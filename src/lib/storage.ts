import { supabase } from './supabase'

const BUCKET = 'uploads'

// 10 years in seconds — effectively permanent for a personal app
const SIGNED_EXPIRY = 60 * 60 * 24 * 365 * 10

export interface UploadResult {
  /** Signed URL for immediate embedding (works for private & public buckets) */
  url: string
  /** Storage path — use refreshStorageUrl(path) to renew if the URL ever expires */
  path: string
}

export async function uploadFile(userId: string, file: File): Promise<UploadResult> {
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error

  const url = await refreshStorageUrl(path)
  return { url, path }
}

/**
 * Generate a fresh signed URL from a stored file path.
 * Falls back to the public URL if signing fails (e.g. public bucket).
 */
export async function refreshStorageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_EXPIRY)
  if (!error && data?.signedUrl) return data.signedUrl

  // Fallback: public URL (works when bucket is public)
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return pub.publicUrl
}
