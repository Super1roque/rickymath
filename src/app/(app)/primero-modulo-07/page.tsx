'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { reproducirCorrecto, reproducirIncorrecto, reproducirFanfarria } from '@/lib/guiaAudio'
import { fuenteJuego, COLORES_TARJETAS as COLORES } from '@/lib/fuenteJuego'
import BotonEscuchar from '@/components/guia/BotonEscuchar'
import BotonExplicar from '@/components/guia/BotonExplicar'
import BotonMenu from '@/components/guia/BotonMenu'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Confetti from '@/components/guia/Confetti'
import BarraProgreso from '@/components/guia/BarraProgreso'
import Ricky, { type RickyMood } from '@/components/guia/Ricky'

// ── Datos de la actividad (basados en la hoja "Actividad 7 - Largo o Corto") ──
// En las 6 filas el objeto de la izquierda (A) es el más largo — confirmado
// a mano por el usuario mirando la hoja original. Sin fotos reales, cada
// objeto se representa como una barra horizontal (ancho = largo relativo).

type Opcion = 'A' | 'B'

interface PreguntaLargo {
  numero: number
  nombre: string
  emoji: string
  anchoA: number
  anchoB: number
  correcta: Opcion
  explicacion: string
}

// El lado que muestra la barra larga varía por tarjeta (a veces A/izquierda,
// a veces B/derecha) para que no se pueda responder siempre "el mismo lado"
// sin mirar — mismo criterio que el orden desordenado del módulo 2.
const ITEMS: PreguntaLargo[] = [
  {
    numero: 1, nombre: 'Puentes de bloques', emoji: '🌉', anchoA: 35, anchoB: 100, correcta: 'B',
    explicacion: 'El puente de la derecha es mucho más largo — se extiende de punta a punta, mientras que el de la izquierda es una plataforma chica.',
  },
  {
    numero: 2, nombre: 'Caminos de Redstone', emoji: '🔴', anchoA: 100, anchoB: 38, correcta: 'A',
    explicacion: 'El camino de redstone de la izquierda es más largo — tiene más bloques en fila que el de la derecha.',
  },
  {
    numero: 3, nombre: 'Vallas de madera', emoji: '🚧', anchoA: 100, anchoB: 33, correcta: 'A',
    explicacion: 'La valla de la izquierda es más larga — tiene más postes en fila que la de la derecha.',
  },
  {
    numero: 4, nombre: 'Filas de melones', emoji: '🍉', anchoA: 22, anchoB: 100, correcta: 'B',
    explicacion: 'La fila de melones de la derecha es más larga — son varios melones en fila, mientras que a la izquierda hay uno solo.',
  },
  {
    numero: 5, nombre: 'Caminos de losas de piedra', emoji: '🪨', anchoA: 38, anchoB: 100, correcta: 'B',
    explicacion: 'El camino de losas de la derecha es más largo — tiene más losas en fila que el de la izquierda.',
  },
  {
    numero: 6, nombre: 'Troncos de roble', emoji: '🪵', anchoA: 100, anchoB: 25, correcta: 'A',
    explicacion: 'El tronco de la izquierda es más largo — el de la derecha es solo un pedacito chico.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length

// ── Bloque de estado ──

interface EstadoLargo {
  seleccion: Opcion | null
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoLargo = { seleccion: null, evaluado: false, correcto: false }

export default function PrimeroModulo07() {
  const [largos, setLargos] = useState<Record<number, EstadoLargo>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])),
  )
  const fanfarriaSonada = useRef(false)

  const [puntos, setPuntos] = useState(0)
  const [racha, setRacha] = useState(0)
  const [mejorRacha, setMejorRacha] = useState(0)

  // Ricky: UNA sola presencia en pantalla (regla del handoff de diseño —
  // nunca dos Rickys a la vez). Saluda al entrar (Wave ×2), después queda
  // respirando (Breathe/Idle) hasta que hay algo que reaccionar: rebota
  // feliz en un acierto, hace un pequeño Shake (confundido) en un error,
  // piensa mientras carga un "Explicar", y termina festejando (Bounce en
  // loop) si el módulo se completó perfecto.
  const [rickyMood, setRickyMood] = useState<RickyMood>('waving')
  const terminadoRef = useRef(false)
  const rickyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setRickyMood('idle'), 2 * 2400)
    return () => clearTimeout(id)
  }, [])

  function reaccionarRicky(correcto: boolean) {
    setRickyMood(correcto ? 'happy' : 'confused')
    if (rickyTimeout.current) clearTimeout(rickyTimeout.current)
    rickyTimeout.current = setTimeout(() => {
      if (!terminadoRef.current) setRickyMood('idle')
    }, correcto ? 1300 : 1150)
  }

  function reaccionarRickyExplicar(estadoBoton: 'idle' | 'cargando' | 'error') {
    if (terminadoRef.current) return
    if (rickyTimeout.current) clearTimeout(rickyTimeout.current)
    if (estadoBoton === 'cargando') {
      setRickyMood('thinking')
    } else if (estadoBoton === 'error') {
      setRickyMood('oops')
      rickyTimeout.current = setTimeout(() => { if (!terminadoRef.current) setRickyMood('idle') }, 1500)
    } else {
      setRickyMood('idle')
    }
  }

  function registrarResultado(correcto: boolean) {
    if (correcto) {
      const nuevaRacha = racha + 1
      const ganados = 10 + Math.min(nuevaRacha - 1, 8) * 2
      setRacha(nuevaRacha)
      setMejorRacha(m => Math.max(m, nuevaRacha))
      setPuntos(pt => pt + ganados)
    } else {
      setRacha(0)
    }
  }

  const totalCorrectas = useMemo(() => Object.values(largos).filter(e => e.evaluado && e.correcto).length, [largos])
  const totalEvaluadas = useMemo(() => Object.values(largos).filter(e => e.evaluado).length, [largos])
  const terminado = totalEvaluadas === TOTAL_PREGUNTAS

  if (terminado && !fanfarriaSonada.current) {
    fanfarriaSonada.current = true
    if (totalCorrectas >= TOTAL_PREGUNTAS - 1) setTimeout(reproducirFanfarria, 150)
  }

  useEffect(() => {
    terminadoRef.current = terminado
    if (terminado) {
      setRickyMood(totalCorrectas === TOTAL_PREGUNTAS ? 'celebrating' : totalCorrectas >= TOTAL_PREGUNTAS - 2 ? 'happy' : 'encouraging')
    }
  }, [terminado, totalCorrectas])

  function elegirOpcion(p: PreguntaLargo, opcion: Opcion) {
    const actual = largos[p.numero]
    if (actual.evaluado) return
    const correcto = opcion === p.correcta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setLargos(prev => ({ ...prev, [p.numero]: { seleccion: opcion, evaluado: true, correcto } }))
  }

  function reiniciar() {
    setLargos(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
    fanfarriaSonada.current = false
    setPuntos(0)
    setRacha(0)
    setMejorRacha(0)
    if (rickyTimeout.current) clearTimeout(rickyTimeout.current)
    setRickyMood('waving')
    setTimeout(() => setRickyMood('idle'), 2 * 2400)
  }

  return (
    <div className={fuenteJuego.className} style={{
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #38bdf8 0%, #bae6fd 35%, #fef9c3 100%)',
      color: '#0c4a6e', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #0ea5e9, #0369a1)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #0c4a6e', borderBottom: '4px solid #0c4a6e',
      }}>
        <BotonMenu href="/primero-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>📏🌉</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #0c4a6e', margin: 0, color: 'white',
        }}>
          ¡Largo o corto!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Compará los objetos y marcá cuál es más largo
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <span style={{
            fontWeight: 800, fontSize: '1.15rem', whiteSpace: 'nowrap', background: '#fef08a', color: '#854d0e',
            padding: '0.4rem 0.9rem', borderRadius: 999, border: '2px solid #facc15',
          }}>
            ⭐ {puntos}
          </span>
          <span style={{
            fontWeight: 800, fontSize: '1.15rem', whiteSpace: 'nowrap', display: 'inline-block',
            background: '#fecdd3', color: '#9f1239', padding: '0.4rem 0.9rem', borderRadius: 999,
            border: '2px solid #fb7185',
            animation: racha >= 3 ? 'gj-pulso 0.7s ease-in-out infinite' : undefined,
          }}>
            🔥 {racha}
          </span>
          <div style={{ flex: 1, minWidth: 110 }}>
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#0ea5e9" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {ITEMS.map((p, i) => (
            <TarjetaLargo key={p.numero} p={p} estado={largos[p.numero]} color={COLORES[i % COLORES.length]}
              onElegir={opcion => elegirOpcion(p, opcion)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(12,74,110,0.15))' }}
          >
            <Ricky mood={rickyMood} loop={rickyMood === 'confused' ? 2 : undefined} size={140} />
          </div>
        )}

        {terminado && (
          <div style={{
            marginTop: '2rem', textAlign: 'center', background: 'white',
            border: '3px solid #fbbf24', boxShadow: '0 5px 0 rgba(180,83,9,0.2)', borderRadius: 20, padding: '1.75rem 1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Ricky mood={rickyMood} loop={rickyMood === 'celebrating'} size={160} />
            </div>
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#0c4a6e' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0369a1' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Distinguís muy bien largo y corto 🎮'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi lo dominás.'
                : 'Seguí practicando, ¡vas a mejorar!'}
            </p>
            <button onClick={reiniciar} style={{
              padding: '0.9rem 2rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: '#22c55e', boxShadow: '0 4px 0 #15803d', color: 'white', fontWeight: 800, fontSize: '1.1rem',
            }}>
              🔄 Jugar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function BarraObjeto({ ancho, emoji, color }: { ancho: number; emoji: string; color: string }) {
  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
      <div style={{
        width: `${ancho}%`, minWidth: 28, height: 28, borderRadius: 8,
        background: color, display: 'flex', alignItems: 'center', paddingLeft: 4,
        boxShadow: `0 2px 0 ${color}99`, fontSize: '1rem',
      }}>
        {emoji}
      </div>
    </div>
  )
}

function TarjetaLargo({ p, estado, color, onElegir, onExplicarEstado }: {
  p: PreguntaLargo
  estado: EstadoLargo
  color: string
  onElegir: (opcion: Opcion) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

  function estiloOpcion(opcion: Opcion) {
    const esElegida = estado.seleccion === opcion
    const esLaCorrecta = estado.evaluado && opcion === p.correcta
    let borde = '#bae6fd'
    let bg = '#f0f9ff'
    if (estado.evaluado) {
      if (esElegida && estado.correcto) { borde = '#22c55e'; bg = '#dcfce7' }
      else if (esElegida && !estado.correcto) { borde = '#ef4444'; bg = '#fee2e2' }
      else if (esLaCorrecta) { borde = '#86efac'; bg = '#dcfce7' }
    }
    return { borde, bg }
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem', gap: '0.4rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, flex: 1, minWidth: 0, textAlign: 'center', color: '#0c4a6e', overflowWrap: 'break-word' }}>{p.nombre}</p>
        <BotonEscuchar texto={`¿Cuál de estos ${p.nombre.toLowerCase()} es más largo?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.6rem' }}>
        {(['A', 'B'] as Opcion[]).map(opcion => {
          const { borde, bg } = estiloOpcion(opcion)
          const ancho = opcion === 'A' ? p.anchoA : p.anchoB
          return (
            <button
              key={opcion}
              onClick={() => onElegir(opcion)}
              disabled={estado.evaluado}
              style={{
                flex: 1, minWidth: 0, padding: '0.7rem 0.6rem', borderRadius: 12, border: `2px solid ${borde}`,
                background: bg, cursor: estado.evaluado ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', gap: '0.4rem',
              }}
            >
              <BarraObjeto ancho={ancho} emoji={p.emoji} color={color} />
            </button>
          )
        })}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ No era ese'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
