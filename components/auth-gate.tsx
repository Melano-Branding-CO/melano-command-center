'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase, signInWithGoogle } from '@/lib/supabase-browser'

type Access = 'loading' | 'signed_out' | 'no_access' | 'ok'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [access, setAccess] = useState<Access>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const sb = getSupabase()
    const check = async (s: Session | null) => {
      setSession(s)
      if (!s) return setAccess('signed_out')
      // Un usuario autenticado no es automáticamente autorizado: exige membresía.
      const { data, error } = await sb
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', s.user.id)
        .limit(1)
      setAccess(!error && data && data.length > 0 ? 'ok' : 'no_access')
    }
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => void check(s), 0)
      }
    })
    sb.auth.getSession().then(({ data }) => check(data.session))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function onEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError('Email o contraseña incorrectos.')
    setBusy(false)
  }

  async function onGoogle() {
    setBusy(true)
    setError(null)
    const err = await signInWithGoogle()
    if (err) setError('No se pudo iniciar sesión con Google.')
    setBusy(false)
  }

  async function signOut() {
    await getSupabase().auth.signOut()
  }

  if (access === 'loading') {
    return <div className="min-h-screen bg-background" aria-busy="true" />
  }

  if (access === 'ok') {
    return (
      <>
        <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-md border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <span className="hidden sm:inline">{session?.user.email}</span>
          <button onClick={signOut} className="font-medium text-foreground hover:underline">
            Cerrar sesión
          </button>
        </div>
        {children}
      </>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a86a]">MELANO INC</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">Acceso al Command Center</h1>

        {access === 'no_access' ? (
          <div className="mt-6 space-y-4 text-sm text-muted-foreground">
            <p>
              Tu cuenta <strong className="text-foreground">{session?.user.email}</strong> no tiene
              acceso autorizado. Pedile una invitación a un administrador.
            </p>
            <button
              onClick={signOut}
              className="w-full rounded-md border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
            >
              Cerrar sesión
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={onGoogle}
              disabled={busy}
              className="mt-6 w-full rounded-md border border-border bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              Continuar con Google
            </button>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> o con email <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={onEmail} className="space-y-3">
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md border border-[#c9a86a] px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                {busy ? 'Ingresando…' : 'Ingresar'}
              </button>
            </form>
          </>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
        <p className="mt-6 text-center text-xs text-muted-foreground">Solo personas invitadas pueden ingresar.</p>
      </div>
    </main>
  )
}
