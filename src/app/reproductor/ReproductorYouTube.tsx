'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Ricky from '@/components/guia/Ricky'

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
// YouTube (watch?v=, youtu.be/, /embed/, /shorts/) — así quien comparta el
// link no tiene que acordarse de recortar la URL a mano.
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
    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)
    if (shortsMatch) return shortsMatch[1]
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
  const [tituloVideo, setTituloVideo] = useState<string | null>(null)
  const [errorVideo, setErrorVideo] = useState<number | null>(null)
  const [esVertical, setEsVertical] = useState(false)

  const videoId = extraerVideoId(searchParams.get('yt') ?? '')
  const ctaSegundo = Number(searchParams.get('cta')) || 10

  // El oEmbed de YouTube es público (sin API key) y con CORS habilitado
  // para el navegador — lo usamos para mostrar el título real del video
  // acá y en la pestaña. Esto es solo para lo que ve una persona real; la
  // miniatura/título que arma la vista previa al compartir el link la
  // resuelve por separado la Cloud Function compartirVideo (los bots no
  // ejecutan este JS).
  //
  // El mismo oEmbed también sirve para detectar un Short: para video
  // vertical YouTube devuelve height > width (p. ej. 113×200), a
  // diferencia de los 200×113 normales — pero solo si se consulta con
  // una URL en formato /shorts/{id}. Consultado como watch?v=, YouTube
  // siempre devuelve las dimensiones horizontales por defecto sin
  // importar la forma real del video, así que usamos /shorts/ siempre
  // (funciona igual de bien para videos normales).
  useEffect(() => {
    if (!videoId) return
    let cancelado = false
    fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/shorts/${videoId}`)}&format=json`)
      .then(r => (r.ok ? r.json() : null))
      .then(datos => {
        if (cancelado || !datos) return
        if (datos.title) {
          setTituloVideo(datos.title)
          document.title = `RickyMath te presenta este video: ${datos.title}`
        }
        if (typeof datos.width === 'number' && typeof datos.height === 'number') {
          setEsVertical(datos.height > datos.width)
        }
      })
      .catch(() => {})
    return () => { cancelado = true }
  }, [videoId])

  useEffect(() => {
    if (!videoId || !contenedorRef.current) return
    let intervalo: ReturnType<typeof setInterval>

    cargarApiYouTube().then(() => {
      if (!contenedorRef.current || !window.YT) return
      playerRef.current = new window.YT.Player(contenedorRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          // Códigos 101/150: el dueño del video (una liga, una
          // discográfica, etc.) bloqueó que se pueda insertar en otros
          // sitios — en vez de dejar que se vea el error crudo de
          // YouTube, mostramos nuestro propio mensaje y adelantamos el
          // CTA, ya que el visitante llegó igual a la página.
          onError: (e: { data: number }) => {
            setErrorVideo(e.data)
            setMostrarCta(true)
          },
        },
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
    <div style={{ width: '100%', maxWidth: esVertical ? 380 : 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h1 style={{
        color: 'white', fontWeight: 800, fontSize: '1.15rem', margin: 0, textAlign: 'center',
        textShadow: '2px 2px 0 #0c4a6e', lineHeight: 1.35,
      }}>
        {tituloVideo ? <>RickyMath te presenta este video: <span style={{ fontWeight: 700 }}>{tituloVideo}</span></> : 'RickyMath'}
      </h1>

      <div style={{
        position: 'relative', width: '100%', aspectRatio: esVertical ? '9 / 16' : '16 / 9',
        borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 0 rgba(0,0,0,0.25), 0 20px 40px rgba(0,0,0,0.4)',
        background: '#000',
      }}>
        <div ref={contenedorRef} style={{ width: '100%', height: '100%' }} />

        {errorVideo != null && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '0.9rem', padding: '1.5rem',
            textAlign: 'center', background: 'linear-gradient(160deg, #0c4a6e, #14532d)',
          }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>
              {errorVideo === 101 || errorVideo === 150
                ? 'El dueño de este video no permite reproducirlo acá.'
                : 'No pudimos cargar este video.'}
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gj-boton-3d"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.6rem 1.2rem', borderRadius: 999, fontWeight: 800, fontSize: '0.85rem',
                background: 'white', color: '#0f172a', textDecoration: 'none',
                boxShadow: '0 4px 0 #94a3b8',
                ['--gj-sombra' as string]: '#94a3b8',
              }}
            >
              ▶️ Ver en YouTube
            </a>
          </div>
        )}
      </div>

      {/* El CTA vive AFUERA del reproductor a propósito — así nunca tapa
          los controles ni la imagen del video en sí, y puede tener su
          propio diseño (Ricky, degradé de marca) sin pelear con el
          iframe de YouTube. */}
      <div
        aria-hidden={!mostrarCta}
        style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          background: 'linear-gradient(135deg, #14532d, #0c4a6e)',
          border: '2px solid rgba(255,255,255,0.15)',
          borderRadius: 20,
          boxShadow: '0 8px 0 rgba(0,0,0,0.25)',
          overflow: 'hidden',
          transition: 'opacity 0.45s ease, transform 0.45s ease, max-height 0.45s ease, padding 0.45s ease',
          opacity: mostrarCta ? 1 : 0,
          transform: mostrarCta ? 'translateY(0)' : 'translateY(10px)',
          maxHeight: mostrarCta ? 200 : 0,
          padding: mostrarCta ? '1rem 1.25rem' : '0 1.25rem',
        }}
      >
        <Ricky
          mood="waving"
          loop
          size={80}
          style={{ flexShrink: 0, filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.25))' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
            ¿Tu hijo domina las matemáticas de su grado?
          </p>
          <Link
            href="/test-nivel"
            className="gj-boton-3d"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1.1rem', borderRadius: 999, fontWeight: 800, fontSize: '0.88rem',
              background: 'linear-gradient(180deg, #22c55e, #15803d)', color: 'white', textDecoration: 'none',
              boxShadow: '0 4px 0 #15803d',
              ['--gj-sombra' as string]: '#15803d',
            }}
          >
            🧠 Hacé el test gratis
          </Link>
        </div>
      </div>
    </div>
  )
}
