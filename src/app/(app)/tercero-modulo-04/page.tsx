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

// ── Datos de la actividad (basados en la hoja "Actividad 4 - Fracciones Simples") ──
// Clave de respuestas confirmada a mano por el usuario, mirando la hoja
// original — a diferencia de una multiplicación, acá no hay forma de
// derivar la fracción correcta solo del enunciado.

function explicarFraccion(num: number, den: number, nombre: string): string {
  return `De ${nombre}, está dividida en ${den} partes, y ${num} de esas partes están coloreadas. Por eso la fracción es ${num} sobre ${den}.`
}

interface PreguntaFraccion {
  numero: number
  numCorrecto: number
  denCorrecto: number
  emoji: string
  nombre: string
  layout: 'fila' | 'grid'
  explicacion: string
}

const FRACCIONES: PreguntaFraccion[] = [
  { numero: 1, numCorrecto: 1, denCorrecto: 2, emoji: '🍰', nombre: 'el pastel', layout: 'fila', explicacion: explicarFraccion(1, 2, 'el pastel') },
  { numero: 2, numCorrecto: 2, denCorrecto: 4, emoji: '🍉', nombre: 'la sandía', layout: 'grid', explicacion: explicarFraccion(2, 4, 'la sandía') },
  { numero: 3, numCorrecto: 2, denCorrecto: 3, emoji: '🍞', nombre: 'el pan', layout: 'fila', explicacion: explicarFraccion(2, 3, 'el pan') },
  { numero: 4, numCorrecto: 3, denCorrecto: 4, emoji: '🍰', nombre: 'el pastel', layout: 'grid', explicacion: explicarFraccion(3, 4, 'el pastel') },
  { numero: 5, numCorrecto: 2, denCorrecto: 2, emoji: '🍎', nombre: 'la manzana', layout: 'fila', explicacion: explicarFraccion(2, 2, 'la manzana') },
  { numero: 6, numCorrecto: 2, denCorrecto: 4, emoji: '🍉', nombre: 'el bloque', layout: 'fila', explicacion: explicarFraccion(2, 4, 'el bloque') },
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
    antes: 'El número de arriba de la fracción se llama',
    despues: '.',
    aceptables: ['numerador'],
    lectura: '¿Cómo se llama el número de arriba de una fracción?',
    explicacion: 'El número de arriba de una fracción, el que dice cuántas partes están coloreadas, se llama numerador.',
  },
  {
    numero: 2,
    antes: 'El número de abajo se llama',
    despues: '.',
    aceptables: ['denominador'],
    lectura: '¿Cómo se llama el número de abajo de una fracción?',
    explicacion: 'El número de abajo, el que dice en cuántas partes se dividió el total, se llama denominador.',
  },
  {
    numero: 3,
    antes: '4/8 es lo mismo que',
    despues: '(1/2 / 1/4).',
    aceptables: ['1/2', '0.5'],
    lectura: '¿Cuatro octavos es lo mismo que un medio o un cuarto?',
    explicacion: '4 de 8 partes es la mitad del total, y la mitad también se escribe 1 sobre 2. Por eso 4 octavos es lo mismo que 1 medio.',
  },
]

const TOTAL_PREGUNTAS = FRACCIONES.length + COMPLETAR.length

// ── Bloque de estado por pregunta ──

interface EstadoFraccion {
  numerador: string
  denominador: string
  evaluado: boolean
  correcto: boolean
}

interface EstadoCompleta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_FRACCION_INICIAL: EstadoFraccion = { numerador: '', denominador: '', evaluado: false, correcto: false }
const ESTADO_COMPLETA_INICIAL: EstadoCompleta = { valor: '', evaluado: false, correcto: false }

export default function TerceroModulo04() {
  const [fracciones, setFracciones] = useState<Record<number, EstadoFraccion>>(() =>
    Object.fromEntries(FRACCIONES.map(p => [p.numero, { ...ESTADO_FRACCION_INICIAL }])),
  )
  const [completa, setCompleta] = useState<Record<number, EstadoCompleta>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_COMPLETA_INICIAL }])),
  )
  const fanfarriaSonada = useRef(false)

  const [puntos, setPuntos] = useState(0)
  const [racha, setRacha] = useState(0)
  const [mejorRacha, setMejorRacha] = useState(0)

  // Ricky: UNA sola presencia en pantalla (regla del handoff de diseño —
  // nunca dos Rickys a la vez). Saluda al entrar (Wave ×2), después queda
  // respirando (Breathe/Idle) hasta que hay algo que reaccionar: rebota
  // feliz en un acierto, hace un pequeño Shake (confundido) en un error, piensa mientras
  // carga un "Explicar", y termina festejando (Bounce en loop) si el
  // módulo se completó perfecto.
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
    const cFrac = Object.values(fracciones).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cFrac + cCompleta
  }, [fracciones, completa])

  const totalEvaluadas = useMemo(() => {
    const eFrac = Object.values(fracciones).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eFrac + eCompleta
  }, [fracciones, completa])

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

  // Se lee el estado actual del closure (no la forma funcional de setState)
  // porque acá SÍ importa ejecutar el sonido una sola vez, exactamente
  // cuando el usuario hace clic — dentro de un updater de setState el efecto
  // de sonido podría dispararse más de una vez (p. ej. en modo estricto de
  // desarrollo, que invoca los updaters dos veces).
  function comprobarFraccion(p: PreguntaFraccion) {
    const actual = fracciones[p.numero]
    if (actual.evaluado || actual.numerador.trim() === '' || actual.denominador.trim() === '') return
    const correcto = Number(actual.numerador.trim()) === p.numCorrecto && Number(actual.denominador.trim()) === p.denCorrecto
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setFracciones(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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
    setFracciones(Object.fromEntries(FRACCIONES.map(p => [p.numero, { ...ESTADO_FRACCION_INICIAL }])))
    setCompleta(Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_COMPLETA_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #f472b6 0%, #fbcfe8 35%, #fef9c3 100%)',
      color: '#831843', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #ec4899, #db2777)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #831843', borderBottom: '4px solid #831843',
      }}>
        <BotonMenu />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🍰🍉</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #831843', margin: 0, color: 'white',
        }}>
          ¡Fracciones simples!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Observá la parte coloreada y escribí la fracción
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#db2777" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {FRACCIONES.map((p, i) => (
            <TarjetaFraccion key={p.numero} p={p} estado={fracciones[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiarNumerador={valor => setFracciones(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], numerador: valor } }))}
              onCambiarDenominador={valor => setFracciones(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], denominador: valor } }))}
              onComprobar={() => comprobarFraccion(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #f9a8d4', boxShadow: '0 4px 0 rgba(131,24,67,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#831843' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(131,24,67,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#831843' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#db2777' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás las fracciones 🎮'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi las dominás.'
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

// Dibuja la fracción como una fila (o grilla 2×2, para las que en la hoja
// original tenían un corte en cruz) de celdas — coloreadas vs. sin
// colorear — para que el chico la "vea" igual que en el papel antes de
// escribirla, en vez de tener que imaginarla solo por el nombre del dibujo.
function FraccionVisual({ numerador, denominador, emoji, layout, color }: {
  numerador: number
  denominador: number
  emoji: string
  layout: 'fila' | 'grid'
  color: string
}) {
  const celdas = Array.from({ length: denominador }, (_, i) => i < numerador)
  return (
    <div style={{
      display: layout === 'grid' ? 'grid' : 'flex',
      gridTemplateColumns: layout === 'grid' ? 'repeat(2, 1fr)' : undefined,
      gridTemplateRows: layout === 'grid' ? 'repeat(2, 1fr)' : undefined,
      flexDirection: layout === 'fila' ? 'row' : undefined,
      gap: 4, width: layout === 'grid' ? 92 : Math.min(170, denominador * 42),
      height: layout === 'grid' ? 92 : 42, margin: '0 auto',
    }}>
      {celdas.map((coloreada, i) => (
        <div key={i} style={{
          flex: layout === 'fila' ? 1 : undefined,
          background: coloreada ? color : '#f1f5f9',
          border: `2px solid ${coloreada ? color : '#e2e8f0'}`, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
        }}>
          {coloreada ? emoji : ''}
        </div>
      ))}
    </div>
  )
}

function EntradaFraccion({ numerador, denominador, deshabilitado, color, onCambiarNumerador, onCambiarDenominador, onEnter }: {
  numerador: string
  denominador: string
  deshabilitado: boolean
  color: string
  onCambiarNumerador: (v: string) => void
  onCambiarDenominador: (v: string) => void
  onEnter: () => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onEnter()
  }
  const estiloInput = {
    width: 60, padding: '0.4rem', borderRadius: 10, border: `2px solid ${color}55`,
    background: '#fdf2f8', color: '#831843', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center' as const,
  }
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <input type="number" inputMode="numeric" value={numerador} disabled={deshabilitado}
        onChange={e => onCambiarNumerador(e.target.value)} onKeyDown={handleKeyDown} style={estiloInput} />
      <div style={{ width: 60, height: 3, background: '#831843', borderRadius: 2 }} />
      <input type="number" inputMode="numeric" value={denominador} disabled={deshabilitado}
        onChange={e => onCambiarDenominador(e.target.value)} onKeyDown={handleKeyDown} style={estiloInput} />
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con una fracción distinta a las 6 de
// la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const num = 1, den = 3, emoji = '🍓', nombre = 'la fresa'

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
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#831843' }}>Ejemplo resuelto</p>
        <BotonEscuchar texto={`¿Qué fracción de ${nombre} está coloreada? ${explicarFraccion(num, den, nombre)}`} tamano={32} />
      </div>

      <div style={{ marginBottom: '0.7rem' }}>
        <FraccionVisual numerador={num} denominador={den} emoji={emoji} layout="fila" color={color} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#831843' }}>
        <span>{num}</span><span style={{ width: 24, height: 2.5, background: '#831843', display: 'inline-block' }} /><span>{den}</span>
      </div>
      <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', textAlign: 'center', color: '#831843', opacity: 0.85 }}>
        {explicarFraccion(num, den, nombre)}
      </p>
    </div>
  )
}

function TarjetaFraccion({ p, estado, color, onCambiarNumerador, onCambiarDenominador, onComprobar, onExplicarEstado }: {
  p: PreguntaFraccion
  estado: EstadoFraccion
  color: string
  onCambiarNumerador: (v: string) => void
  onCambiarDenominador: (v: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const listo = estado.numerador.trim() !== '' && estado.denominador.trim() !== ''
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

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
        <BotonEscuchar texto={`¿Qué fracción de ${p.nombre} está coloreada?`} tamano={34} />
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        <FraccionVisual numerador={p.numCorrecto} denominador={p.denCorrecto} emoji={p.emoji} layout={p.layout} color={color} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', alignItems: 'center' }}>
        <EntradaFraccion
          numerador={estado.numerador} denominador={estado.denominador} deshabilitado={estado.evaluado} color={color}
          onCambiarNumerador={onCambiarNumerador} onCambiarDenominador={onCambiarDenominador} onEnter={onComprobar}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={!listo} style={{
            padding: '0.6rem 0.9rem', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: !listo ? '#e2e8f0' : '#22c55e',
            boxShadow: !listo ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1.2rem',
            opacity: !listo ? 0.7 : 1,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.numCorrecto}/${p.denCorrecto}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function FilaCompleta({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaCompleta
  estado: EstadoCompleta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#f9a8d4'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fdf2f8',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#831843' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #f9a8d4',
          background: 'white', color: '#831843', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#831843' }}>{p.despues}</span>
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
