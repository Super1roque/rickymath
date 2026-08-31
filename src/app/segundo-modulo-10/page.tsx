'use client'

import { useEffect, useMemo, useState, useRef, type KeyboardEvent } from 'react'
import { reproducirCorrecto, reproducirIncorrecto, reproducirFanfarria, normalizarTexto } from '@/lib/guiaAudio'
import { fuenteJuego } from '@/lib/fuenteJuego'
import BotonEscuchar from '@/components/guia/BotonEscuchar'
import BotonExplicar from '@/components/guia/BotonExplicar'
import BotonMenu from '@/components/guia/BotonMenu'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Confetti from '@/components/guia/Confetti'
import BarraProgreso from '@/components/guia/BarraProgreso'
import Ricky, { type RickyMood } from '@/components/guia/Ricky'

// ── Datos de la actividad (basados en la hoja "Actividad 10 - Misión
// Final"). A diferencia de primero-modulo-10 (solo la respuesta final), acá
// la hoja pide escribir la ECUACIÓN completa (cada valor del enunciado más
// el resultado), así que cada problema tiene varias casillas evaluadas
// juntas — mismo criterio que TarjetaNumerar en segundo-modulo-08.

interface Problema {
  numero: number
  titulo: string
  emoji: string
  color: string
  enunciado: string
  valores: number[]
  simbolos: string[]
  explicacion: string
}

const PROBLEMAS: Problema[] = [
  {
    numero: 1, titulo: 'Alex y sus bloques', emoji: '🧱', color: '#7c3aed',
    enunciado: 'Alex tenía 25 bloques. Después encontró 18 más. Usó 12 bloques. ¿Cuántos bloques le quedan?',
    valores: [25, 18, 12, 31], simbolos: ['+', '-', '='],
    explicacion: 'Alex tenía 25 bloques, encontró 18 más (25 + 18 = 43) y usó 12 (43 - 12 = 31). Le quedan 31 bloques.',
  },
  {
    numero: 2, titulo: 'Ovejas en los corrales', emoji: '🐑', color: '#f97316',
    enunciado: 'Hay 4 corrales. En cada corral hay 6 ovejas. ¿Cuántas ovejas hay en total?',
    valores: [4, 6, 24], simbolos: ['×', '='],
    explicacion: 'Hay 4 corrales con 6 ovejas cada uno: 4 por 6 es 24 ovejas en total.',
  },
  {
    numero: 3, titulo: 'Esmeraldas repartidas', emoji: '💚', color: '#0d9488',
    enunciado: 'Hay 40 esmeraldas. Se reparten en 5 cofres. ¿Cuántas esmeraldas habrá en cada cofre?',
    valores: [40, 5, 8], simbolos: ['÷', '='],
    explicacion: 'Repartimos 40 esmeraldas en 5 cofres iguales: 40 dividido 5 es 8 esmeraldas por cofre.',
  },
  {
    numero: 4, titulo: 'Diamantes extra', emoji: '💎', color: '#2563eb',
    enunciado: 'Steve tenía 34 diamantes. Luego encontró 27 más. ¿Cuántos diamantes tiene ahora en total?',
    valores: [34, 27, 61], simbolos: ['+', '='],
    explicacion: 'Steve tenía 34 diamantes y encontró 27 más: 34 más 27 es 61 diamantes en total.',
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
    numero: 1, antes: 'Para juntar cantidades uso la', despues: '.',
    aceptables: ['suma'],
    lectura: 'Para juntar cantidades, ¿qué operación uso?',
    explicacion: 'Cuando junto cantidades y las hago más grandes, uso la suma.',
  },
  {
    numero: 2, antes: 'Para repartir en partes iguales uso la', despues: '.',
    aceptables: ['division'],
    lectura: 'Para repartir en partes iguales, ¿qué operación uso?',
    explicacion: 'Cuando reparto una cantidad en partes iguales para todos, uso la división.',
  },
]

// Reflexión final: pregunta abierta, sin una única respuesta correcta —
// cualquier cosa que el chico escriba (no vacía) se acepta, mismo criterio
// que primero-modulo-10.
interface PreguntaReflexion {
  numero: number
  pregunta: string
  lectura: string
}

const REFLEXION: PreguntaReflexion[] = [
  { numero: 1, pregunta: '¡Completé la misión del 2.º de Primaria! Lo que más me gustó fue', lectura: '¡Completaste la misión de segundo grado! ¿Qué fue lo que más te gustó aprender?' },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length + COMPLETAR.length + REFLEXION.length

// ── Bloque de estado ──

interface EstadoEcuacion { valores: string[]; evaluado: boolean; correcto: boolean }
interface EstadoSimple { valor: string; evaluado: boolean; correcto: boolean }

export default function SegundoModulo10() {
  const [problemas, setProblemas] = useState<Record<number, EstadoEcuacion>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valores: p.valores.map(() => ''), evaluado: false, correcto: false }])),
  )
  const [completa, setCompleta] = useState<Record<number, EstadoSimple>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const [reflexion, setReflexion] = useState<Record<number, EstadoSimple>>(() =>
    Object.fromEntries(REFLEXION.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const fanfarriaSonada = useRef(false)

  const [puntos, setPuntos] = useState(0)
  const [racha, setRacha] = useState(0)
  const [mejorRacha, setMejorRacha] = useState(0)

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
    const a = Object.values(problemas).filter(e => e.evaluado && e.correcto).length
    const b = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    const c = Object.values(reflexion).filter(e => e.evaluado && e.correcto).length
    return a + b + c
  }, [problemas, completa, reflexion])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(problemas).filter(e => e.evaluado).length
    const b = Object.values(completa).filter(e => e.evaluado).length
    const c = Object.values(reflexion).filter(e => e.evaluado).length
    return a + b + c
  }, [problemas, completa, reflexion])

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

  function comprobarProblema(p: Problema) {
    const actual = problemas[p.numero]
    if (actual.evaluado || actual.valores.some(v => v.trim() === '')) return
    const correcto = actual.valores.every((v, i) => Number(v.trim()) === p.valores[i])
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

  function comprobarReflexion(p: PreguntaReflexion) {
    const actual = reflexion[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    reproducirCorrecto()
    registrarResultado(true)
    reaccionarRicky(true)
    setReflexion(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto: true } }))
  }

  function reiniciar() {
    setProblemas(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valores: p.valores.map(() => ''), evaluado: false, correcto: false }])))
    setCompleta(Object.fromEntries(COMPLETAR.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
    setReflexion(Object.fromEntries(REFLEXION.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #3b82f6 0%, #bfdbfe 35%, #fef9c3 100%)',
      color: '#1e3a8a', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #1e3a8a', borderBottom: '4px solid #1e3a8a',
      }}>
        <BotonMenu href="/segundo-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🏆📦</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #1e3a8a', margin: 0, color: 'white',
        }}>
          ¡Misión final!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Leé cada problema, resolvé y escribí la ecuación completa
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#2563eb" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {PROBLEMAS.map(p => (
            <TarjetaProblema key={p.numero} p={p} estado={problemas[p.numero]}
              onCambiar={(i, valor) => setProblemas(prev => {
                const valores = [...prev[p.numero].valores]
                valores[i] = valor
                return { ...prev, [p.numero]: { ...prev[p.numero], valores } }
              })}
              onComprobar={() => comprobarProblema(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #93c5fd', boxShadow: '0 4px 0 rgba(30,58,138,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem', marginBottom: '1rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e3a8a' }}>
            📖 Completá
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {COMPLETAR.map(p => (
              <FilaCompleta key={p.numero} p={p} estado={completa[p.numero]}
                onCambiar={valor => setCompleta(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
                onComprobar={() => comprobarCompleta(p)} onExplicarEstado={reaccionarRickyExplicar} />
            ))}
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(30,58,138,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#1e3a8a' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1d4ed8' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! ¡Completaste todo Grado Segundo! 🎮🏆'
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

// Ejemplo resuelto — no interactivo, con números distintos a los 4
// problemas reales para no revelar ninguna respuesta.
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
        <BotonEscuchar texto="Ejemplo: Tenía 10 manzanas y recogí 5 más. ¿Cuántas tengo? Escribimos la ecuación completa: diez más cinco es igual a quince." tamano={32} />
      </div>

      <p style={{ fontSize: '0.9rem', margin: '0 0 0.7rem', fontWeight: 600, color: '#1e3a8a', textAlign: 'center' }}>
        🍎 Tenía 10 manzanas y recogí 5 más. ¿Cuántas tengo?
      </p>

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <CasillaEjemplo valor={10} />
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e3a8a' }}>+</span>
        <CasillaEjemplo valor={5} />
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e3a8a' }}>=</span>
        <CasillaEjemplo valor={15} destacada />
      </div>
      <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85 }}>
        Escribimos cada número del problema y el resultado: 10 + 5 = 15.
      </p>
    </div>
  )
}

function CasillaEjemplo({ valor, destacada }: { valor: number; destacada?: boolean }) {
  return (
    <span style={{
      width: 44, height: 44, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: destacada ? '#dcfce7' : '#eff6ff', border: `2px solid ${destacada ? '#22c55e' : '#93c5fd'}`,
      fontWeight: 800, fontSize: '1.15rem', color: destacada ? '#16a34a' : '#1e3a8a',
    }}>
      {valor}
    </span>
  )
}

function TarjetaProblema({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: Problema
  estado: EstadoEcuacion
  onCambiar: (indice: number, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : p.color
  const faltan = estado.valores.some(v => v.trim() === '')

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !faltan) onComprobar()
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
          width: 28, height: 28, borderRadius: 999, background: p.color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem',
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.emoji}</span>
        <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0, color: '#1e3a8a' }}>{p.titulo}</p>
        <BotonEscuchar texto={p.enunciado} tamano={32} />
      </div>

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', fontWeight: 600, color: '#1e3a8a', overflowWrap: 'break-word' }}>{p.enunciado}</p>

      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        {p.valores.map((_, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <input
              type="number"
              inputMode="numeric"
              value={estado.valores[i]}
              disabled={estado.evaluado}
              onChange={e => onCambiar(i, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 52, padding: '0.45rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
                background: '#f8fafc', color: '#1e3a8a', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
              }}
            />
            {i < p.valores.length - 1 && (
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: p.color }}>{p.simbolos[i]}</span>
            )}
          </span>
        ))}
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={faltan} style={{
            padding: '0.55rem 1.4rem', borderRadius: 12, border: 'none', cursor: faltan ? 'default' : 'pointer',
            background: faltan ? '#e2e8f0' : '#22c55e',
            boxShadow: faltan ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1rem', opacity: faltan ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.valores.map((v, i) => i < p.simbolos.length ? `${v} ${p.simbolos[i]}` : `${v}`).join(' ')}`}
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
  estado: EstadoSimple
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#93c5fd'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#eff6ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#1e3a8a' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 120, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #93c5fd',
          background: 'white', color: '#1e3a8a', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e3a8a' }}>{p.despues}</span>
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

function FilaReflexion({ p, estado, onCambiar, onComprobar }: {
  p: PreguntaReflexion
  estado: EstadoSimple
  onCambiar: (valor: string) => void
  onComprobar: () => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? '#22c55e' : '#93c5fd'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#eff6ff',
      animation: estado.evaluado ? 'gj-pop 0.4s ease' : undefined,
    }}>
      {estado.evaluado && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#1e3a8a' }}>🎉 {p.pregunta}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribí tu respuesta"
        style={{
          flex: '1 1 160px', minWidth: 0, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #93c5fd',
          background: 'white', color: '#1e3a8a', fontSize: '1rem', fontWeight: 600,
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
