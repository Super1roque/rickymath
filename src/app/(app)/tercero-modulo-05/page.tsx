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

// ── Datos de la actividad (basados en la hoja "Actividad 5 - El Dinero") ──
// A diferencia de una multiplicación suelta, acá cada respuesta sale de un
// problema de dos pasos (precio + contexto) — por eso la lectura en voz
// alta SÍ necesita el enunciado completo, no solo la expresión.

interface PreguntaDinero {
  numero: number
  emoji: string
  nombreItem: string
  precio: number
  contexto: string
  pregunta: string
  respuesta: number
  lectura: string
  explicacion: string
}

const PROBLEMAS: PreguntaDinero[] = [
  {
    numero: 1, emoji: '⚔️', nombreItem: 'Espada de hierro', precio: 12,
    contexto: 'Comprás.', pregunta: '¿Cuánto pagás?', respuesta: 12,
    lectura: 'La espada de hierro cuesta doce esmeraldas. Si la comprás, ¿cuánto pagás?',
    explicacion: 'Si el precio es 12 esmeraldas, pagás exactamente 12 esmeraldas — no hay que sumar ni restar nada más.',
  },
  {
    numero: 2, emoji: '🍞', nombreItem: 'Pan', precio: 3,
    contexto: 'Tenés 20, comprás 4.', pregunta: '¿Cuánto sobra?', respuesta: 8,
    lectura: 'El pan cuesta tres esmeraldas cada uno. Tenés veinte esmeraldas y comprás cuatro panes. ¿Cuánto te sobra?',
    explicacion: 'Primero calculo cuánto gasté: 4 panes por 3 esmeraldas cada uno es 12. Después resto: tenía 20, menos 12 gastadas, sobran 8.',
  },
  {
    numero: 3, emoji: '⛏️', nombreItem: 'Pico de diamante', precio: 25,
    contexto: 'Tenés 18.', pregunta: '¿Cuánto falta?', respuesta: 7,
    lectura: 'El pico de diamante cuesta veinticinco esmeraldas. Tenés dieciocho. ¿Cuánto te falta?',
    explicacion: 'El pico cuesta 25 y tenés 18. Para saber cuánto falta, resto: 25 menos 18 es 7.',
  },
  {
    numero: 4, emoji: '🍎', nombreItem: 'Manzana dorada', precio: 8,
    contexto: 'Pagás con 1 lingote de oro (vale 10).', pregunta: '¿Vuelto?', respuesta: 2,
    lectura: 'La manzana dorada cuesta ocho esmeraldas. Pagás con un lingote de oro que vale diez. ¿Cuánto te dan de vuelto?',
    explicacion: 'Pagás con un lingote que vale 10, y el precio es 8. El vuelto es la diferencia: 10 menos 8 es 2.',
  },
  {
    numero: 5, emoji: '🛡️', nombreItem: 'Armadura', precio: 40,
    contexto: 'Juntás 15 por día.', pregunta: '¿Cuántos días?', respuesta: 3,
    lectura: 'La armadura cuesta cuarenta esmeraldas. Juntás quince esmeraldas por día. ¿Cuántos días necesitás para juntar lo suficiente?',
    explicacion: 'Juntás 15 por día. En 1 día tenés 15, en 2 días tenés 30, y en 3 días tenés 45 — ahí ya alcanza para los 40. Por eso necesitás 3 días.',
  },
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
    antes: 'Si pago con más de lo que cuesta, recibo un',
    despues: '.',
    aceptables: ['vuelto', 'cambio'],
    lectura: 'Si pagás con más de lo que cuesta algo, ¿qué recibís?',
    explicacion: 'Cuando pagás con más dinero del precio, te devuelven la diferencia — eso es el vuelto o cambio.',
  },
  {
    numero: 2,
    antes: 'Un lingote de oro vale',
    despues: 'esmeraldas.',
    aceptables: ['10'],
    lectura: '¿Cuántas esmeraldas vale un lingote de oro?',
    explicacion: 'Un lingote de oro vale 10 esmeraldas — es un dato fijo que conviene memorizar para resolver los problemas de dinero.',
  },
  {
    numero: 3,
    antes: 'Para saber cuánto falta, uso la',
    despues: '(suma / resta).',
    aceptables: ['resta'],
    lectura: 'Para saber cuánto falta, ¿uso la suma o la resta?',
    explicacion: 'Para saber cuánto falta para llegar a un número, resto: le resto a lo que necesito lo que ya tengo.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length + COMPLETAR.length

// ── Bloque de estado por pregunta ──

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function TerceroModulo05() {
  const [problemas, setProblemas] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { ...ESTADO_INICIAL }])),
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
    const cProb = Object.values(problemas).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cProb + cCompleta
  }, [problemas, completa])

  const totalEvaluadas = useMemo(() => {
    const eProb = Object.values(problemas).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eProb + eCompleta
  }, [problemas, completa])

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
  function comprobarProblema(p: PreguntaDinero) {
    const actual = problemas[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.respuesta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setProblemas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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
    setProblemas(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #34d399 0%, #a7f3d0 35%, #fef9c3 100%)',
      color: '#064e3b', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #064e3b', borderBottom: '4px solid #064e3b',
      }}>
        <BotonMenu />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🐷💚</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #064e3b', margin: 0, color: 'white',
        }}>
          ¡El dinero!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Visitá el mercado del Piglin: calculá precios y vueltos en esmeraldas
        </p>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1rem' }}>
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#059669" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={problemas[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setProblemas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarProblema(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #6ee7b7', boxShadow: '0 4px 0 rgba(6,78,59,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#064e3b' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(6,78,59,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#064e3b' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#059669' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Ya sabés manejar las esmeraldas 🎮'
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

// Ejemplo resuelto — no interactivo, con un problema distinto a los 5 de
// la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const precio = 6, pago = 10, vuelto = pago - precio

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <span style={{ fontSize: '1.7rem', flexShrink: 0 }}>🥾</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: '#064e3b' }}>Botas de cuero</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0, fontWeight: 600 }}>💚 {precio} ESM</p>
        </div>
        <BotonEscuchar texto={`Ejemplo: las botas de cuero cuestan seis esmeraldas. Pagás con diez. ¿Cuánto te dan de vuelto? Pagás con ${pago} y el precio es ${precio}. El vuelto es ${pago} menos ${precio} es ${vuelto}.`} tamano={32} />
      </div>

      <p style={{ fontSize: '0.95rem', opacity: 0.75, margin: '0 0 0.25rem', fontWeight: 600 }}>Pagás con {pago}.</p>
      <p style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.6rem', color: '#064e3b' }}>¿Vuelto?</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.4rem', fontWeight: 800, color: '#064e3b' }}>
        <span>{pago}</span><span>−</span><span>{precio}</span><span>=</span><span>{vuelto}</span>
      </div>
      <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', textAlign: 'center', color: '#064e3b', opacity: 0.85 }}>
        Pagás con {pago} y el precio es {precio}. El vuelto es {pago} menos {precio} es {vuelto}.
      </p>
    </div>
  )
}

function TarjetaProblema({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaDinero
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem', flexShrink: 0,
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.7rem', flexShrink: 0 }}>{p.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: '#064e3b', overflowWrap: 'break-word' }}>{p.nombreItem}</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0, fontWeight: 600 }}>💚 {p.precio} ESM</p>
        </div>
        <BotonEscuchar texto={p.lectura} tamano={34} />
      </div>

      <p style={{ fontSize: '0.95rem', opacity: 0.75, margin: '0 0 0.25rem', fontWeight: 600 }}>{p.contexto}</p>
      <p style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0 0 0.75rem', color: '#064e3b' }}>{p.pregunta}</p>

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
            background: '#f0fdf4', color: '#064e3b', fontSize: '1.4rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.6rem 0.9rem', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1.2rem',
            opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.respuesta}`}
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
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#6ee7b7'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0fdf4',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#064e3b' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #6ee7b7',
          background: 'white', color: '#064e3b', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#064e3b' }}>{p.despues}</span>
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
