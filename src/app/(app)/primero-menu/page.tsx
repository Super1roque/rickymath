'use client'

import { useRouter } from 'next/navigation'
import { fuenteJuego } from '@/lib/fuenteJuego'
import { reproducirCorrecto } from '@/lib/guiaAudio'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'
import BotonMenu from '@/components/guia/BotonMenu'

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
  { numero: 1, slug: 'primero-modulo-01', titulo: 'Contar bloques', emoji: '🧱', color: '#22c55e', colorOscuro: '#14532d' },
  { numero: 2, slug: 'primero-modulo-02', titulo: 'Antes, ahora y después', emoji: '⏳', color: '#f59e0b', colorOscuro: '#78350f' },
  { numero: 3, slug: 'primero-modulo-03', titulo: 'Mayor, menor o igual', emoji: '⚖️', color: '#6366f1', colorOscuro: '#312e81' },
  { numero: 4, slug: 'primero-modulo-04', titulo: 'Sumar con bloques', emoji: '➕', color: '#14b8a6', colorOscuro: '#134e4a' },
  { numero: 5, slug: 'primero-modulo-05', titulo: 'Restar con bloques', emoji: '➖', color: '#e11d48', colorOscuro: '#881337' },
  { numero: 6, slug: 'primero-modulo-06', titulo: 'Figuras geométricas', emoji: '🔺', color: '#a855f7', colorOscuro: '#581c87' },
  { numero: 7, slug: 'primero-modulo-07', titulo: 'Largo o corto', emoji: '📏', color: '#0ea5e9', colorOscuro: '#0c4a6e' },
  { numero: 8, slug: 'primero-modulo-08', titulo: 'Las monedas', emoji: '💰', color: '#ca8a04', colorOscuro: '#713f12' },
  { numero: 9, slug: 'primero-modulo-09', titulo: 'Contar y marcar', emoji: '🔢', color: '#f97316', colorOscuro: '#7c2d12' },
  { numero: 10, slug: 'primero-modulo-10', titulo: 'Misión final', emoji: '🏆', color: '#d946ef', colorOscuro: '#701a75' },
]

export default function PrimeroMenu() {
  const router = useRouter()

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
      background: 'linear-gradient(180deg, #14532d 0%, #166534 45%, #15803d 100%)',
      color: 'white', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <BotonMenu href="/grados" />
      <div style={{ textAlign: 'center', padding: '1.5rem 1rem 0.5rem' }}>
        {/* Ricky grande de bienvenida — en pantallas chicas ocupa casi todo
            el ancho (85vw), con un tope en pantallas grandes para que no se
            vuelva descomunal. Mood "sixseven" (tendencia) en loop. Sigue
            siendo la única presencia de Ricky en esta pantalla. */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Ricky mood="sixseven" loop size={220} alt="Ricky, dando la bienvenida" style={{ width: 'min(85vw, 460px)', height: 'min(85vw, 460px)' }} />
        </div>
        <h1 style={{
          fontSize: 'clamp(1.5rem, 6vw, 2.6rem)', fontWeight: 800, margin: 0,
          textShadow: '3px 3px 0 #14532d',
        }}>
          Grado Primero
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
          <BotonModulo key={m.numero} m={m} onClick={() => irAModulo(m.slug)} />
        ))}
      </div>
    </div>
  )
}

function BotonModulo({ m, onClick }: { m: ModuloInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="gj-boton-3d"
      style={{
        display: 'flex', alignItems: 'center', gap: '0.85rem', textAlign: 'left',
        padding: '1.1rem 1.2rem', borderRadius: 20, border: 'none', cursor: 'pointer',
        background: m.color, color: 'white',
        boxShadow: '0 6px 0 var(--gj-sombra)',
        [`--gj-sombra` as string]: m.colorOscuro,
      } as React.CSSProperties}
    >
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
