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

// ── Datos de la actividad (basados en la hoja "Actividad 3 - Mayor, Menor o Igual") ──
// Cantidades y signo correcto confirmados a mano por el usuario mirando la
// hoja original (zanahorias corregidas a 5).

type Signo = '>' | '<' | '='

function explicarComparacion(nombreA: string, cantidadA: number, nombreB: string, cantidadB: number, correcta: Signo): string {
  const relacion = correcta === '>' ? 'más que' : correcta === '<' ? 'menos que' : 'igual que'
  const nombreSigno = correcta === '>' ? 'mayor que' : correcta === '<' ? 'menor que' : 'igual'
  return `Hay ${cantidadA} ${nombreA.toLowerCase()} y ${cantidadB} ${nombreB.toLowerCase()}. Como ${cantidadA} es ${relacion} ${cantidadB}, el signo correcto es ${nombreSigno}.`
}

interface PreguntaComparar {
  numero: number
  nombreA: string
  emojiA: string
  cantidadA: number
  nombreB: string
  emojiB: string
  cantidadB: number
  correcta: Signo
  explicacion: string
}

const ITEMS: PreguntaComparar[] = [
  {
    numero: 1, nombreA: 'Diamantes', emojiA: '💎', cantidadA: 3, nombreB: 'Esmeraldas', emojiB: '🟢', cantidadB: 4,
    correcta: '<', explicacion: explicarComparacion('Diamantes', 3, 'Esmeraldas', 4, '<'),
  },
  {
    numero: 2, nombreA: 'Espadas', emojiA: '⚔️', cantidadA: 2, nombreB: 'Picos', emojiB: '⛏️', cantidadB: 3,
    correcta: '<', explicacion: explicarComparacion('Espadas', 2, 'Picos', 3, '<'),
  },
  {
    numero: 3, nombreA: 'Bloques de oro', emojiA: '🟨', cantidadA: 5, nombreB: 'Bloques de hierro', emojiB: '⬜', cantidadB: 4,
    correcta: '>', explicacion: explicarComparacion('Bloques de oro', 5, 'Bloques de hierro', 4, '>'),
  },
  {
    numero: 4, nombreA: 'Manzanas doradas', emojiA: '🍏', cantidadA: 4, nombreB: 'Zanahorias', emojiB: '🥕', cantidadB: 5,
    correcta: '<', explicacion: explicarComparacion('Manzanas doradas', 4, 'Zanahorias', 5, '<'),
  },
  {
    numero: 5, nombreA: 'Creepers', emojiA: '👾', cantidadA: 3, nombreB: 'Aldeanos', emojiB: '🧑‍🌾', cantidadB: 4,
    correcta: '<', explicacion: explicarComparacion('Creepers', 3, 'Aldeanos', 4, '<'),
  },
  {
    numero: 6, nombreA: 'Antorchas', emojiA: '🔥', cantidadA: 4, nombreB: 'Redstone', emojiB: '🔴', cantidadB: 5,
    correcta: '<', explicacion: explicarComparacion('Antorchas', 4, 'Redstone', 5, '<'),
  },
]

const TOTAL_PREGUNTAS = ITEMS.length

const OPCIONES: { valor: Signo; label: string }[] = [
  { valor: '>', label: '>' },
  { valor: '<', label: '<' },
  { valor: '=', label: '=' },
]

// ── Bloque de estado ──

interface EstadoComparar {
  seleccion: Signo | null
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoComparar = { seleccion: null, evaluado: false, correcto: false }

export default function PrimeroModulo03() {
  const [comparar, setComparar] = useState<Record<number, EstadoComparar>>(() =>
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

  const totalCorrectas = useMemo(() => Object.values(comparar).filter(e => e.evaluado && e.correcto).length, [comparar])
  const totalEvaluadas = useMemo(() => Object.values(comparar).filter(e => e.evaluado).length, [comparar])
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

  function elegirSigno(p: PreguntaComparar, opcion: Signo) {
    const actual = comparar[p.numero]
    if (actual.evaluado) return
    const correcto = opcion === p.correcta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setComparar(prev => ({ ...prev, [p.numero]: { seleccion: opcion, evaluado: true, correcto } }))
  }

  function reiniciar() {
    setComparar(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #818cf8 0%, #c7d2fe 35%, #fef9c3 100%)',
      color: '#312e81', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #6366f1, #4338ca)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #312e81', borderBottom: '4px solid #312e81',
      }}>
        <BotonMenu href="/primero-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>⚖️💎</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #312e81', margin: 0, color: 'white',
        }}>
          ¡Mayor, menor o igual!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Compará las cantidades y elegí el signo correcto
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#6366f1" />
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaComparar key={p.numero} p={p} estado={comparar[p.numero]} color={COLORES[i % COLORES.length]}
              onElegir={opcion => elegirSigno(p, opcion)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(49,46,129,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#312e81' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#4338ca' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Sabés comparar cantidades muy bien 🎮'
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

function TarjetaComparar({ p, estado, color, onElegir, onExplicarEstado }: {
  p: PreguntaComparar
  estado: EstadoComparar
  color: string
  onElegir: (opcion: Signo) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.4rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, flex: 1, minWidth: 0, textAlign: 'center', color: '#312e81', overflowWrap: 'break-word' }}>
          {p.nombreA} vs {p.nombreB}
        </p>
        <BotonEscuchar texto={`¿Hay más ${p.nombreA.toLowerCase()} o más ${p.nombreB.toLowerCase()}?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem' }}>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.1rem', fontSize: '1.5rem', minHeight: '3.2rem' }}>
            {Array.from({ length: p.cantidadA }, (_, i) => <span key={i}>{p.emojiA}</span>)}
          </div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.7, margin: '0.2rem 0 0' }}>{p.nombreA}</p>
        </div>
        <div style={{ width: 2, background: `${color}33`, borderRadius: 2 }} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.1rem', fontSize: '1.5rem', minHeight: '3.2rem' }}>
            {Array.from({ length: p.cantidadB }, (_, i) => <span key={i}>{p.emojiB}</span>)}
          </div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.7, margin: '0.2rem 0 0' }}>{p.nombreB}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem' }}>
        {OPCIONES.map(o => {
          const esElegida = estado.seleccion === o.valor
          const esLaCorrecta = estado.evaluado && o.valor === p.correcta
          let bg = '#eef2ff'
          let borde = '#c7d2fe'
          let textColor = '#312e81'
          if (estado.evaluado) {
            if (esElegida && estado.correcto) { bg = '#dcfce7'; borde = '#22c55e'; textColor = '#16a34a' }
            else if (esElegida && !estado.correcto) { bg = '#fee2e2'; borde = '#ef4444'; textColor = '#dc2626' }
            else if (esLaCorrecta) { bg = '#dcfce7'; borde = '#86efac'; textColor = '#16a34a' }
          }
          return (
            <button key={o.valor} onClick={() => onElegir(o.valor)} disabled={estado.evaluado} style={{
              flex: 1, minWidth: 0, padding: '0.6rem 0.2rem', borderRadius: 10, border: `2px solid ${borde}`,
              background: bg, color: textColor, fontWeight: 800, fontSize: '1.3rem',
              cursor: estado.evaluado ? 'default' : 'pointer',
            }}>
              {o.label}
            </button>
          )
        })}
      </div>

      {estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}>
          <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
        </div>
      )}
    </div>
  )
}
