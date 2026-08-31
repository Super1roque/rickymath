'use client'

import { useRouter } from 'next/navigation'
import { fuenteJuego } from '@/lib/fuenteJuego'
import { reproducirCorrecto } from '@/lib/guiaAudio'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'
import BotonMenu from '@/components/guia/BotonMenu'

// Serie bonus "Tablas de Multiplicar" — 10 tarjetas fijas (tabla del 1 al
// 10), pero solo algunas tienen módulo construido todavía. Las que no
// (`disponible: false`) se muestran bloqueadas en vez de desaparecer, para
// no tener que rediseñar esta grilla cada vez que se agrega una tabla
// nueva — solo hay que pasar `disponible: true` cuando el módulo exista.
interface TablaInfo {
  numero: number
  slug: string
  color: string
  colorOscuro: string
  disponible: boolean
}

const TABLAS: TablaInfo[] = [
  { numero: 1, slug: 'tablas-modulo-01', color: '#db2777', colorOscuro: '#831843', disponible: true },
  { numero: 2, slug: 'tablas-modulo-02', color: '#2563eb', colorOscuro: '#1e3a8a', disponible: true },
  { numero: 3, slug: 'tablas-modulo-03', color: '#d97706', colorOscuro: '#78350f', disponible: true },
  { numero: 4, slug: 'tablas-modulo-04', color: '#92400e', colorOscuro: '#451a03', disponible: true },
  { numero: 5, slug: 'tablas-modulo-05', color: '#ea580c', colorOscuro: '#7c2d12', disponible: true },
  { numero: 6, slug: 'tablas-modulo-06', color: '#15803d', colorOscuro: '#052e16', disponible: true },
  { numero: 7, slug: 'tablas-modulo-07', color: '#0891b2', colorOscuro: '#164e63', disponible: true },
  { numero: 8, slug: 'tablas-modulo-08', color: '#7c3aed', colorOscuro: '#2e1065', disponible: true },
  { numero: 9, slug: 'tablas-modulo-09', color: '#dc2626', colorOscuro: '#7f1d1d', disponible: true },
  { numero: 10, slug: 'tablas-modulo-10', color: '#ca8a04', colorOscuro: '#713f12', disponible: true },
]

export default function TablasMenu() {
  const router = useRouter()

  // El sonido necesita un instante para escucharse antes de que la
  // navegación descarte la página — por eso el push se retrasa un toque en
  // vez de disparar en el mismo tick del clic.
  function irATabla(t: TablaInfo) {
    if (!t.disponible) return
    reproducirCorrecto()
    setTimeout(() => router.push(`/${t.slug}`), 220)
  }

  return (
    <div className={fuenteJuego.className} style={{
      position: 'relative', minHeight: '100vh', overflowX: 'hidden',
      background: 'linear-gradient(180deg, #831843 0%, #db2777 45%, #f472b6 100%)',
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
          textShadow: '3px 3px 0 #831843',
        }}>
          Tablas de Multiplicar
        </h1>
        <p style={{ opacity: 0.85, marginTop: '0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
          Bonus — elegí una tabla para practicar
        </p>
      </div>

      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem 0',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem',
      }}>
        {TABLAS.map(t => (
          <BotonTabla key={t.numero} t={t} onClick={() => irATabla(t)} />
        ))}
      </div>
    </div>
  )
}

function BotonTabla({ t, onClick }: { t: TablaInfo; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!t.disponible}
      className={t.disponible ? 'gj-boton-3d' : undefined}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
        padding: '1.1rem 0.6rem', borderRadius: 20, border: 'none',
        cursor: t.disponible ? 'pointer' : 'default',
        background: `linear-gradient(180deg, ${t.color}, ${t.colorOscuro})`,
        boxShadow: `0 6px 0 ${t.colorOscuro}`,
        color: 'white', opacity: t.disponible ? 1 : 0.65,
      }}
    >
      <span style={{ fontSize: '2.2rem', fontWeight: 900, lineHeight: 1 }}>{t.numero}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 800, letterSpacing: '0.02em' }}>
        {t.disponible ? 'Tabla' : '🔒 Pronto'}
      </span>
    </button>
  )
}
