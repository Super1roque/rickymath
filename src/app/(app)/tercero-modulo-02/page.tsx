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
import CandadoPremium from '@/components/guia/CandadoPremium'

// ── Datos de la actividad (basados en la hoja "Actividad 2 - División") ──

interface PreguntaDiv {
  numero: number
  a: number
  b: number
  icono: string
  nombreIcono: string
  explicacion: string
}

// Explicación por "cuántas veces cabe" — busca el múltiplo de b más cercano
// a a sin pasarse, y muestra qué sobra. Es el mismo razonamiento que
// después hace falta para la pregunta de Completa sobre exacta/inexacta.
function explicarDiv(a: number, b: number): string {
  const cociente = Math.floor(a / b)
  const resto = a % b
  const producto = cociente * b
  const base = `Para resolver ${a} dividido ${b}, busco cuántas veces cabe ${b} en ${a}: ${b} por ${cociente} es ${producto}.`
  return resto === 0
    ? `${base} Como ${producto} es exactamente ${a}, el cociente es ${cociente} y no sobra nada.`
    : `${base} Como ${a} menos ${producto} es ${resto}, el cociente es ${cociente} y sobra ${resto}.`
}

const DIVISIONES: PreguntaDiv[] = [
  { numero: 1, a: 24, b: 4, icono: '🍉', nombreIcono: 'sandías', explicacion: explicarDiv(24, 4) },
  { numero: 2, a: 35, b: 5, icono: '🏹', nombreIcono: 'flechas', explicacion: explicarDiv(35, 5) },
  { numero: 3, a: 19, b: 3, icono: '🐷', nombreIcono: 'cerditos', explicacion: explicarDiv(19, 3) },
  { numero: 4, a: 42, b: 6, icono: '🧱', nombreIcono: 'bloques de piedra', explicacion: explicarDiv(42, 6) },
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
    antes: 'El número que se reparte se llama',
    despues: '.',
    aceptables: ['dividendo'],
    lectura: 'El número que se reparte en una división, ¿cómo se llama?',
    explicacion: 'El número que se reparte en una división se llama dividendo, y el número por el que se divide se llama divisor.',
  },
  {
    numero: 2,
    antes: '19 ÷ 3 da 6 y sobra',
    despues: '.',
    aceptables: ['1', 'uno'],
    lectura: 'Diecinueve dividido tres da seis, ¿cuánto sobra?',
    explicacion: explicarDiv(19, 3),
  },
  {
    numero: 3,
    antes: 'Si el resto es 0, la división es',
    despues: '(exacta o inexacta).',
    aceptables: ['exacta'],
    lectura: 'Si el resto es cero, ¿la división es exacta o inexacta?',
    explicacion: 'Si al dividir no sobra nada, la división es exacta. Si sobra algo, es inexacta.',
  },
]

const TOTAL_PREGUNTAS = DIVISIONES.length + COMPLETAR.length

// ── Bloque de estado por pregunta ──

interface EstadoDiv {
  cociente: string
  resto: string
  evaluado: boolean
  correcto: boolean
}

interface EstadoCompleta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_DIV_INICIAL: EstadoDiv = { cociente: '', resto: '', evaluado: false, correcto: false }
const ESTADO_COMPLETA_INICIAL: EstadoCompleta = { valor: '', evaluado: false, correcto: false }

export default function TerceroModulo02() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [div, setDiv] = useState<Record<number, EstadoDiv>>(() =>
    Object.fromEntries(DIVISIONES.map(p => [p.numero, { ...ESTADO_DIV_INICIAL }])),
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
    const cDiv = Object.values(div).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cDiv + cCompleta
  }, [div, completa])

  const totalEvaluadas = useMemo(() => {
    const eDiv = Object.values(div).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eDiv + eCompleta
  }, [div, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'tercero-modulo-02', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  // Se lee el estado actual del closure (no la forma funcional de setState)
  // porque acá SÍ importa ejecutar el sonido una sola vez, exactamente
  // cuando el usuario hace clic — dentro de un updater de setState el efecto
  // de sonido podría dispararse más de una vez (p. ej. en modo estricto de
  // desarrollo, que invoca los updaters dos veces).
  function comprobarDiv(p: PreguntaDiv) {
    const actual = div[p.numero]
    if (actual.evaluado || actual.cociente.trim() === '' || actual.resto.trim() === '') return
    const correcto = Number(actual.cociente.trim()) === Math.floor(p.a / p.b) && Number(actual.resto.trim()) === p.a % p.b
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setDiv(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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
    setDiv(Object.fromEntries(DIVISIONES.map(p => [p.numero, { ...ESTADO_DIV_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #e879f9 0%, #f5d0fe 35%, #fef9c3 100%)',
      color: '#701a75', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #c026d3, #a21caf)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #581c87', borderBottom: '4px solid #581c87',
      }}>
        <BotonMenu />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🍉🐷</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #581c87', margin: 0, color: 'white',
        }}>
          ¡A dividir!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Resolvé cada división — algunas dejan resto, ¡escribilo también!
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#c026d3" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {DIVISIONES.map((p, i) => (
            <TarjetaDiv key={p.numero} p={p} estado={div[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiarCociente={valor => setDiv(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], cociente: valor } }))}
              onCambiarResto={valor => setDiv(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], resto: valor } }))}
              onComprobar={() => comprobarDiv(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #f0abfc', boxShadow: '0 4px 0 rgba(112,26,117,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#701a75' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(112,26,117,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#701a75' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#a21caf' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás la división 🎮'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi la dominás.'
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
        {tenantData?.plan !== 'premium' && <CandadoPremium />}
      </div>
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con números distintos a los 4 de la
// actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const a = 17, b = 3
  const cociente = Math.floor(a / b)
  const resto = a % b

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
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#701a75' }}>Ejemplo resuelto</p>
        <BotonEscuchar texto={explicarDiv(a, b)} tamano={32} />
      </div>

      <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.2rem' }}>{'🍎'.repeat(4)}</div>
      <p style={{ fontSize: '0.8rem', textAlign: 'center', opacity: 0.6, marginBottom: '0.5rem', fontWeight: 600, color: '#701a75' }}>manzanas</p>

      <div style={{ fontSize: '2rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.4rem', color: '#701a75' }}>
        {a} ÷ {b} = {cociente} <span style={{ fontSize: '1.1rem', opacity: 0.75 }}>y sobran {resto}</span>
      </div>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#701a75', opacity: 0.85, margin: 0 }}>
        {explicarDiv(a, b)}
      </p>
    </div>
  )
}

function TarjetaDiv({ p, estado, color, onCambiarCociente, onCambiarResto, onComprobar, onExplicarEstado }: {
  p: PreguntaDiv
  estado: EstadoDiv
  color: string
  onCambiarCociente: (valor: string) => void
  onCambiarResto: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const cocienteReal = Math.floor(p.a / p.b)
  const restoReal = p.a % p.b
  const listo = estado.cociente.trim() !== '' && estado.resto.trim() !== ''
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <BotonEscuchar texto={`¿${p.a} dividido ${p.b}?`} tamano={34} />
      </div>

      <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.2rem' }}>{p.icono.repeat(4)}</div>
      <p style={{ fontSize: '0.8rem', textAlign: 'center', opacity: 0.6, marginBottom: '0.5rem', fontWeight: 600 }}>{p.nombreIcono}</p>

      <div style={{ fontSize: '2rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.75rem', color: '#701a75' }}>
        {p.a} ÷ {p.b}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.65, marginBottom: '0.25rem', textAlign: 'center', fontWeight: 700 }}>COCIENTE</label>
          <input
            type="number" inputMode="numeric" value={estado.cociente} disabled={estado.evaluado}
            onChange={e => onCambiarCociente(e.target.value)} onKeyDown={handleKeyDown}
            style={{
              width: '100%', padding: '0.6rem', borderRadius: 12, border: `2px solid ${color}55`,
              background: '#faf5ff', color: '#701a75', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
            }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', opacity: 0.65, marginBottom: '0.25rem', textAlign: 'center', fontWeight: 700 }}>RESTO</label>
          <input
            type="number" inputMode="numeric" value={estado.resto} disabled={estado.evaluado}
            onChange={e => onCambiarResto(e.target.value)} onKeyDown={handleKeyDown}
            style={{
              width: '100%', padding: '0.6rem', borderRadius: 12, border: `2px solid ${color}55`,
              background: '#faf5ff', color: '#701a75', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
            }}
          />
        </div>
      </div>

      {!estado.evaluado && (
        <button onClick={onComprobar} disabled={!listo} style={{
          width: '100%', padding: '0.6rem', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: !listo ? '#e2e8f0' : '#22c55e',
          boxShadow: !listo ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1.05rem',
          opacity: !listo ? 0.7 : 1,
        }}>
          Comprobar ✓
        </button>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.5rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era cociente ${cocienteReal}, resto ${restoReal}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.3rem' }}>
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#f0abfc'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fdf4ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#701a75' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #f0abfc',
          background: 'white', color: '#701a75', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#701a75' }}>{p.despues}</span>
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
