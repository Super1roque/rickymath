'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { usePerfil } from '@/contexts/PerfilContext'
import { suscribirseProgreso, type ProgresoModulo } from '@/lib/progreso'
import { GRADOS_MANIFIESTO, moduloId } from '@/lib/manifiestoModulos'
import { fuenteJuego } from '@/lib/fuenteJuego'
import EstilosJuego from '@/components/guia/EstilosJuego'

export default function ProgresoPage() {
  const { user, loading: authLoading } = useAuth()
  const { perfiles, cargando: cargandoPerfiles } = usePerfil()
  const router = useRouter()
  const [perfilId, setPerfilId] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<Record<string, ProgresoModulo>>({})
  const [cargandoProgreso, setCargandoProgreso] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!perfilId && perfiles.length > 0) setPerfilId(perfiles[0].id)
  }, [perfiles, perfilId])

  useEffect(() => {
    if (!user || !perfilId) { setProgreso({}); return }
    setCargandoProgreso(true)
    const unsub = suscribirseProgreso(user.uid, perfilId, mapa => {
      setProgreso(mapa)
      setCargandoProgreso(false)
    })
    return unsub
  }, [user, perfilId])

  if (authLoading || cargandoPerfiles || !user) {
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

  const perfilActivo = perfiles.find(p => p.id === perfilId) ?? null

  return (
    <div className={fuenteJuego.className} style={{
      minHeight: '100vh', padding: '2rem 1.25rem 3rem', color: 'white',
      background: 'linear-gradient(180deg, #0c4a6e 0%, #0f172a 45%, #14532d 100%)',
    }}>
      <EstilosJuego />
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>📊 Progreso</h1>
          <Link href="/perfiles" style={{
            fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', textDecoration: 'none',
          }}>
            ← Volver a perfiles
          </Link>
        </div>

        {perfiles.length === 0 ? (
          <p style={{ opacity: 0.8 }}>Todavía no creaste ningún perfil.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
              {perfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPerfilId(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                    padding: '0.5rem 0.9rem', borderRadius: 999, fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem',
                    border: p.id === perfilId ? '2px solid #22c55e' : '2px solid rgba(255,255,255,0.2)',
                    background: p.id === perfilId ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)',
                    color: 'white',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{p.cara}</span>
                  {p.nombre}
                </button>
              ))}
            </div>

            {perfilActivo && (
              cargandoProgreso ? (
                <p style={{ opacity: 0.75 }}>Cargando…</p>
              ) : (
                <GradosProgreso progreso={progreso} />
              )
            )}
          </>
        )}
      </div>
    </div>
  )
}

function GradosProgreso({ progreso }: { progreso: Record<string, ProgresoModulo> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {GRADOS_MANIFIESTO.map(grado => {
        const modulos = Array.from({ length: grado.totalModulos }, (_, i) => i + 1).map(n => ({
          numero: n,
          id: moduloId(grado.slug, n),
          datos: progreso[moduloId(grado.slug, n)] ?? null,
        }))
        const jugados = modulos.filter(m => m.datos !== null)
        if (jugados.length === 0) return <GradoVacio key={grado.slug} grado={grado} />

        const puntosTotales = jugados.reduce((acc, m) => acc + (m.datos?.mejorPuntaje ?? 0), 0)

        return (
          <div key={grado.slug}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                {grado.emoji} {grado.nombre}
              </h2>
              <span style={{ fontSize: '0.85rem', opacity: 0.7, fontWeight: 600 }}>
                {jugados.length}/{grado.totalModulos} módulos · ⭐ {puntosTotales} pts
              </span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem',
            }}>
              {modulos.map(m => <TarjetaModulo key={m.id} numero={m.numero} datos={m.datos} color={grado.color} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GradoVacio({ grado }: { grado: { slug: string; nombre: string; emoji: string } }) {
  return (
    <div style={{ opacity: 0.55, fontSize: '0.95rem', fontWeight: 600 }}>
      {grado.emoji} {grado.nombre} — todavía sin empezar
    </div>
  )
}

function TarjetaModulo({ numero, datos, color }: { numero: number; datos: ProgresoModulo | null; color: string }) {
  if (!datos) {
    return (
      <div style={{
        borderRadius: 16, padding: '0.85rem', background: 'rgba(255,255,255,0.04)',
        border: '2px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.4)',
      }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Módulo {numero}</div>
        <div style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Sin empezar</div>
      </div>
    )
  }

  const fecha = datos.actualizadoEn?.toDate?.()
  const fechaTexto = fecha
    ? fecha.toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })
    : null

  return (
    <div style={{
      borderRadius: 16, padding: '0.85rem', background: 'rgba(255,255,255,0.08)',
      border: `2px solid ${color}`,
    }}>
      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Módulo {numero}</div>
      <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', fontWeight: 700 }}>
        {datos.correctas}/{datos.total} correctas
      </div>
      <div style={{ fontSize: '0.78rem', marginTop: '0.15rem', opacity: 0.85 }}>
        ⭐ mejor: {datos.mejorPuntaje} pts · 🔥 mejor racha: {datos.mejorRachaHistorica}
      </div>
      <div style={{ fontSize: '0.72rem', marginTop: '0.3rem', opacity: 0.6 }}>
        {datos.intentos} {datos.intentos === 1 ? 'intento' : 'intentos'}{fechaTexto ? ` · ${fechaTexto}` : ''}
      </div>
    </div>
  )
}
