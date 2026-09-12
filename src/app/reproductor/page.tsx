import type { Metadata } from 'next'
import { Suspense } from 'react'
import ReproductorYouTube from './ReproductorYouTube'
import EstilosJuego from '@/components/guia/EstilosJuego'

const DESCRIPCION = 'Mirá cómo Ricky hace que practicar matemáticas se sienta como un juego.'

// Esta página muestra un video de YouTube distinto según el parámetro
// ?yt=... de la URL — pero esa parte es 100% del lado del cliente
// (ReproductorYouTube), así que la miniatura de acá abajo es siempre la
// misma genérica de RickyMath, sin importar qué video se esté embebiendo
// en un link puntual (un sitio estático no puede generar una miniatura
// distinta por cada combinación posible de parámetros).
export const metadata: Metadata = {
  title: 'RickyMath — Video',
  description: DESCRIPCION,
  openGraph: {
    title: 'RickyMath — Video',
    description: DESCRIPCION,
    url: 'https://rickymath.com/reproductor',
    siteName: 'RickyMath',
    type: 'video.other',
    images: [{ url: '/reproductor-poster.jpg', width: 1200, height: 630 }],
    locale: 'es_HN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RickyMath — Video',
    description: DESCRIPCION,
    images: ['/reproductor-poster.jpg'],
  },
}

export default function ReproductorPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.25rem', gap: '1.5rem',
      background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 20%, #0c4a6e 60%, #14532d 100%)',
    }}>
      <EstilosJuego />
      <Suspense fallback={null}>
        <ReproductorYouTube />
      </Suspense>
    </div>
  )
}
