'use client'

import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

// SHA-256 de la clave compartida. La clave en texto plano nunca vive en el código.
const EXPECTED_HASH =
  'db005e035072c2ddeb41351dccab7a19da7cd80f7358fe6e98d120e272238168'
const STORAGE_KEY = 'melano-gate-unlocked'

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null)
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setChecking(true)
    setError(false)
    const password = new FormData(e.currentTarget).get('password') as string
    const hash = await sha256(password)
    if (hash === EXPECTED_HASH) {
      sessionStorage.setItem(STORAGE_KEY, '1')
      setUnlocked(true)
    } else {
      setError(true)
    }
    setChecking(false)
  }

  if (unlocked === null) return null
  if (unlocked) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-2xl"
      >
        <p className="text-xs font-semibold tracking-[0.3em] text-amber-500/80">
          MELANO INC
        </p>
        <h1 className="mt-2 text-xl font-semibold text-neutral-100">
          Acceso al Command Center
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Ingresá la clave compartida para continuar.
        </p>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="Clave de acceso"
          className="mt-6 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-amber-500/60"
        />
        {error && (
          <p className="mt-2 text-sm text-red-400">Clave incorrecta.</p>
        )}
        <button
          type="submit"
          disabled={checking}
          className="mt-4 w-full rounded-lg bg-neutral-100 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-white disabled:opacity-50"
        >
          {checking ? 'Verificando…' : 'Ingresar'}
        </button>
        <p className="mt-6 text-center text-[11px] tracking-widest text-neutral-600">
          AI. AUTOMATION. IMPACT.
        </p>
      </form>
    </div>
  )
}
