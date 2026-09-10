'use client'

import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'

// Efecto de festejo en 3 fases para una respuesta correcta:
// 1) el texto del botón se clona y viaja al centro de pantalla creciendo
//    hasta volverse gigante (~400ms, easing elástico tipo "shockwave").
// 2) al llegar arriba, "estalla" en decenas de partículas de colores con
//    física simple (velocidad + fricción + gravedad leve) dibujadas en un
//    <canvas> a pantalla completa.
// 3) las partículas se van desvaneciendo hasta volver todo a la normalidad,
//    ~2s en total desde el click.
// Se expone vía ref (disparar) en vez de props, porque cada tarjeta de
// pregunta necesita pasarle la posición EXACTA del botón que se tocó
// (getBoundingClientRect) en el momento del click.

export interface ExplosionHandle {
  disparar: (texto: string, origen: DOMRect) => void
}

interface Particula { x: number; y: number; vx: number; vy: number; color: string; radio: number }

const COLORES = ['#f97316', '#ec4899', '#8b5cf6', '#0ea5e9', '#22c55e', '#eab308', '#14b8a6', '#f43f5e', '#a855f7', '#facc15']
const N_PARTICULAS = 140
const FRICCION = 0.97
const GRAVEDAD = 0.16
const DURACION_VUELO_MS = 400
const DURACION_PARTICULAS_MS = 1400 // + los 400ms del vuelo ≈ 1.8-2s total

const Explosion = forwardRef<ExplosionHandle>(function Explosion(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cloneRef = useRef<HTMLDivElement>(null)
  const animandoRef = useRef(false)

  const disparar = useCallback((texto: string, origen: DOMRect) => {
    if (animandoRef.current) return // un festejo a la vez, no se solapan
    const clone = cloneRef.current
    const canvas = canvasRef.current
    if (!clone || !canvas) return
    animandoRef.current = true

    const vw = window.innerWidth
    const vh = window.innerHeight

    // Fase 1: el clon arranca exactamente sobre el botón tocado...
    clone.textContent = texto
    clone.style.transition = 'none'
    clone.style.left = `${origen.left + origen.width / 2}px`
    clone.style.top = `${origen.top + origen.height / 2}px`
    clone.style.transform = 'translate(-50%, -50%) scale(1)'
    clone.style.opacity = '1'
    void clone.offsetWidth // fuerza reflow — sin esto el navegador fusiona este estado con el de abajo y no anima nada

    // ...y viaja al centro agrandándose, con un leve "overshoot" elástico.
    requestAnimationFrame(() => {
      clone.style.transition =
        `left ${DURACION_VUELO_MS}ms cubic-bezier(.34,1.56,.64,1), ` +
        `top ${DURACION_VUELO_MS}ms cubic-bezier(.34,1.56,.64,1), ` +
        `transform ${DURACION_VUELO_MS}ms cubic-bezier(.34,1.56,.64,1)`
      clone.style.left = `${vw / 2}px`
      clone.style.top = `${vh / 2}px`
      clone.style.transform = 'translate(-50%, -50%) scale(7)'
    })

    // Fase 2: al llegar al punto máximo, el clon desaparece y estalla.
    setTimeout(() => {
      clone.style.transition = 'opacity 80ms ease'
      clone.style.opacity = '0'

      canvas.width = vw
      canvas.height = vh
      const ctx = canvas.getContext('2d')
      if (!ctx) { animandoRef.current = false; return }

      const cx = vw / 2
      const cy = vh / 2
      const particulas: Particula[] = Array.from({ length: N_PARTICULAS }, () => {
        const angulo = Math.random() * Math.PI * 2
        const velocidad = 3 + Math.random() * 11
        return {
          x: cx, y: cy,
          vx: Math.cos(angulo) * velocidad,
          vy: Math.sin(angulo) * velocidad,
          color: COLORES[Math.floor(Math.random() * COLORES.length)],
          radio: 2 + Math.random() * 4.5,
        }
      })

      const inicio = performance.now()

      function cuadro(ahora: number) {
        const t = ahora - inicio
        const vida = Math.max(0, 1 - t / DURACION_PARTICULAS_MS)
        ctx!.clearRect(0, 0, vw, vh)

        if (vida > 0) {
          for (const p of particulas) {
            p.vx *= FRICCION
            p.vy = p.vy * FRICCION + GRAVEDAD
            p.x += p.vx
            p.y += p.vy
          }
          ctx!.globalAlpha = vida
          for (const p of particulas) {
            ctx!.fillStyle = p.color
            ctx!.beginPath()
            ctx!.arc(p.x, p.y, p.radio, 0, Math.PI * 2)
            ctx!.fill()
          }
          ctx!.globalAlpha = 1
          requestAnimationFrame(cuadro)
        } else {
          animandoRef.current = false
        }
      }
      requestAnimationFrame(cuadro)
    }, DURACION_VUELO_MS)
  }, [])

  useImperativeHandle(ref, () => ({ disparar }), [disparar])

  return (
    <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div ref={cloneRef} style={{
        position: 'fixed', fontWeight: 900, fontSize: '1.4rem', color: 'white',
        textShadow: '0 0 14px rgba(0,0,0,0.45), 2px 2px 0 rgba(0,0,0,0.3)',
        opacity: 0, whiteSpace: 'nowrap', willChange: 'transform, left, top, opacity',
      }} />
    </div>
  )
})

export default Explosion
