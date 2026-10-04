'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createLovableAuth } from '@lovable.dev/cloud-auth-js'

// Clave publicable (segura para el navegador). La seguridad la aplican las políticas RLS.
const SUPABASE_URL = 'https://iuuzheclayeiytmxahdp.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zDnhMGy8W-q-ZKMGiOvMkg_RpXqgDGy'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
    })
  }
  return client
}

const lovableAuth = createLovableAuth()

export async function signInWithGoogle(): Promise<Error | null> {
  const result = await lovableAuth.signInWithOAuth('google', {
    redirect_uri: window.location.origin,
  })
  if (result.redirected) return null
  if (result.error) return result.error
  const { error } = await getSupabase().auth.setSession(result.tokens)
  return error ?? null
}
