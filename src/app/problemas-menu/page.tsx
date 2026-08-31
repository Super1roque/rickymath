'use client'

import { useRouter } from 'next/navigation'
import { fuenteJuego } from '@/lib/fuenteJuego'
import { reproducirCorrecto } from '@/lib/guiaAudio'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'
import BotonMenu from '@/components/guia/BotonMenu'

// Serie "Problemas" — 10 tarjetas fijas (misión 01 a 10), pero solo
// algunas tienen módulo construido todavía. Las que no (`disponible:
// false`) se muestran bloqueadas en vez de desaparecer, para no tener que
// rediseñar esta grilla cada vez que se agrega una misión nueva — solo hay
// que pasar `disponible: true` y el `titulo` real cuando el módulo exista.
interface MisionInfo {
  numero: number
  slug: string
  titulo: string
  color: string
  colorOscuro: string
  disponible: boolean
}

const MISIONES: MisionInfo[] = [
  { numero: 1, slug: 'problemas-modulo-01', titulo: 'La primera cosecha', color: '#16a34a', colorOscuro: '#14532d', disponible: true },
  { numero: 2, slug: 'problemas-modulo-02', titulo: 'El cofre del aldeano', color: '#92400e', colorOscuro: '#451a03', disponible: true },
  { numero: 3, slug: 'problemas-modulo-03', titulo: 'La granja de pollos', color: '#f59e0b', colorOscuro: '#78350f', disponible: true },
  { numero: 4, slug: 'problemas-modulo-04', titulo: 'Repartir el botín', color: '#4338ca', colorOscuro: '#1e1b4b', disponible: true },
  { numero: 5, slug: 'problemas-modulo-05', titulo: 'El mercado de esmeraldas', color: '#059669', colorOscuro: '#064e3b', disponible: true },
  { numero: 6, slug: 'problemas-modulo-06', titulo: 'La gran construcción', color: '#475569', colorOscuro: '#1e293b', disponible: true },
  { numero: 7, slug: 'problemas-modulo-07', titulo: 'El pastel de la abeja', color: '#db2777', colorOscuro: '#831843', disponible: true },
  { numero: 8, slug: 'problemas-modulo-08', titulo: 'La tienda del Nether', color: '#dc2626', colorOscuro: '#7f1d1d', disponible: true },
  { numero: 9, slug: 'problemas-modulo-09', titulo: 'La torre del Fin', color: '#7c3aed', colorOscuro: '#4c1d95', disponible: true },
  { numero: 10, slug: 'problemas-modulo-10', titulo: 'La misión final', color: '#ca8a04', colorOscuro: '#713f12', disponible: true },
]

export default function ProblemasMenu() {
  const router = useRouter()

  // El sonido necesita un instante para escucharse antes de que la
  // navegación descarte la página — por eso el push se retrasa un toque en
  // vez de disparar en el mismo tick del clic.
  function irAMision(m: MisionInfo) {
    if (!m.disponible) return
    reproducirCorrecto()
    setTimeout(() => router.push(`/${m.slug}`), 220)
  }

  return (
    <div className={fuenteJuego.className} style={{
      position: 'relative', minHeight: '100vh', overflowX: 'hidden',
      background: 'linear-gradient(180deg, #14532d 0%, #16a34a 45%, #4ade80 100%)',
      color: 'white', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <BotonMenu href="/grados" />
      <div style={{ textAlign: 'center', padding: '1.5rem 1rem 0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Ricky mood="waving" loop size={220} alt="Ricky, dando la bienvenida" style={{ width: 'min(85vw, 460px)', height: 'min(85vw, 460px)' }} />
        </div>
        <h1 style={{
          fontSize: 'clamp(1.5rem, 6vw, 2.6rem)', fontWeight: 800, margin: 0,
          textShadow: '3px 3px 0 #14532d',
        }}>
          Problemas
        </h1>
        <p style={{ opacity: 0.85, marginTop: '0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
          Elegí una misión y resolvé los problemas
        </p>
      </div>

      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '0 1rem',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.1rem',
      }}>
        {MISIONES.map(m => (
          <BotonMision key={m.numero} m={m} onClick={() => irAMision(m)} />
        ))}
      </div>
    </div>
  )
}

function BotonMision({ m, onClick }: { m: MisionInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!m.disponible}
      className={m.disponible ? 'gj-boton-3d' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.85rem', textAlign: 'left',
        padding: '1.1rem 1.2rem', borderRadius: 20, border: 'none',
        cursor: m.disponible ? 'pointer' : 'default',
        background: m.color, color: 'white', opacity: m.disponible ? 1 : 0.65,
        boxShadow: `0 6px 0 ${m.colorOscuro}`,
      }}
    >
      <span style={{
        width: 48, height: 48, borderRadius: 999, background: 'rgba(255,255,255,0.2)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, flexShrink: 0,
      }}>
        {m.numero}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, opacity: 0.85 }}>MISIÓN {m.numero}</p>
        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, overflowWrap: 'break-word' }}>
          {m.disponible ? m.titulo : '🔒 Pronto'}
        </p>
      </div>
      {m.disponible && <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>▶️</span>}
    </button>
  )
}
