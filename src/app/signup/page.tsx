'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { fuenteJuego } from '@/lib/fuenteJuego'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'

function mensajeError(codigo: string): string {
  if (codigo === 'auth/email-already-in-use') return 'Ya existe una cuenta con ese email.'
  if (codigo === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.'
  if (codigo === 'auth/invalid-email') return 'Ese email no es válido.'
  return 'No se pudo crear la cuenta. Intentá de nuevo.'
}

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { signup, loginWithGoogle, user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) router.replace('/grados')
  }, [authLoading, user, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(email, password)
      router.replace('/grados')
    } catch (err) {
      const codigo = (err as { code?: string }).code ?? ''
      setError(mensajeError(codigo))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignup() {
    setError('')
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
      router.replace('/grados')
    } catch {
      setError('No se pudo continuar con Google.')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className={fuenteJuego.className} style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 20%, #0c4a6e 60%, #14532d 100%)',
      color: 'white',
    }}>
      <EstilosJuego />
      <div style={{
        width: '100%', maxWidth: 380, background: 'rgba(15, 23, 42, 0.55)',
        borderRadius: 28, padding: '2rem 1.75rem', boxShadow: '0 12px 0 rgba(0,0,0,0.25), 0 20px 40px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)', textAlign: 'center',
      }}>
        <Ricky mood="encouraging" loop size={96} />
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0 0.25rem', textShadow: '2px 2px 0 #0c4a6e' }}>
          Creá tu cuenta
        </h1>
        <p style={{ opacity: 0.85, fontSize: '0.95rem', fontWeight: 600, margin: '0 0 1.5rem' }}>
          Gratis, en menos de un minuto
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="email" required placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" required minLength={6} placeholder="Contraseña (mín. 6 caracteres)" value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />

          {error && <p style={{ color: '#fca5a5', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading} className="gj-boton-3d" style={{
            ...botonStyle, background: 'linear-gradient(180deg, #22c55e, #14532d)',
            ['--gj-sombra' as string]: '#14532d', boxShadow: '0 6px 0 #14532d',
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Creando…' : 'Crear cuenta gratis'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.25rem 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>o</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.25)' }} />
        </div>

        <button onClick={handleGoogleSignup} disabled={googleLoading} className="gj-boton-3d" style={{
          ...botonStyle, background: 'linear-gradient(180deg, #f8fafc, #cbd5e1)', color: '#0f172a',
          ['--gj-sombra' as string]: '#94a3b8', boxShadow: '0 6px 0 #94a3b8',
          opacity: googleLoading ? 0.7 : 1,
        }}>
          {googleLoading ? 'Creando…' : 'Continuar con Google'}
        </button>

        <p style={{ marginTop: '1.5rem', fontSize: '0.9rem', opacity: 0.85 }}>
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" style={{ color: '#86efac', fontWeight: 800, textDecoration: 'none' }}>
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.85rem 1rem', borderRadius: 16, border: 'none', fontSize: '1rem',
  fontFamily: 'inherit', fontWeight: 600, background: 'rgba(255,255,255,0.92)', color: '#0f172a',
  outline: 'none',
}

const botonStyle: React.CSSProperties = {
  padding: '0.9rem 1rem', borderRadius: 16, border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: '1rem', fontWeight: 800, color: 'white', width: '100%',
}
