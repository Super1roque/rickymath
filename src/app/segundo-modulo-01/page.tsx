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

// ── Datos de la actividad (basados en la hoja "Actividad 1 - Valor Posicional") ──
// Decenas y unidades de cada recuadro confirmadas a mano por el usuario
// mirando la hoja original (recuadros 1 y 3 corregidos).

function explicarValorPosicional(decenas: number, unidades: number): string {
  const numero = decenas * 10 + unidades
  return `Hay ${decenas} decena${decenas === 1 ? '' : 's'} y ${unidades} unidad${unidades === 1 ? '' : 'es'}. `
    + `Como cada decena vale 10, ${decenas} decena${decenas === 1 ? '' : 's'} son ${decenas * 10}, `
    + `y sumamos las ${unidades} unidades: ${decenas * 10} más ${unidades} es ${numero}.`
}

interface PreguntaValor {
  numero: number
  decenas: number
  unidades: number
  explicacion: string
}

const ITEMS: PreguntaValor[] = [
  { numero: 1, decenas: 2, unidades: 6, explicacion: explicarValorPosicional(2, 6) },
  { numero: 2, decenas: 4, unidades: 1, explicacion: explicarValorPosicional(4, 1) },
  { numero: 3, decenas: 5, unidades: 7, explicacion: explicarValorPosicional(5, 7) },
  { numero: 4, decenas: 7, unidades: 3, explicacion: explicarValorPosicional(7, 3) },
]

const TOTAL_PREGUNTAS = ITEMS.length + 3

// ── Bloque de estado ──

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

interface EstadoDoble {
  a: string
  b: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_DOBLE_INICIAL: EstadoDoble = { a: '', b: '', evaluado: false, correcto: false }

export default function SegundoModulo01() {
  const [items, setItems] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])),
  )
  const [completa1, setCompleta1] = useState<EstadoPregunta>({ ...ESTADO_INICIAL })
  const [completa2, setCompleta2] = useState<EstadoDoble>({ ...ESTADO_DOBLE_INICIAL })
  const [completa3, setCompleta3] = useState<EstadoPregunta>({ ...ESTADO_INICIAL })
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
    const cCompleta = [completa1, completa3].filter(e => e.evaluado && e.correcto).length + (completa2.evaluado && completa2.correcto ? 1 : 0)
    return cItems + cCompleta
  }, [items, completa1, completa2, completa3])

  const totalEvaluadas = useMemo(() => {
    const eItems = Object.values(items).filter(e => e.evaluado).length
    const eCompleta = [completa1, completa3].filter(e => e.evaluado).length + (completa2.evaluado ? 1 : 0)
    return eItems + eCompleta
  }, [items, completa1, completa2, completa3])

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

  function comprobarItem(p: PreguntaValor) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.decenas * 10 + p.unidades
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarCompleta1() {
    if (completa1.evaluado || completa1.valor.trim() === '') return
    const correcto = normalizarTexto(completa1.valor) === '10'
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompleta1(prev => ({ ...prev, evaluado: true, correcto }))
  }

  function comprobarCompleta2() {
    if (completa2.evaluado || completa2.a.trim() === '' || completa2.b.trim() === '') return
    const correcto = normalizarTexto(completa2.a) === '4' && normalizarTexto(completa2.b) === '5'
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompleta2(prev => ({ ...prev, evaluado: true, correcto }))
  }

  function comprobarCompleta3() {
    if (completa3.evaluado || completa3.valor.trim() === '') return
    const correcto = normalizarTexto(completa3.valor) === '4'
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompleta3(prev => ({ ...prev, evaluado: true, correcto }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
    setCompleta1({ ...ESTADO_INICIAL })
    setCompleta2({ ...ESTADO_DOBLE_INICIAL })
    setCompleta3({ ...ESTADO_INICIAL })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #4ade80 0%, #bbf7d0 35%, #fef9c3 100%)',
      color: '#14532d', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #22c55e, #16a34a)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #14532d', borderBottom: '4px solid #14532d',
      }}>
        <BotonMenu href="/segundo-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🟩🔢</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #14532d', margin: 0, color: 'white',
        }}>
          ¡Valor posicional!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Contá las decenas y las unidades, y escribí el número
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#22c55e" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaValor key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #86efac', boxShadow: '0 4px 0 rgba(20,83,45,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#14532d' }}>
            📖 Completá
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <FilaCompleta
              numero={1} antes="Una decena tiene" despues="unidades." aceptable="10"
              lectura="¿Cuántas unidades tiene una decena?" explicacion="Una decena siempre son 10 unidades juntas — por eso las agrupamos en una torre de 10."
              estado={completa1}
              onCambiar={valor => setCompleta1(prev => ({ ...prev, valor }))}
              onComprobar={comprobarCompleta1}
              onExplicarEstado={reaccionarRickyExplicar}
            />

            <FilaCompletaDoble
              estado={completa2}
              onCambiarA={valor => setCompleta2(prev => ({ ...prev, a: valor }))}
              onCambiarB={valor => setCompleta2(prev => ({ ...prev, b: valor }))}
              onComprobar={comprobarCompleta2}
              onExplicarEstado={reaccionarRickyExplicar}
            />

            <FilaCompleta
              numero={3} antes="El número con más decenas es el" despues="." aceptable="4"
              lectura="¿Cuál recuadro es el número con más decenas?" explicacion="Comparamos las decenas de cada recuadro: 2, 4, 5 y 7. El número más grande es 7, y ese es el recuadro 4."
              estado={completa3}
              onCambiar={valor => setCompleta3(prev => ({ ...prev, valor }))}
              onComprobar={comprobarCompleta3}
              onExplicarEstado={reaccionarRickyExplicar}
            />
          </div>
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(20,83,45,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#14532d' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#16a34a' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás el valor posicional 🎮'
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

// Ejemplo resuelto — no interactivo, igual que la tarjeta "EJ" al principio
// de la hoja original (3 decenas + 4 unidades = 34), para mostrar el método
// antes de las 4 preguntas.
function TarjetaEjemplo() {
  const color = '#3b82f6'
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
        <BotonEscuchar texto="Ejemplo: 3 decenas y 4 unidades. Como cada decena vale 10, 3 decenas son 30, y sumamos las 4 unidades: 30 más 4 es 34." tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.9rem' }}>
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-end' }}>
            {Array.from({ length: 3 }, (_, i) => <TorreDecena key={i} color={color} />)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', maxWidth: '4.5rem', alignContent: 'flex-end' }}>
            {Array.from({ length: 4 }, (_, i) => <BloqueUnidad key={i} color={color} />)}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: '#1e3a8a' }}>DECENAS = 3</p>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: '#1e3a8a' }}>UNIDADES = 4</p>
        </div>

        <div style={{ fontSize: '1.5rem', color: '#1e3a8a' }}>➡️</div>

        <div style={{
          width: 64, height: 64, borderRadius: 999, border: `3px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '1.5rem', color: '#1e3a8a', flexShrink: 0,
        }}>
          34
        </div>
      </div>
    </div>
  )
}

// Una "torre" de 10 segmentos apilados representa una decena — mismo
// lenguaje visual que los bloques de base 10 de la hoja original.
function TorreDecena({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2 }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ width: 20, height: 7, background: color, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 2 }} />
      ))}
    </div>
  )
}

function BloqueUnidad({ color }: { color: string }) {
  return <div style={{ width: 16, height: 16, background: color, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3 }} />
}

function TarjetaValor({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaValor
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
        <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: '#14532d' }}>¿Cuál es el número?</p>
        <BotonEscuchar texto="¿Cuántas decenas y unidades hay? ¿Cuál es el número?" tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.9rem', minHeight: '5rem', marginBottom: '0.7rem' }}>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-end' }}>
          {Array.from({ length: p.decenas }, (_, i) => <TorreDecena key={i} color={color} />)}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', maxWidth: '4.5rem', alignContent: 'flex-end' }}>
          {Array.from({ length: p.unidades }, (_, i) => <BloqueUnidad key={i} color={color} />)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            flex: 1, minWidth: 0, width: '100%', padding: '0.6rem', borderRadius: 12, border: `2px solid ${color}55`,
            background: '#f0fdf4', color: '#14532d', fontSize: '1.5rem', fontWeight: 700, textAlign: 'center',
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.decenas * 10 + p.unidades}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function FilaCompleta({ numero, antes, despues, aceptable, lectura, explicacion, estado, onCambiar, onComprobar, onExplicarEstado }: {
  numero: number
  antes: string
  despues: string
  aceptable: string
  lectura: string
  explicacion: string
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#86efac'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0fdf4',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#14532d' }}>{numero}. {antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 90, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #86efac',
          background: 'white', color: '#14532d', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>{despues}</span>
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
            {estado.correcto ? '✅' : `❌ (${aceptable})`}
          </span>
          <BotonExplicar texto={explicacion} onEstadoCambia={onExplicarEstado} />
        </>
      )}
    </div>
  )
}

// Única fila con DOS espacios en la misma oración ("En el número 45 hay ___
// decenas y ___ unidades") — se resuelve con dos inputs en vez de forzar el
// patrón de una sola casilla.
function FilaCompletaDoble({ estado, onCambiarA, onCambiarB, onComprobar, onExplicarEstado }: {
  estado: EstadoDoble
  onCambiarA: (valor: string) => void
  onCambiarB: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#86efac'
  const listo = estado.a.trim() !== '' && estado.b.trim() !== ''

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0fdf4',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto="En el número 45, ¿cuántas decenas y cuántas unidades hay?" />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>2. En el número 45 hay</span>
      <input
        value={estado.a}
        disabled={estado.evaluado}
        onChange={e => onCambiarA(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 60, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #86efac',
          background: 'white', color: '#14532d', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>decenas y</span>
      <input
        value={estado.b}
        disabled={estado.evaluado}
        onChange={e => onCambiarB(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 60, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #86efac',
          background: 'white', color: '#14532d', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>unidades.</span>
      {!estado.evaluado ? (
        <button onClick={onComprobar} disabled={!listo} style={{
          marginLeft: 'auto', padding: '0.45rem 0.9rem', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: !listo ? '#e2e8f0' : '#22c55e',
          boxShadow: !listo ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1.05rem',
          opacity: !listo ? 0.7 : 1,
        }}>
          ✓
        </button>
      ) : (
        <>
          <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅' : '❌ (4 y 5)'}
          </span>
          <BotonExplicar
            texto="En el número 45, el 4 está en el lugar de las decenas y el 5 está en el lugar de las unidades — por eso hay 4 decenas y 5 unidades."
            onEstadoCambia={onExplicarEstado}
          />
        </>
      )}
    </div>
  )
}
