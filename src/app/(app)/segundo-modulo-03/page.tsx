'use client'

import { useEffect, useMemo, useState, useRef, type KeyboardEvent } from 'react'
import { reproducirCorrecto, reproducirIncorrecto, reproducirFanfarria, normalizarTexto } from '@/lib/guiaAudio'
import { fuenteJuego, COLORES_TARJETAS as COLORES } from '@/lib/fuenteJuego'
import BotonEscuchar from '@/components/guia/BotonEscuchar'
import BotonExplicar from '@/components/guia/BotonExplicar'
import BotonMenu from '@/components/guia/BotonMenu'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Confetti from '@/components/guia/Confetti'
import BarraProgreso from '@/components/guia/BarraProgreso'
import Ricky, { type RickyMood } from '@/components/guia/Ricky'

// ── Datos de la actividad (basados en la hoja "Actividad 3 - Resta Prestando") ──
// Los números salen directo de la hoja (impresos, no bloques a contar), así
// que no hizo falta pedirle confirmación al usuario. Los cubos sueltos que
// dibuja la hoja son un adorno conceptual del "préstamo", no una cantidad
// exacta contable, así que en la versión digital se reusa el mismo lenguaje
// visual de decenas/unidades de los módulos 1 y 2, aplicado al minuendo.

function explicarRestaPrestando(a: number, b: number): string {
  const uA = a % 10, uB = b % 10
  const dA = Math.floor(a / 10), dB = Math.floor(b / 10)
  const resultado = a - b
  if (uA < uB) {
    const uAprestada = uA + 10
    const dAprestada = dA - 1
    return `En las unidades, ${uA} es menos que ${uB}, así que pido prestada 1 decena: ${uA} más 10 es ${uAprestada}. `
      + `Resto: ${uAprestada} menos ${uB} es ${uAprestada - uB}. En las decenas, como presté una, quedan ${dAprestada}, `
      + `y ${dAprestada} menos ${dB} es ${dAprestada - dB}. El resultado es ${resultado}.`
  }
  return `En las unidades: ${uA} menos ${uB} es ${uA - uB}. En las decenas: ${dA} menos ${dB} es ${dA - dB}. El resultado es ${resultado}.`
}

interface PreguntaResta {
  numero: number
  a: number
  b: number
  explicacion: string
}

const ITEMS: PreguntaResta[] = [
  { numero: 1, a: 42, b: 17, explicacion: explicarRestaPrestando(42, 17) },
  { numero: 2, a: 53, b: 28, explicacion: explicarRestaPrestando(53, 28) },
  { numero: 3, a: 61, b: 35, explicacion: explicarRestaPrestando(61, 35) },
  { numero: 4, a: 74, b: 46, explicacion: explicarRestaPrestando(74, 46) },
  { numero: 5, a: 30, b: 14, explicacion: explicarRestaPrestando(30, 14) },
  { numero: 6, a: 85, b: 29, explicacion: explicarRestaPrestando(85, 29) },
]

interface PreguntaCompleta {
  numero: number
  antes: string
  despues: string
  aceptables: string[]
  lectura: string
  explicacion: string
}

const COMPLETAR: PreguntaCompleta[] = [
  {
    numero: 1,
    antes: 'Cuando no alcanzan las unidades, pido prestada una',
    despues: '.',
    aceptables: ['decena'],
    lectura: 'Cuando no alcanzan las unidades, ¿qué pido prestado?',
    explicacion: 'Cuando el número de arriba tiene menos unidades que el de abajo, tomamos prestada 1 decena entera para poder restar.',
  },
  {
    numero: 2,
    antes: 'Una decena prestada vale',
    despues: 'unidades.',
    aceptables: ['10'],
    lectura: '¿Cuántas unidades vale una decena prestada?',
    explicacion: 'Una decena siempre son 10 unidades — por eso, al pedirla prestada, se suman 10 a las unidades que ya había.',
  },
  {
    numero: 3,
    antes: '42 - 17 =',
    despues: '',
    aceptables: ['25'],
    lectura: '¿Cuarenta y dos menos diecisiete?',
    explicacion: explicarRestaPrestando(42, 17),
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function SegundoModulo03() {
  const [items, setItems] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])),
  )
  const [completa, setCompleta] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_INICIAL }])),
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

  const totalCorrectas = useMemo(() => {
    const cItems = Object.values(items).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cItems + cCompleta
  }, [items, completa])

  const totalEvaluadas = useMemo(() => {
    const eItems = Object.values(items).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eItems + eCompleta
  }, [items, completa])

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

  function comprobarItem(p: PreguntaResta) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.a - p.b
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarCompleta(p: PreguntaCompleta) {
    const actual = completa[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = p.aceptables.map(normalizarTexto).includes(normalizarTexto(actual.valor))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompleta(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
    setCompleta(Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #f87171 0%, #fecaca 35%, #fef9c3 100%)',
      color: '#7f1d1d', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #dc2626, #991b1b)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #7f1d1d', borderBottom: '4px solid #7f1d1d',
      }}>
        <BotonMenu href="/segundo-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🟥➖</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #7f1d1d', margin: 0, color: 'white',
        }}>
          ¡Resta prestando!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Resolvé las restas — si no alcanza, pedí prestado a las decenas
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
            background: '#fef3c7', color: '#9f1239', padding: '0.4rem 0.9rem', borderRadius: 999,
            border: '2px solid #fb7185',
            animation: racha >= 3 ? 'gj-pulso 0.7s ease-in-out infinite' : undefined,
          }}>
            🔥 {racha}
          </span>
          <div style={{ flex: 1, minWidth: 110 }}>
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#dc2626" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaResta key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #fca5a5', boxShadow: '0 4px 0 rgba(127,29,29,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7f1d1d' }}>
            📖 Completá
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {COMPLETAR.map(p => (
              <FilaCompleta key={p.numero} p={p} estado={completa[p.numero]}
                onCambiar={valor => setCompleta(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
                onComprobar={() => comprobarCompleta(p)} onExplicarEstado={reaccionarRickyExplicar} />
            ))}
          </div>
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(127,29,29,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#7f1d1d' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#991b1b' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás la resta prestando 🎮'
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

// Mismo lenguaje visual de bloques base-10 que segundo-modulo-01 y 02: una
// "torre" de 10 segmentos por decena, un cuadrito suelto por unidad.
function TorreDecena({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ width: 14, height: 5, background: color, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 2 }} />
      ))}
    </div>
  )
}

function BloqueUnidad({ color }: { color: string }) {
  return <div style={{ width: 11, height: 11, background: color, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 2 }} />
}

function NumeroEnBloques({ n, color }: { n: number; color: string }) {
  const decenas = Math.floor(n / 10)
  const unidades = n % 10
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.35rem' }}>
      <div style={{ display: 'flex', gap: '0.15rem', alignItems: 'flex-end' }}>
        {Array.from({ length: decenas }, (_, i) => <TorreDecena key={i} color={color} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.12rem', maxWidth: '2.6rem', alignContent: 'flex-end' }}>
        {Array.from({ length: unidades }, (_, i) => <BloqueUnidad key={i} color={color} />)}
      </div>
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con un número distinto a los 6 de la
// actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const a = 52, b = 27
  const uA = a % 10, uB = b % 10
  const dA = Math.floor(a / 10), dB = Math.floor(b / 10)
  const uAprestada = uA + 10
  const dAprestada = dA - 1
  const resultado = a - b

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${color}`, boxShadow: `0 4px 0 ${color}55`,
      borderRadius: 18, padding: '1rem', marginBottom: '1.25rem',
    }}>
      <div style={{
        position: 'absolute', top: '0.6rem', right: '0.6rem', background: color, color: 'white',
        fontSize: '0.7rem', fontWeight: 800, padding: '0.25rem 0.6rem', borderRadius: 999, letterSpacing: '0.03em',
      }}>
        EJEMPLO
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>Ejemplo resuelto</p>
        <BotonEscuchar texto={`Ejemplo: ${a} menos ${b}. ${explicarRestaPrestando(a, b)}`} tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
        <NumeroEnBloques n={a} color={color} />

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e3a8a' }}>{a}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e3a8a', borderBottom: '2px solid #1e3a8a', display: 'inline-block' }}>− {b}</div>
          </div>

          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a' }}>=</span>

          <div style={{
            width: 64, height: 64, borderRadius: 999, border: `3px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.4rem', color: '#1e3a8a', flexShrink: 0,
          }}>
            {resultado}
          </div>
        </div>
      </div>

      <p style={{ marginTop: '0.8rem', fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85 }}>
        {uA} es menos que {uB}, pido prestada 1 decena: {uA} + 10 = {uAprestada}. Después: {uAprestada} − {uB} = {uAprestada - uB}, y {dAprestada} − {dB} = {dAprestada - dB}.
      </p>
    </div>
  )
}

function TarjetaResta({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaResta
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
        <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: '#7f1d1d' }}>Resta prestando</p>
        <BotonEscuchar texto={`¿Cuánto es ${p.a} menos ${p.b}? Si no alcanza, pedí prestado a las decenas.`} tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.9rem', minHeight: '3.6rem', marginBottom: '0.6rem' }}>
        <NumeroEnBloques n={p.a} color={color} />

        <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#7f1d1d' }}>{p.a}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#7f1d1d', borderBottom: '2px solid #7f1d1d', display: 'inline-block' }}>− {p.b}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7f1d1d' }}>=</span>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 70, padding: '0.55rem', borderRadius: 12, border: `2px solid ${color}55`,
            background: '#fef2f2', color: '#7f1d1d', fontSize: '1.4rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.55rem 0.9rem', borderRadius: 12, border: 'none', cursor: 'pointer',
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.a - p.b}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function FilaCompleta({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaCompleta
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#fca5a5'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fef2f2',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#7f1d1d' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #fca5a5',
          background: 'white', color: '#7f1d1d', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#7f1d1d' }}>{p.despues}</span>
      {!estado.evaluado ? (
        <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
          marginLeft: 'auto', padding: '0.45rem 0.9rem', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
          boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1.05rem',
          opacity: estado.valor.trim() === '' ? 0.7 : 1,
        }}>
          ✓
        </button>
      ) : (
        <>
          <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅' : `❌ (${p.aceptables[0]})`}
          </span>
          <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
        </>
      )}
    </div>
  )
}
