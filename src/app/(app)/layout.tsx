'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { usePerfil } from '@/contexts/PerfilContext'

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { user, tenantData, loading, logout } = useAuth()
  const { perfilActivo, cargando: cargandoPerfiles, cambiarPerfil } = usePerfil()
  const router = useRouter()

  const listo = !loading && !cargandoPerfiles
  const suspendido = tenantData?.status === 'suspended'
  // Cuentas de Google sin teléfono (Google no lo entrega en el login) —
  // se les pide una sola vez antes de dejarlas pasar, así todas las
  // cuentas terminan con nombre, email y teléfono, sin importar cómo se
  // registraron.
  const faltaTelefono = !suspendido && !!tenantData && !tenantData.telefono
  // El contenido premium ya NO se bloquea acá por ruta — se puede entrar
  // y ver el módulo (para que el padre vea qué tipo de ejercicio es), el
  // candado va sobre las preguntas mismas (ver CandadoPremium en cada
  // módulo).

  useEffect(() => {
    if (!listo) return
    if (!user) { router.replace('/login'); return }
    if (faltaTelefono) { router.replace('/completar-perfil'); return }
    if (!suspendido && !perfilActivo) router.replace('/perfiles')
  }, [listo, user, perfilActivo, suspendido, faltaTelefono, router])

  if (!listo || !user || faltaTelefono || (!suspendido && !perfilActivo)) {
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

  if (suspendido) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Cuenta suspendida</h1>
          <p style={{ opacity: 0.75, fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Esta cuenta no tiene acceso por ahora. Si creés que es un error, contactanos.
          </p>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            style={{
              padding: '0.7rem 1.5rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 700, fontSize: '0.85rem',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  if (!perfilActivo) return null

  return (
    <>
      {children}
      <div style={{
        position: 'fixed', top: 12, right: 12, zIndex: 50,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.35rem',
          background: 'rgba(15, 23, 42, 0.5)', borderRadius: 999, padding: '0.25rem 0.7rem',
          backdropFilter: 'blur(4px)', color: 'rgba(255,255,255,0.85)', fontSize: '0.7rem', fontWeight: 700,
        }}>
          <span>👤 {tenantData?.nombre || tenantData?.email || ''}</span>
          <span style={{
            padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.65rem', fontWeight: 800,
            background: tenantData?.plan === 'premium' ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.12)',
            color: tenantData?.plan === 'premium' ? '#fbbf24' : 'rgba(255,255,255,0.7)',
          }}>
            {tenantData?.plan === 'premium' ? '⭐ Premium' : 'Free'}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'rgba(15, 23, 42, 0.55)', borderRadius: 999, padding: '0.35rem 0.5rem 0.35rem 0.7rem',
          backdropFilter: 'blur(4px)', color: 'white', fontSize: '0.8rem', fontWeight: 700,
        }}>
          <button
            onClick={() => { cambiarPerfil(); router.push('/perfiles') }}
            title="Cambiar de perfil"
            style={{
              background: 'none', border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'inherit',
              fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.3rem',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{perfilActivo.cara}</span>
            {perfilActivo.nombre}
          </button>
          <span style={{ opacity: 0.4 }}>|</span>
          <button
            onClick={() => router.push('/progreso')}
            title="Ver progreso (para padres)"
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, padding: '0.2rem 0.3rem',
            }}
          >
            📊
          </button>
          <span style={{ opacity: 0.4 }}>|</span>
          <button
            onClick={() => logout().then(() => router.replace('/login'))}
            style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.3rem',
            }}
          >
            Salir
          </button>
        </div>
      </div>
    </>
  )
}
