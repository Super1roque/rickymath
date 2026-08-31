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
import { useAuth } from '@/contexts/AuthContext'
import { usePerfil } from '@/contexts/PerfilContext'
import { guardarProgresoModulo } from '@/lib/progreso'

// ── Datos de la actividad (basados en la hoja "Actividad 2 - Suma Llevando") ──
// Los números salen directo de la hoja (impresos, no bloques a contar), así
// que no hizo falta pedirle confirmación al usuario.

function explicarSumaLlevando(a: number, b: number): string {
  const uA = a % 10, uB = b % 10
  const dA = Math.floor(a / 10), dB = Math.floor(b / 10)
  const sumaU = uA + uB
  const llevo = sumaU >= 10 ? 1 : 0
  const total = a + b
  const dTotal = dA + dB + llevo
  if (llevo) {
    return `En las unidades: ${uA} más ${uB} es ${sumaU}. Como pasa de 9, escribo ${sumaU % 10} y llevo 1 a las decenas. `
      + `En las decenas: ${dA} más ${dB} más el 1 que llevo es ${dTotal}. El resultado es ${total}.`
  }
  return `En las unidades: ${uA} más ${uB} es ${sumaU}. En las decenas: ${dA} más ${dB} es ${dTotal}. El resultado es ${total}.`
}

interface PreguntaSuma {
  numero: number
  nombre: string
  emoji: string
  a: number
  b: number
  explicacion: string
}

const ITEMS: PreguntaSuma[] = [
  { numero: 1, nombre: 'Suma con tierra', emoji: '🟫', a: 27, b: 15, explicacion: explicarSumaLlevando(27, 15) },
  { numero: 2, nombre: 'Suma con madera', emoji: '🪵', a: 38, b: 24, explicacion: explicarSumaLlevando(38, 24) },
  { numero: 3, nombre: 'Suma con piedra', emoji: '🪨', a: 46, b: 17, explicacion: explicarSumaLlevando(46, 17) },
  { numero: 4, nombre: 'Suma con arena', emoji: '🟨', a: 59, b: 23, explicacion: explicarSumaLlevando(59, 23) },
  { numero: 5, nombre: 'Suma con ladrillo', emoji: '🧱', a: 35, b: 28, explicacion: explicarSumaLlevando(35, 28) },
  { numero: 6, nombre: 'Suma con lana', emoji: '⬜', a: 44, b: 39, explicacion: explicarSumaLlevando(44, 39) },
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
    antes: 'Cuando la suma pasa de 9 en las unidades, llevo',
    despues: 'a las decenas.',
    aceptables: ['1'],
    lectura: 'Cuando la suma pasa de 9 en las unidades, ¿cuánto llevo a las decenas?',
    explicacion: 'Cada vez que la suma de las unidades llega a 10 o más, agrupamos 10 unidades en 1 decena — por eso siempre se lleva 1.',
  },
  {
    numero: 2,
    antes: '27 + 15 =',
    despues: '',
    aceptables: ['42'],
    lectura: '¿Veintisiete más quince?',
    explicacion: explicarSumaLlevando(27, 15),
  },
  {
    numero: 3,
    antes: 'Sumar es',
    despues: '(juntar / quitar).',
    aceptables: ['juntar'],
    lectura: 'Sumar es, ¿juntar o quitar?',
    explicacion: 'Sumar significa juntar dos cantidades para formar una más grande — quitar es lo que se hace al restar.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoSuma {
  llevo: string
  total: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_SUMA_INICIAL: EstadoSuma = { llevo: '', total: '', evaluado: false, correcto: false }

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function SegundoModulo02() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoSuma>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_SUMA_INICIAL }])),
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
  const progresoGuardado = useRef(false)
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

  useEffect(() => {
    if (!terminado) { progresoGuardado.current = false; return }
    if (!user || !perfilActivo || progresoGuardado.current) return
    progresoGuardado.current = true
    guardarProgresoModulo(user.uid, perfilActivo.id, 'segundo-modulo-02', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: PreguntaSuma) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.llevo.trim() === '' || actual.total.trim() === '') return
    const uA = p.a % 10, uB = p.b % 10
    const llevoReal = (uA + uB) >= 10 ? 1 : 0
    const correcto = Number(actual.llevo.trim()) === llevoReal && Number(actual.total.trim()) === p.a + p.b
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_SUMA_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #fb923c 0%, #fed7aa 35%, #fef9c3 100%)',
      color: '#7c2d12', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #f97316, #c2410c)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #7c2d12', borderBottom: '4px solid #7c2d12',
      }}>
        <BotonMenu href="/segundo-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🧱➕</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #7c2d12', margin: 0, color: 'white',
        }}>
          ¡Suma llevando!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Resolvé las sumas — ¡no olvides lo que llevás!
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#f97316" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaSuma key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiarLlevo={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], llevo: valor } }))}
              onCambiarTotal={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], total: valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #fdba74', boxShadow: '0 4px 0 rgba(124,45,18,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7c2d12' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(124,45,18,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#7c2d12' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#c2410c' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás la suma llevando 🎮'
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

// Ejemplo resuelto — no interactivo, mismo estilo que segundo-modulo-01,
// con un número distinto a los 6 de la actividad para no revelar ninguna
// respuesta. Explica el paso a paso de "llevar" antes de las preguntas.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const a = 18, b = 26
  const uA = a % 10, uB = b % 10
  const dA = Math.floor(a / 10), dB = Math.floor(b / 10)
  const sumaU = uA + uB
  const llevo = sumaU >= 10 ? 1 : 0
  const total = a + b

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
        <BotonEscuchar
          texto={`Ejemplo: ${a} más ${b}. En las unidades: ${uA} más ${uB} es ${sumaU}. Como pasa de 9, escribo ${sumaU % 10} y llevo 1 a las decenas. En las decenas: ${dA} más ${dB} más el 1 que llevo es ${dA + dB + llevo}. El resultado es ${total}.`}
          tamano={32}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <NumeroEnBloques n={a} color={color} />
          <NumeroEnBloques n={b} color={color} />
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', fontWeight: 700, opacity: 0.7, color: '#1e3a8a' }}>LO QUE LLEVO</p>
            <div style={{
              width: 40, height: 40, borderRadius: 10, border: `2px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '1.2rem', color: '#1e3a8a',
            }}>
              {llevo}
            </div>
          </div>

          <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e3a8a' }}>{a}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e3a8a', borderBottom: '2px solid #1e3a8a', display: 'inline-block' }}>+ {b}</div>
          </div>

          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a' }}>=</span>

          <div style={{
            width: 64, height: 64, borderRadius: 999, border: `3px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.4rem', color: '#1e3a8a', flexShrink: 0,
          }}>
            {total}
          </div>
        </div>
      </div>

      <p style={{ marginTop: '0.8rem', fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85 }}>
        {uA} + {uB} = {sumaU} → escribo {sumaU % 10} y llevo 1. Después: {dA} + {dB} + 1 = {dA + dB + llevo}.
      </p>
    </div>
  )
}

// Mismo lenguaje visual de bloques base-10 que segundo-modulo-01: una
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

function TarjetaSuma({ p, estado, color, onCambiarLlevo, onCambiarTotal, onComprobar, onExplicarEstado }: {
  p: PreguntaSuma
  estado: EstadoSuma
  color: string
  onCambiarLlevo: (valor: string) => void
  onCambiarTotal: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const listo = estado.llevo.trim() !== '' && estado.total.trim() !== ''

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && listo) onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: '#7c2d12' }}>{p.nombre}</p>
        <BotonEscuchar texto={`¿Cuánto es ${p.a} más ${p.b}? No olvides lo que llevás.`} tamano={32} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.5rem' }}>
        <NumeroEnBloques n={p.a} color={color} />
        <NumeroEnBloques n={p.b} color={color} />
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', fontWeight: 700, opacity: 0.7, color: '#7c2d12' }}>LO QUE LLEVO</p>
          <input
            type="number" inputMode="numeric" value={estado.llevo} disabled={estado.evaluado}
            onChange={e => onCambiarLlevo(e.target.value)} onKeyDown={handleKeyDown} placeholder="?"
            style={{
              width: 48, padding: '0.35rem', borderRadius: 10, border: `2px solid ${color}55`,
              background: '#fff7ed', color: '#7c2d12', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
            }}
          />
        </div>

        <div style={{ flex: 1, textAlign: 'right', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#7c2d12' }}>{p.a}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#7c2d12', borderBottom: `2px solid #7c2d12`, display: 'inline-block' }}>+ {p.b}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7c2d12' }}>=</span>
        <input
          type="number"
          inputMode="numeric"
          value={estado.total}
          disabled={estado.evaluado}
          onChange={e => onCambiarTotal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 70, padding: '0.55rem', borderRadius: 12, border: `2px solid ${color}55`,
            background: '#fff7ed', color: '#7c2d12', fontSize: '1.4rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={!listo} style={{
            padding: '0.55rem 0.9rem', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: !listo ? '#e2e8f0' : '#22c55e',
            boxShadow: !listo ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1.2rem',
            opacity: !listo ? 0.7 : 1, flexShrink: 0,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Llevaba 1, era ${p.a + p.b}`}
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#fdba74'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fff7ed',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#7c2d12' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #fdba74',
          background: 'white', color: '#7c2d12', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#7c2d12' }}>{p.despues}</span>
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
