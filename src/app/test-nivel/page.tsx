import type { Metadata } from 'next'
import TestNivel from './TestNivel'
import EstilosJuego from '@/components/guia/EstilosJuego'

const DESCRIPCION = '¿Tu hijo sabe lo que le toca en su grado? Test gratis de 6 preguntas, 2 minutos.'

export const metadata: Metadata = {
  title: 'RickyMath — Test de nivel',
  description: DESCRIPCION,
  openGraph: {
    title: '¿Tu hijo sabe lo que le toca en su grado?',
    description: DESCRIPCION,
    url: 'https://rickymath.com/test-nivel',
    siteName: 'RickyMath',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'es_HN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '¿Tu hijo sabe lo que le toca en su grado?',
    description: DESCRIPCION,
    images: ['/og-image.png'],
  },
}

export default function TestNivelPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.25rem', background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 20%, #0c4a6e 60%, #14532d 100%)',
    }}>
      <EstilosJuego />
      <TestNivel />
    </div>
  )
}
