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
import { useAuth } from '@/contexts/AuthContext'
import { usePerfil } from '@/contexts/PerfilContext'
import { guardarProgresoModulo } from '@/lib/progreso'

// ── Datos de la actividad (basados en la hoja "Actividad 10 - Misión Final") ──
// La respuesta de cada problema sale entera del enunciado (no depende de
// contar ningún dibujo), así que no hizo falta pedirle confirmación al
// usuario — mismo criterio que tercero-modulo-10.

interface Problema {
  numero: number
  titulo: string
  emoji: string
  enunciado: string
  respuesta: number
  explicacion: string
}

const PROBLEMAS: Problema[] = [
  {
    numero: 1, titulo: 'Sumar bloques', emoji: '🟩',
    enunciado: 'Steve tiene 4 bloques y encuentra 3 más. ¿Cuántos tiene?',
    respuesta: 7,
    explicacion: 'Steve tenía 4 bloques y encontró 3 más. Sumamos: 4 más 3 es 7.',
  },
  {
    numero: 2, titulo: 'Las manzanas', emoji: '🍎',
    enunciado: 'Alex tenía 6 manzanas y comió 2. ¿Cuántas le quedan?',
    respuesta: 4,
    explicacion: 'Alex tenía 6 manzanas y comió 2. Restamos: 6 menos 2 es 4.',
  },
  {
    numero: 3, titulo: 'El corral', emoji: '🐑',
    enunciado: 'En el corral hay 5 ovejas y llegan 3 más. ¿Cuántas hay?',
    respuesta: 8,
    explicacion: 'Había 5 ovejas y llegaron 3 más. Sumamos: 5 más 3 es 8.',
  },
  {
    numero: 4, titulo: 'Las antorchas', emoji: '🔥',
    enunciado: 'Había 8 antorchas y se apagaron 3. ¿Cuántas quedan encendidas?',
    respuesta: 5,
    explicacion: 'Había 8 antorchas y se apagaron 3. Restamos: 8 menos 3 es 5.',
  },
  {
    numero: 5, titulo: 'Los diamantes', emoji: '💎',
    enunciado: 'Junté 2 diamantes por la mañana y 4 por la tarde. ¿Cuántos junté?',
    respuesta: 6,
    explicacion: 'Junté 2 diamantes por la mañana y 4 por la tarde. Sumamos: 2 más 4 es 6.',
  },
  {
    numero: 6, titulo: 'Las zanahorias', emoji: '🥕',
    enunciado: 'Tenía 7 zanahorias y regalé 5. ¿Cuántas me quedan?',
    respuesta: 2,
    explicacion: 'Tenía 7 zanahorias y regalé 5. Restamos: 7 menos 5 es 2.',
  },
]

const TOTAL_PROBLEMAS = PROBLEMAS.length

// Reflexión final: preguntas abiertas, sin una única respuesta correcta —
// cualquier cosa que el chico escriba (no vacía) se acepta, mismo criterio
// que primero-modulo-05.
interface PreguntaReflexion {
  numero: number
  pregunta: string
  lectura: string
}

const REFLEXION: PreguntaReflexion[] = [
  { numero: 1, pregunta: 'Hoy aprendí que', lectura: '¿Qué aprendiste hoy?' },
  { numero: 2, pregunta: 'La operación que más usé fue', lectura: '¿Cuál fue la operación que más usaste: sumar o restar?' },
  { numero: 3, pregunta: 'Lo que más me gustó fue', lectura: '¿Qué fue lo que más te gustó?' },
]

const TOTAL_PREGUNTAS = TOTAL_PROBLEMAS + REFLEXION.length

// ── Bloque de estado ──

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function PrimeroModulo10() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [problemas, setProblemas] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { ...ESTADO_INICIAL }])),
  )
  const [reflexion, setReflexion] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(REFLEXION.map(p => [p.numero, { ...ESTADO_INICIAL }])),
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
    const cProb = Object.values(problemas).filter(e => e.evaluado && e.correcto).length
    const cReflexion = Object.values(reflexion).filter(e => e.evaluado && e.correcto).length
    return cProb + cReflexion
  }, [problemas, reflexion])

  const totalEvaluadas = useMemo(() => {
    const eProb = Object.values(problemas).filter(e => e.evaluado).length
    const eReflexion = Object.values(reflexion).filter(e => e.evaluado).length
    return eProb + eReflexion
  }, [problemas, reflexion])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'primero-modulo-10', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarProblema(p: Problema) {
    const actual = problemas[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.respuesta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setProblemas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarReflexion(p: PreguntaReflexion) {
    const actual = reflexion[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    reproducirCorrecto()
    registrarResultado(true)
    reaccionarRicky(true)
    setReflexion(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto: true } }))
  }

  function reiniciar() {
    setProblemas(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
    setReflexion(Object.fromEntries(REFLEXION.map(p => [p.numero, { ...ESTADO_INICIAL }])))
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
        background: 'linear-gradient(135deg, #d946ef, #a21caf)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #701a75', borderBottom: '4px solid #701a75',
      }}>
        <BotonMenu href="/primero-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🏆⛏️</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #701a75', margin: 0, color: 'white',
        }}>
          ¡Misión final!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Leé cada problema y escribí la respuesta
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#d946ef" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={problemas[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setProblemas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarProblema(p)} onExplicarEstado={reaccionarRickyExplicar} />
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
            {REFLEXION.map(p => (
              <FilaReflexion key={p.numero} p={p} estado={reflexion[p.numero]}
                onCambiar={valor => setReflexion(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
                onComprobar={() => comprobarReflexion(p)} />
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
                ? '¡Perfecto! ¡Completaste todo Grado Primero! 🎮🏆'
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

function TarjetaProblema({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: Problema
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem',
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.emoji}</span>
        <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0, color: '#701a75' }}>{p.titulo}</p>
        <BotonEscuchar texto={p.enunciado} tamano={32} />
      </div>

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.7rem', fontWeight: 600, color: '#701a75', overflowWrap: 'break-word' }}>{p.enunciado}</p>

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
            flex: 1, minWidth: 0, width: '100%', padding: '0.55rem', borderRadius: 12, border: `2px solid ${color}55`,
            background: '#faf5ff', color: '#701a75', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.respuesta}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function FilaReflexion({ p, estado, onCambiar, onComprobar }: {
  p: PreguntaReflexion
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? '#22c55e' : '#f0abfc'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#faf5ff',
      animation: estado.evaluado ? 'gj-pop 0.4s ease' : undefined,
    }}>
      {estado.evaluado && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#701a75' }}>{p.numero}. {p.pregunta}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribí tu respuesta"
        style={{
          flex: '1 1 160px', minWidth: 0, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #f0abfc',
          background: 'white', color: '#701a75', fontSize: '1rem', fontWeight: 600,
        }}
      />
      {!estado.evaluado ? (
        <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
          padding: '0.45rem 0.9rem', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
          boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1.05rem',
          opacity: estado.valor.trim() === '' ? 0.7 : 1,
        }}>
          ✓
        </button>
      ) : (
        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#16a34a' }}>✅</span>
      )}
    </div>
  )
}
