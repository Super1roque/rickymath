'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// Segundo del video en el que aparece el CTA — a partir de acá se puede
// ajustar sin tocar el resto de la lógica. Elegido para que coincida con
// el arranque del momento de celebración (trofeo/chispas), no antes.
const CTA_DESDE_SEGUNDO = 8

export default function VideoConCta() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mostrarCta, setMostrarCta] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTimeUpdate = () => setMostrarCta(video.currentTime >= CTA_DESDE_SEGUNDO)
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [])

  return (
    <div style={{
      position: 'relative', width: '100%', maxWidth: 420, margin: '0 auto',
      borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 0 rgba(0,0,0,0.25), 0 20px 40px rgba(0,0,0,0.4)',
      background: '#000',
    }}>
      <video
        ref={videoRef}
        controls
        playsInline
        poster="/video-poster.jpg"
        style={{ display: 'block', width: '100%', height: 'auto' }}
      >
        <source src="/videos/anuncio.mp4" type="video/mp4" />
      </video>

      <Link
        href="/signup"
        style={{
          position: 'absolute', left: '50%', bottom: '4.5rem',
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.85rem 1.5rem', borderRadius: 999, fontWeight: 800, fontSize: '1rem',
          background: 'linear-gradient(180deg, #22c55e, #14532d)', color: 'white', textDecoration: 'none',
          boxShadow: '0 6px 0 #14532d', border: 'none',
          opacity: mostrarCta ? 1 : 0,
          transform: `translateX(-50%) translateY(${mostrarCta ? '0' : '12px'})`,
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          pointerEvents: mostrarCta ? 'auto' : 'none',
        }}
      >
        ✨ Crear cuenta gratis →
      </Link>
    </div>
  )
}
