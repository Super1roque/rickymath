'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Ricky, { type RickyMood } from '@/components/guia/Ricky'
import { trackMetaPixel } from '@/lib/metaPixel'
import { GRADOS, PREGUNTAS_POR_GRADO } from './preguntas'

type Paso = { tipo: 'grado' } | { tipo: 'quiz'; grado: number } | { tipo: 'resultado'; grado: number; respuestas: number[] }

const botonStyle: React.CSSProperties = {
  fontFamily: 'inherit', cursor: 'pointer', border: 'none',
}

export default function TestNivel() {
  const [paso, setPaso] = useState<Paso>({ tipo: 'grado' })

  if (paso.tipo === 'grado') {
    return <PantallaGrado onElegir={grado => setPaso({ tipo: 'quiz', grado })} />
  }
  if (paso.tipo === 'quiz') {
    return (
      <PantallaQuiz
        grado={paso.grado}
        onTerminar={respuestas => setPaso({ tipo: 'resultado', grado: paso.grado, respuestas })}
      />
    )
  }
  return <PantallaResultado grado={paso.grado} respuestas={paso.respuestas} onReintentar={() => setPaso({ tipo: 'grado' })} />
}

function PantallaGrado({ onElegir }: { onElegir: (grado: number) => void }) {
  return (
    <div style={{ width: '100%', maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <Ricky mood="waving" loop size={110} />
      <h1 style={{ color: 'white', fontWeight: 800, fontSize: '1.5rem', margin: 0, textShadow: '2px 2px 0 #0c4a6e' }}>
        ¿Tu hijo sabe lo que le toca en su grado?
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
        Un test de 6 preguntas, 2 minutos — elegí el grado
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', width: '100%' }}>
        {GRADOS.map(g => (
          <button
            key={g.numero}
            onClick={() => onElegir(g.numero)}
            className="gj-boton-3d"
            style={{
              ...botonStyle,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
              padding: '1.1rem 0.5rem', borderRadius: 18, fontWeight: 800, fontSize: '0.95rem',
              background: `linear-gradient(180deg, ${g.color}, ${g.colorOscuro})`, color: 'white',
              boxShadow: `0 5px 0 ${g.colorOscuro}`,
              ['--gj-sombra' as string]: g.colorOscuro,
            }}
          >
            <span style={{ fontSize: '1.6rem' }}>{g.emoji}</span>
            {g.nombre}
          </button>
        ))}
      </div>
    </div>
  )
}

function PantallaQuiz({ grado, onTerminar }: { grado: number; onTerminar: (respuestas: number[]) => void }) {
  const preguntas = PREGUNTAS_POR_GRADO[grado]
  const [indice, setIndice] = useState(0)
  const [respuestas, setRespuestas] = useState<number[]>([])
  const [seleccion, setSeleccion] = useState<number | null>(null)

  const pregunta = preguntas[indice]
  const gradoInfo = GRADOS.find(g => g.numero === grado)!

  function elegir(opcionIdx: number) {
    if (seleccion !== null) return
    setSeleccion(opcionIdx)
    const nuevasRespuestas = [...respuestas, opcionIdx]
    setTimeout(() => {
      if (indice + 1 < preguntas.length) {
        setRespuestas(nuevasRespuestas)
        setIndice(indice + 1)
        setSeleccion(null)
      } else {
        onTerminar(nuevasRespuestas)
      }
    }, 550)
  }

  return (
    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ color: 'white', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {indice + 1} / {preguntas.length}
        </span>
        <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${((indice + (seleccion !== null ? 1 : 0)) / preguntas.length) * 100}%`,
            background: gradoInfo.color, transition: 'width 0.3s ease', borderRadius: 999,
          }} />
        </div>
      </div>

      <div style={{
        background: 'rgba(15, 23, 42, 0.55)', borderRadius: 24, padding: '1.75rem 1.5rem',
        boxShadow: '0 12px 0 rgba(0,0,0,0.25), 0 20px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
      }}>
        <p style={{ color: 'white', fontWeight: 800, fontSize: '1.15rem', textAlign: 'center', margin: '0 0 1.5rem', lineHeight: 1.4 }}>
          {pregunta.texto}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {pregunta.opciones.map((op, i) => {
            const esCorrecta = i === pregunta.correcta
            const esElegida = i === seleccion
            let fondo = 'rgba(255,255,255,0.12)'
            if (seleccion !== null && esCorrecta) fondo = 'linear-gradient(180deg, #22c55e, #15803d)'
            else if (seleccion !== null && esElegida) fondo = 'linear-gradient(180deg, #ef4444, #b91c1c)'
            return (
              <button
                key={i}
                onClick={() => elegir(i)}
                disabled={seleccion !== null}
                style={{
                  ...botonStyle,
                  padding: '0.9rem 0.5rem', borderRadius: 14, fontWeight: 800, fontSize: '1rem',
                  background: fondo, color: 'white', transition: 'background 0.2s ease',
                }}
              >
                {op}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PantallaResultado({ grado, respuestas, onReintentar }: { grado: number; respuestas: number[]; onReintentar: () => void }) {
  const preguntas = PREGUNTAS_POR_GRADO[grado]
  const gradoInfo = GRADOS.find(g => g.numero === grado)!
  const correctas = respuestas.filter((r, i) => r === preguntas[i].correcta).length

  const habilidadesFlojas = Array.from(new Set(
    preguntas.filter((p, i) => respuestas[i] !== p.correcta).map(p => p.habilidad),
  ))

  const porcentaje = Math.round((correctas / preguntas.length) * 100)
  const bien = correctas >= preguntas.length * 0.8

  // Se dispara una sola vez al montar esta pantalla — señal de interés
  // genuino para armar audiencias de remarketing en Meta después,
  // separado del evento de registro real.
  useEffect(() => {
    trackMetaPixel('Lead', { content_name: 'test_nivel', grado: gradoInfo.nombre, puntaje: correctas })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mood: RickyMood = bien ? 'celebrating' : 'encouraging'

  return (
    <div style={{ width: '100%', maxWidth: 460, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <Ricky mood={mood} loop size={110} />
      <h1 style={{ color: 'white', fontWeight: 800, fontSize: '1.4rem', margin: 0, textShadow: '2px 2px 0 #0c4a6e' }}>
        {correctas} de {preguntas.length} correctas
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
        Domina el {porcentaje}% de lo esperado para {gradoInfo.nombre} grado
      </p>

      {habilidadesFlojas.length > 0 ? (
        <div style={{
          background: 'rgba(0,0,0,0.25)', borderRadius: 18, padding: '1rem 1.25rem', width: '100%',
          textAlign: 'left', fontSize: '0.88rem', color: 'white',
        }}>
          <p style={{ margin: '0 0 0.4rem', fontWeight: 700, opacity: 0.85 }}>Le vendría bien reforzar:</p>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {habilidadesFlojas.map(h => <li key={h} style={{ marginBottom: '0.2rem' }}>{h}</li>)}
          </ul>
        </div>
      ) : (
        <p style={{ color: 'white', fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>
          ¡Domina todo lo de este grado! Con más práctica, mejor se le queda.
        </p>
      )}

      <Link
        href="/signup"
        className="gj-boton-3d"
        style={{
          ...botonStyle, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none',
          marginTop: '0.5rem', padding: '0.95rem 1.6rem', borderRadius: 999, fontWeight: 800, fontSize: '1rem',
          background: 'linear-gradient(180deg, #22c55e, #14532d)', color: 'white',
          boxShadow: '0 6px 0 #14532d', ['--gj-sombra' as string]: '#14532d',
        }}
      >
        ✨ Practicar esto jugando en RickyMath
      </Link>
      {grado === 1 ? (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', margin: 0 }}>Primero grado es gratis para siempre</p>
      ) : (
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', margin: 0 }}>Primero grado y Tablas son gratis — el resto, un solo pago de L. 350</p>
      )}

      <button
        onClick={onReintentar}
        style={{ ...botonStyle, background: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'underline', marginTop: '0.5rem' }}
      >
        Probar con otro grado
      </button>
    </div>
  )
}
