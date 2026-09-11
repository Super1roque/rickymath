import type { Metadata } from 'next'
import VideoConCta from './VideoConCta'
import EstilosJuego from '@/components/guia/EstilosJuego'

const DESCRIPCION = 'Mirá cómo Ricky hace que practicar matemáticas se sienta como un juego.'

export const metadata: Metadata = {
  title: 'RickyMath — Video',
  description: DESCRIPCION,
  openGraph: {
    title: 'RickyMath — Video',
    description: DESCRIPCION,
    url: 'https://rickymath.com/video-promo',
    siteName: 'RickyMath',
    type: 'video.other',
    videos: [{ url: 'https://rickymath.com/videos/anuncio.mp4', width: 1080, height: 1620, type: 'video/mp4' }],
    images: [{ url: '/video-poster.jpg', width: 1080, height: 1620 }],
    locale: 'es_HN',
  },
  twitter: {
    card: 'player',
    title: 'RickyMath — Video',
    description: DESCRIPCION,
    images: ['/video-poster.jpg'],
  },
}

export default function VideoPromoPage() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1.25rem', gap: '1.5rem',
      background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 20%, #0c4a6e 60%, #14532d 100%)',
    }}>
      <EstilosJuego />
      <VideoConCta />
    </div>
  )
}
