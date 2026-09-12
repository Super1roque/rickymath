'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayer {
  getCurrentTime: () => number
  destroy: () => void
}

// Acepta un ID puro ("GDnr04Qd6cU") o cualquier formato de URL común de
// YouTube (watch?v=, youtu.be/, /embed/) — así quien comparta el link no
// tiene que acordarse de recortar la URL a mano.
function extraerVideoId(input: string): string | null {
  const limpio = input.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(limpio)) return limpio
  try {
    const url = new URL(limpio)
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1) || null
    const v = url.searchParams.get('v')
    if (v) return v
    const match = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/)
    if (match) return match[1]
  } catch {
    return null
  }
  return null
}

let apiCargada: Promise<void> | null = null
function cargarApiYouTube(): Promise<void> {
  if (apiCargada) return apiCargada
  apiCargada = new Promise(resolve => {
    if (window.YT?.Player) { resolve(); return }
    window.onYouTubeIframeAPIReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiCargada
}

export default function ReproductorYouTube() {
  const searchParams = useSearchParams()
  const contenedorRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [mostrarCta, setMostrarCta] = useState(false)

  const videoId = extraerVideoId(searchParams.get('yt') ?? '')
  const ctaSegundo = Number(searchParams.get('cta')) || 10

  useEffect(() => {
    if (!videoId || !contenedorRef.current) return
    let intervalo: ReturnType<typeof setInterval>

    cargarApiYouTube().then(() => {
      if (!contenedorRef.current || !window.YT) return
      playerRef.current = new window.YT.Player(contenedorRef.current, {
        videoId,
        playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1 },
      })
      intervalo = setInterval(() => {
        const t = playerRef.current?.getCurrentTime()
        if (typeof t === 'number') setMostrarCta(t >= ctaSegundo)
      }, 400)
    })

    return () => {
      clearInterval(intervalo)
      playerRef.current?.destroy()
    }
  }, [videoId, ctaSegundo])

  if (!videoId) {
    return (
      <p style={{ color: 'white', textAlign: 'center', maxWidth: 420, fontWeight: 700 }}>
        Falta el video — agregá <code>?yt=ID_O_URL_DE_YOUTUBE</code> a la URL.
      </p>
    )
  }

  return (
    <div style={{
      position: 'relative', width: '100%', maxWidth: 640, margin: '0 auto', aspectRatio: '16 / 9',
      borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 0 rgba(0,0,0,0.25), 0 20px 40px rgba(0,0,0,0.4)',
      background: '#000',
    }}>
      <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />

      <Link
        href="/signup"
        style={{
          position: 'absolute', left: '50%', bottom: '1.5rem',
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
