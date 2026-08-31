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
  { numero: 1, slug: 'segundo-modulo-01', titulo: 'Valor posicional', emoji: '🟩', color: '#22c55e', colorOscuro: '#14532d' },
  { numero: 2, slug: 'segundo-modulo-02', titulo: 'Suma llevando', emoji: '🧱', color: '#f97316', colorOscuro: '#7c2d12' },
  { numero: 3, slug: 'segundo-modulo-03', titulo: 'Resta prestando', emoji: '🟥', color: '#dc2626', colorOscuro: '#7f1d1d' },
  { numero: 4, slug: 'segundo-modulo-04', titulo: 'Multiplicación inicial', emoji: '🟨', color: '#ca8a04', colorOscuro: '#713f12' },
  { numero: 5, slug: 'segundo-modulo-05', titulo: 'División básica', emoji: '🔥', color: '#9333ea', colorOscuro: '#581c87' },
  { numero: 6, slug: 'segundo-modulo-06', titulo: 'Secuencias numéricas', emoji: '🔷', color: '#0ea5e9', colorOscuro: '#0c4a6e' },
  { numero: 7, slug: 'segundo-modulo-07', titulo: 'Lados y vértices', emoji: '🔺', color: '#475569', colorOscuro: '#1e293b' },
  { numero: 8, slug: 'segundo-modulo-08', titulo: 'Peso y capacidad', emoji: '⚖️', color: '#0d9488', colorOscuro: '#134e4a' },
  { numero: 9, slug: 'segundo-modulo-09', titulo: 'El reloj y la hora', emoji: '🕐', color: '#4f46e5', colorOscuro: '#312e81' },
  { numero: 10, slug: 'segundo-modulo-10', titulo: 'Misión final', emoji: '🏆', color: '#2563eb', colorOscuro: '#1e3a8a' },
]

export default function SegundoMenu() {
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
      background: 'linear-gradient(180deg, #0c4a6e 0%, #0369a1 45%, #0891b2 100%)',
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
          textShadow: '3px 3px 0 #0c4a6e',
        }}>
          Grado Segundo
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
