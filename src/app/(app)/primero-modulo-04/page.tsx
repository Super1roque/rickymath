'use client'

import { useEffect, useMemo, useState, useRef, type KeyboardEvent } from 'react'
import { reproducirCorrecto, reproducirIncorrecto, reproducirFanfarria } from '@/lib/guiaAudio'
import { fuenteJuego, COLORES_TARJETAS as COLORES } from '@/lib/fuenteJuego'
import BotonEscuchar from '@/components/guia/BotonEscuchar'
import BotonExplicar from '@/components/guia/BotonExplicar'
import BotonMenu from '@/components/guia/BotonMenu'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Confetti from '@/components/guia/Confetti'
import BarraProgreso from '@/components/guia/BarraProgreso'
import Ricky, { type RickyMood } from '@/components/guia/Ricky'

// ── Datos de la actividad (basados en la hoja "Actividad 4 - Sumar con Bloques") ──
// Cantidades de cada grupo confirmadas a mano por el usuario mirando la
// hoja original (bloques de arena corregidos a 4 + 3).

interface PreguntaSumar {
  numero: number
  nombre: string
  emoji: string
  a: number
  b: number
  explicacion: string
}

function explicarSuma(nombre: string, a: number, b: number): string {
  return `Contamos el primer grupo de ${nombre.toLowerCase()}: ${a}. Contamos el segundo grupo: ${b}. Sumamos ${a} más ${b} y nos da ${a + b}.`
}

const ITEMS: PreguntaSumar[] = [
  { numero: 1, nombre: 'Bloques de tierra', emoji: '🟫', a: 3, b: 2, explicacion: explicarSuma('bloques de tierra', 3, 2) },
  { numero: 2, nombre: 'Bloques de piedra', emoji: '🪨', a: 4, b: 1, explicacion: explicarSuma('bloques de piedra', 4, 1) },
  { numero: 3, nombre: 'Troncos de madera', emoji: '🪵', a: 3, b: 2, explicacion: explicarSuma('troncos de madera', 3, 2) },
  { numero: 4, nombre: 'Bloques de arena', emoji: '🟨', a: 4, b: 3, explicacion: explicarSuma('bloques de arena', 4, 3) },
  { numero: 5, nombre: 'Minerales de hierro', emoji: '⬜', a: 2, b: 3, explicacion: explicarSuma('minerales de hierro', 2, 3) },
  { numero: 6, nombre: 'Hojas de roble', emoji: '🍁', a: 5, b: 1, explicacion: explicarSuma('hojas de roble', 5, 1) },
]

const TOTAL_PREGUNTAS = ITEMS.length

// ── Bloque de estado ──

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function PrimeroModulo04() {
  const [items, setItems] = useState<Record<number, EstadoPregunta>>(() =>
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

  const totalCorrectas = useMemo(() => Object.values(items).filter(e => e.evaluado && e.correcto).length, [items])
  const totalEvaluadas = useMemo(() => Object.values(items).filter(e => e.evaluado).length, [items])
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

  function comprobarItem(p: PreguntaSumar) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.a + p.b
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #2dd4bf 0%, #99f6e4 35%, #fef9c3 100%)',
      color: '#134e4a', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #14b8a6, #0f766e)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #134e4a', borderBottom: '4px solid #134e4a',
      }}>
        <BotonMenu href="/primero-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>➕🧱</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #134e4a', margin: 0, color: 'white',
        }}>
          ¡Sumar con bloques!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Sumá los dos grupos de bloques y escribí el total
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#14b8a6" />
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaSumar key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(19,78,74,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#134e4a' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f766e' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Sumás muy bien 🎮'
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

function TarjetaSumar({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaSumar
  estado: EstadoPregunta
  color: string
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: '#134e4a' }}>{p.nombre}</p>
        <BotonEscuchar texto={`¿Cuánto es ${p.a} más ${p.b}?`} tamano={34} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap', minHeight: '3.4rem', marginBottom: '0.7rem' }}>
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.1rem', fontSize: '1.6rem', maxWidth: '5.5rem' }}>
          {Array.from({ length: p.a }, (_, i) => <span key={i}>{p.emoji}</span>)}
        </span>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#134e4a' }}>+</span>
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.1rem', fontSize: '1.6rem', maxWidth: '5.5rem' }}>
          {Array.from({ length: p.b }, (_, i) => <span key={i}>{p.emoji}</span>)}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#134e4a' }}>=</span>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 70, padding: '0.6rem', borderRadius: 12, border: `2px solid ${color}55`,
            background: '#f0fdfa', color: '#134e4a', fontSize: '1.4rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.6rem 0.9rem', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1.2rem',
            opacity: estado.valor.trim() === '' ? 0.7 : 1, flexShrink: 0,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.a + p.b}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
