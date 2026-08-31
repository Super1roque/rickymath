'use client'

import { useState } from 'react'
import { leerTexto } from '@/lib/guiaAudio'

// Botón 🔊 compartido por las guías interactivas — pide el audio al
// servidor (Deepgram, voz "olivia") y muestra un estado de carga mientras
// llega, ya que a diferencia de la voz del navegador esto sí tarda un poco
// (viaja por red). No depende de Firebase/auth.
export default function BotonEscuchar({ texto, tamano = 32 }: { texto: string; tamano?: number }) {
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle')

  async function handleClick() {
    if (estado === 'cargando') return
    setEstado('cargando')
    try {
      await leerTexto(texto)
      setEstado('idle')
    } catch (e) {
      console.error('No se pudo leer la pregunta en voz alta:', e)
      setEstado('error')
      setTimeout(() => setEstado('idle'), 1500)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={estado === 'cargando'}
      aria-label="Escuchar pregunta"
      style={{
        background: '#f0f9ff', border: '2px solid #bae6fd', borderRadius: tamano >= 34 ? 10 : 8,
        width: tamano, height: tamano, cursor: estado === 'cargando' ? 'default' : 'pointer',
        fontSize: tamano >= 34 ? '1.05rem' : '1rem', flexShrink: 0,
        opacity: estado === 'cargando' ? 0.6 : 1, transition: 'opacity 0.15s',
      }}
    >
      {estado === 'cargando' ? '⏳' : estado === 'error' ? '⚠️' : '🔊'}
    </button>
  )
}
