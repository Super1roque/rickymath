'use client'

import { useState } from 'react'
import { leerTexto } from '@/lib/guiaAudio'
import { useExplosion } from './ExplosionContext'

// Botón "💡 Explicar" — aparece recién después de responder una pregunta
// (correcta o no) y lee en voz alta una explicación corta del método para
// resolverla, reusando el mismo pipeline de audio que BotonEscuchar
// (Deepgram, con estado de carga). Es la versión "pedile una explicación"
// en vez de "leeme la pregunta". También festeja con la explosión al
// tocarlo, clonando el 💡 (la explicación en sí es muy larga para clonar).
export default function BotonExplicar({ texto, onEstadoCambia }: {
  texto: string
  // Opcional: para módulos que quieran reflejar la carga/error en algo más
  // (p. ej. el mood de la mascota Ricky). No pasa nada si se omite.
  onEstadoCambia?: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const [estado, setEstadoInterno] = useState<'idle' | 'cargando' | 'error'>('idle')
  const disparar = useExplosion()
  function setEstado(nuevo: 'idle' | 'cargando' | 'error') {
    setEstadoInterno(nuevo)
    onEstadoCambia?.(nuevo)
  }

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (estado === 'cargando') return
    disparar('💡', e.currentTarget.getBoundingClientRect())
    setEstado('cargando')
    try {
      await leerTexto(texto)
      setEstado('idle')
    } catch (err) {
      console.error('No se pudo leer la explicación:', err)
      setEstado('error')
      setTimeout(() => setEstado('idle'), 1500)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={estado === 'cargando'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        background: '#fef9c3', border: '2px solid #fde047', borderRadius: 999,
        padding: '0.35rem 0.7rem', fontSize: '0.8rem', fontWeight: 700, color: '#854d0e',
        cursor: estado === 'cargando' ? 'default' : 'pointer',
        opacity: estado === 'cargando' ? 0.6 : 1, transition: 'opacity 0.15s',
      }}
    >
      {estado === 'cargando' ? '⏳' : estado === 'error' ? '⚠️' : '💡'} Explicar
    </button>
  )
}
