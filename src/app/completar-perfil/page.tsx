'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { actualizarTenant } from '@/lib/tenants'
import { fuenteJuego } from '@/lib/fuenteJuego'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'

// Solo lo ven cuentas que entraron con Google y todavía no tienen
// teléfono guardado (Google no lo entrega en el login) — un único paso
// extra antes de elegir perfil, para que todas las cuentas terminen con
// nombre, email y teléfono sin importar cómo se registraron.
export default function CompletarPerfilPage() {
  const { user, tenantData, loading: authLoading, refreshTenant } = useAuth()
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.replace('/login'); return }
    if (tenantData?.telefono) { router.replace('/perfiles'); return }
    if (tenantData) setNombre(tenantData.nombre)
  }, [authLoading, user, tenantData, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    setGuardando(true)
    try {
      await actualizarTenant(user.uid, { nombre, telefono })
      await refreshTenant()
      router.replace('/perfiles')
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  if (authLoading || !user || !tenantData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#22c55e',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
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
        <Ricky mood="waiting" loop size={96} />
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.5rem 0 0.25rem', textShadow: '2px 2px 0 #0c4a6e' }}>
          Un dato más
        </h1>
        <p style={{ opacity: 0.85, fontSize: '0.92rem', fontWeight: 600, margin: '0 0 1.5rem' }}>
          Nos falta tu teléfono de contacto
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text" required placeholder="Nombre del padre/tutor" value={nombre}
            onChange={e => setNombre(e.target.value)}
            style={inputStyle}
          />
          <input
            type="tel" required placeholder="Teléfono" value={telefono}
            onChange={e => setTelefono(e.target.value)}
            style={inputStyle}
          />

          {error && <p style={{ color: '#fca5a5', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{error}</p>}

          <button type="submit" disabled={guardando} className="gj-boton-3d" style={{
            padding: '0.9rem 1rem', borderRadius: 16, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '1rem', fontWeight: 800, color: 'white', width: '100%',
            background: 'linear-gradient(180deg, #22c55e, #14532d)',
            ['--gj-sombra' as string]: '#14532d', boxShadow: '0 6px 0 #14532d',
            opacity: guardando ? 0.7 : 1,
          }}>
            {guardando ? 'Guardando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.85rem 1rem', borderRadius: 16, border: 'none', fontSize: '1rem',
  fontFamily: 'inherit', fontWeight: 600, background: 'rgba(255,255,255,0.92)', color: '#0f172a',
  outline: 'none',
}
