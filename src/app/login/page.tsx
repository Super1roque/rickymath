'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { fuenteJuego } from '@/lib/fuenteJuego'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { login, loginWithGoogle, user, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && user) router.replace('/grados')
  }, [authLoading, user, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      router.replace('/grados')
    } catch {
      setError('Email o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
      router.replace('/grados')
    } catch {
      setError('No se pudo iniciar sesión con Google.')
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
        <Ricky mood="waving" loop size={96} />
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0 0.25rem', textShadow: '2px 2px 0 #0c4a6e' }}>
          RickyMath
        </h1>
        <p style={{ opacity: 0.85, fontSize: '0.95rem', fontWeight: 600, margin: '0 0 1.5rem' }}>
          Matemáticas en el Mundo de los Bloques
        </p>

        {/* CTA principal — crear cuenta es la acción que queremos que tome
            la mayoría de quienes llegan acá, el login (abajo) es para
            quien ya tiene cuenta, no al revés. */}
        <Link href="/signup" className="gj-boton-3d" style={{
          ...botonStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          textDecoration: 'none', background: 'linear-gradient(180deg, #22c55e, #14532d)',
          ['--gj-sombra' as string]: '#14532d', boxShadow: '0 6px 0 #14532d',
        }}>
          ✨ Crear cuenta gratis
        </Link>
        <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: '0.5rem 0 0' }}>
          Gratis, en menos de un minuto
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0 1.25rem' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>¿Ya tenés cuenta?</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.25)' }} />
        </div>

        <div style={{
          background: 'rgba(0,0,0,0.18)', borderRadius: 20, padding: '1.25rem',
        }}>
          <button onClick={handleGoogleLogin} disabled={googleLoading} className="gj-boton-3d" style={{
            ...botonStyle, fontSize: '0.9rem', padding: '0.7rem 1rem',
            background: 'linear-gradient(180deg, #f8fafc, #cbd5e1)', color: '#0f172a',
            ['--gj-sombra' as string]: '#94a3b8', boxShadow: '0 4px 0 #94a3b8',
            opacity: googleLoading ? 0.7 : 1,
          }}>
            {googleLoading ? 'Entrando…' : 'Continuar con Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.9rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>o</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input
              type="email" required placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ ...inputStyle, padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
            />
            <input
              type="password" required placeholder="Contraseña" value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...inputStyle, padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
            />

            {error && <p style={{ color: '#fca5a5', fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading} className="gj-boton-3d" style={{
              ...botonStyle, fontSize: '0.9rem', padding: '0.7rem 1rem',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)',
              ['--gj-sombra' as string]: 'rgba(0,0,0,0.3)', boxShadow: '0 4px 0 rgba(0,0,0,0.3)',
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
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
