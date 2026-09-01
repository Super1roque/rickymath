'use client'

import { useRouter } from 'next/navigation'
import { fuenteJuego } from '@/lib/fuenteJuego'
import { reproducirCorrecto } from '@/lib/guiaAudio'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'
import BotonMenu from '@/components/guia/BotonMenu'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePerfil } from '@/contexts/PerfilContext'
import { suscribirseProgreso } from '@/lib/progreso'

// Mismo color de identidad que usa cada módulo en su propio banner —
// mantiene la coherencia visual entre "elegir la actividad acá" y "estar
// adentro de la actividad".
interface ModuloInfo {
  numero: number
  slug: string
  titulo: string
  emoji: string
  color: string
  colorOscuro: string
}

const MODULOS: ModuloInfo[] = [
  { numero: 1, slug: 'tercero-modulo-01', titulo: 'Multiplicación', emoji: '🌾', color: '#3b82f6', colorOscuro: '#1e3a8a' },
  { numero: 2, slug: 'tercero-modulo-02', titulo: 'División', emoji: '🍉', color: '#c026d3', colorOscuro: '#581c87' },
  { numero: 3, slug: 'tercero-modulo-03', titulo: 'Tablas de multiplicar', emoji: '🎯', color: '#d97706', colorOscuro: '#78350f' },
  { numero: 4, slug: 'tercero-modulo-04', titulo: 'Fracciones simples', emoji: '🍰', color: '#db2777', colorOscuro: '#831843' },
  { numero: 5, slug: 'tercero-modulo-05', titulo: 'El dinero', emoji: '💚', color: '#059669', colorOscuro: '#064e3b' },
  { numero: 6, slug: 'tercero-modulo-06', titulo: 'Perímetro', emoji: '🧱', color: '#65a30d', colorOscuro: '#365314' },
  { numero: 7, slug: 'tercero-modulo-07', titulo: 'Ángulos y figuras', emoji: '📐', color: '#7c3aed', colorOscuro: '#4c1d95' },
  { numero: 8, slug: 'tercero-modulo-08', titulo: 'Medidas', emoji: '📏', color: '#0891b2', colorOscuro: '#164e63' },
  { numero: 9, slug: 'tercero-modulo-09', titulo: 'Gráficos de barras', emoji: '📊', color: '#dc2626', colorOscuro: '#7f1d1d' },
  { numero: 10, slug: 'tercero-modulo-10', titulo: 'Misión final', emoji: '🏆', color: '#4338ca', colorOscuro: '#1e1b4b' },
]

export default function TerceroMenu() {
  const router = useRouter()
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [completados, setCompletados] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !perfilActivo) { setCompletados(new Set()); return }
    return suscribirseProgreso(user.uid, perfilActivo.id, progreso => {
      setCompletados(new Set(Object.keys(progreso)))
    })
  }, [user, perfilActivo])

  // El sonido necesita un instante para escucharse antes de que la
  // navegación descarte la página — por eso el push se retrasa un toque en
  // vez de disparar en el mismo tick del clic.
  function irAModulo(slug: string) {
    reproducirCorrecto()
    setTimeout(() => router.push(`/${slug}`), 220)
  }

  return (
    <div className={fuenteJuego.className} style={{
      position: 'relative', minHeight: '100vh', overflowX: 'hidden',
      background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 45%, #4c1d95 100%)',
      color: 'white', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <BotonMenu href="/grados" />
      <div style={{ textAlign: 'center', padding: '1.5rem 1rem 0.5rem' }}>
        {/* Ricky grande de bienvenida — en pantallas chicas ocupa casi todo
            el ancho (85vw), con un tope en pantallas grandes para que no se
            vuelva descomunal. Se queda saludando en loop en vez de caer a
            Breathe. Es la única presencia de Ricky en esta pantalla. */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Ricky mood="waving" loop size={220} alt="Ricky, dando la bienvenida" style={{ width: 'min(85vw, 460px)', height: 'min(85vw, 460px)' }} />
        </div>
        <h1 style={{
          fontSize: 'clamp(1.5rem, 6vw, 2.6rem)', fontWeight: 800, margin: 0,
          textShadow: '3px 3px 0 #1e1b4b',
        }}>
          Grado Tercero
        </h1>
        <p style={{ opacity: 0.85, marginTop: '0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
          Matemáticas en el Mundo de los Bloques — elegí una actividad
        </p>
      </div>

      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '0 1rem',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.1rem',
      }}>
        {MODULOS.map(m => (
          <BotonModulo key={m.numero} m={m} completado={completados.has(m.slug)} onClick={() => irAModulo(m.slug)} />
        ))}
      </div>
    </div>
  )
}

function BotonModulo({ m, completado, onClick }: { m: ModuloInfo; completado: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="gj-boton-3d"
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: '0.85rem', textAlign: 'left',
        padding: '1.1rem 1.2rem', borderRadius: 20, border: 'none', cursor: 'pointer',
        background: m.color, color: 'white',
        boxShadow: '0 6px 0 var(--gj-sombra)',
        [`--gj-sombra` as string]: m.colorOscuro,
      } as React.CSSProperties}
    >
      {completado && (
        <span style={{
          position: 'absolute', top: -10, right: -10, width: 36, height: 36, borderRadius: '50%',
          background: '#22c55e', border: '3px solid white', boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
        }}>
          <span style={{ color: 'white', fontSize: '1.3rem', fontWeight: 900, lineHeight: 1 }}>✓</span>
        </span>
      )}
      <span style={{
        width: 48, height: 48, borderRadius: 999, background: 'rgba(255,255,255,0.2)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
      }}>
        {m.emoji}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, opacity: 0.85 }}>ACTIVIDAD {m.numero}</p>
        <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, overflowWrap: 'break-word' }}>{m.titulo}</p>
      </div>
      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>▶️</span>
    </button>
  )
}
