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

// ── Datos de la actividad (basados en la hoja "Actividad 7 - Ángulos y Figuras") ──
// Clave de respuestas confirmada a mano por el usuario mirando la hoja
// original — a diferencia de un cálculo, acá depende de cómo se ve el
// ángulo marcado en cada dibujo. En vez de recrear la imagen exacta de
// Minecraft, se dibuja el ángulo real (mismos grados que la clasificación
// correcta) con líneas — matemáticamente honesto, no depende de adivinar
// bien el arte original.

type TipoAngulo = 'recto' | 'agudo' | 'obtuso'

function explicarAngulo(grados: number, tipo: TipoAngulo): string {
  if (tipo === 'recto') return 'Este ángulo mide exactamente 90 grados, como la esquina de una hoja de papel — por eso es un ángulo recto.'
  if (tipo === 'agudo') return `Este ángulo mide ${grados} grados, menos de 90 — por eso es un ángulo agudo, se ve cerrado y puntiagudo.`
  return `Este ángulo mide ${grados} grados, más de 90 — por eso es un ángulo obtuso, se ve más abierto.`
}

interface PreguntaAngulo {
  numero: number
  emoji: string
  contexto: string
  grados: number
  correcta: TipoAngulo
  explicacion: string
}

const ANGULOS: PreguntaAngulo[] = [
  { numero: 1, emoji: '🏠', contexto: 'Esquina de una casa', grados: 90, correcta: 'recto', explicacion: explicarAngulo(90, 'recto') },
  { numero: 2, emoji: '🏹', contexto: 'Punta de una flecha', grados: 45, correcta: 'agudo', explicacion: explicarAngulo(45, 'agudo') },
  { numero: 3, emoji: '🪵', contexto: 'Techo de madera en arco', grados: 130, correcta: 'obtuso', explicacion: explicarAngulo(130, 'obtuso') },
  { numero: 4, emoji: '➕', contexto: 'Cruce de caminos', grados: 90, correcta: 'recto', explicacion: explicarAngulo(90, 'recto') },
  { numero: 5, emoji: '⛰️', contexto: 'Pico de una montaña', grados: 50, correcta: 'agudo', explicacion: explicarAngulo(50, 'agudo') },
  { numero: 6, emoji: '🌄', contexto: 'Base de una pendiente', grados: 60, correcta: 'agudo', explicacion: explicarAngulo(60, 'agudo') },
  { numero: 7, emoji: '🚪', contexto: 'Marco de una puerta', grados: 90, correcta: 'recto', explicacion: explicarAngulo(90, 'recto') },
  { numero: 8, emoji: '🗡️', contexto: 'Punta de una espada', grados: 30, correcta: 'agudo', explicacion: explicarAngulo(30, 'agudo') },
  { numero: 9, emoji: '🦇', contexto: 'Ala de un murciélago', grados: 140, correcta: 'obtuso', explicacion: explicarAngulo(140, 'obtuso') },
]

const OPCIONES: { valor: TipoAngulo; label: string }[] = [
  { valor: 'recto', label: 'RECTO' },
  { valor: 'agudo', label: 'AGUDO' },
  { valor: 'obtuso', label: 'OBTUSO' },
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
    antes: 'El ángulo recto mide',
    despues: 'grados.',
    aceptables: ['90'],
    lectura: '¿Cuántos grados mide el ángulo recto?',
    explicacion: 'El ángulo recto siempre mide exactamente 90 grados — es el ángulo de referencia para clasificar a los demás.',
  },
  {
    numero: 2,
    antes: 'El ángulo que mide menos de 90° se llama',
    despues: '.',
    aceptables: ['agudo'],
    lectura: '¿Cómo se llama el ángulo que mide menos de noventa grados?',
    explicacion: 'Un ángulo que mide menos de 90 grados se llama agudo — se ve cerrado, como la punta de una flecha.',
  },
  {
    numero: 3,
    antes: 'El que mide más de 90° se llama',
    despues: '.',
    aceptables: ['obtuso'],
    lectura: '¿Cómo se llama el ángulo que mide más de noventa grados?',
    explicacion: 'Un ángulo que mide más de 90 grados se llama obtuso — se ve más abierto que una escuadra.',
  },
]

const TOTAL_PREGUNTAS = ANGULOS.length + COMPLETAR.length

// ── Bloque de estado por pregunta ──

interface EstadoAngulo {
  seleccion: TipoAngulo | null
  evaluado: boolean
  correcto: boolean
}

interface EstadoCompleta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_ANGULO_INICIAL: EstadoAngulo = { seleccion: null, evaluado: false, correcto: false }
const ESTADO_COMPLETA_INICIAL: EstadoCompleta = { valor: '', evaluado: false, correcto: false }

export default function TerceroModulo07() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [angulos, setAngulos] = useState<Record<number, EstadoAngulo>>(() =>
    Object.fromEntries(ANGULOS.map(p => [p.numero, { ...ESTADO_ANGULO_INICIAL }])),
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
    const cAng = Object.values(angulos).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cAng + cCompleta
  }, [angulos, completa])

  const totalEvaluadas = useMemo(() => {
    const eAng = Object.values(angulos).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eAng + eCompleta
  }, [angulos, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'tercero-modulo-07', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  // Se lee el estado actual del closure (no la forma funcional de setState)
  // porque acá SÍ importa ejecutar el sonido una sola vez, exactamente
  // cuando el usuario hace clic — dentro de un updater de setState el efecto
  // de sonido podría dispararse más de una vez (p. ej. en modo estricto de
  // desarrollo, que invoca los updaters dos veces).
  function elegirAngulo(p: PreguntaAngulo, opcion: TipoAngulo) {
    const actual = angulos[p.numero]
    if (actual.evaluado) return
    const correcto = opcion === p.correcta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setAngulos(prev => ({ ...prev, [p.numero]: { seleccion: opcion, evaluado: true, correcto } }))
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
    setAngulos(Object.fromEntries(ANGULOS.map(p => [p.numero, { ...ESTADO_ANGULO_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #a78bfa 0%, #ddd6fe 35%, #fef9c3 100%)',
      color: '#4c1d95', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #4c1d95', borderBottom: '4px solid #4c1d95',
      }}>
        <BotonMenu />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>📐🧭</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #4c1d95', margin: 0, color: 'white',
        }}>
          ¡Ángulos y figuras!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Observá cada ángulo y marcá si es recto, agudo u obtuso
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#7c3aed" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ANGULOS.map((p, i) => (
            <TarjetaAngulo key={p.numero} p={p} estado={angulos[p.numero]} color={COLORES[i % COLORES.length]}
              onElegir={opcion => elegirAngulo(p, opcion)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #c4b5fd', boxShadow: '0 4px 0 rgba(76,29,149,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4c1d95' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(76,29,149,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#4c1d95' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#7c3aed' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás los ángulos 🎮'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi los dominás.'
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

function puntoEnCirculo(centro: { x: number; y: number }, radio: number, grados: number) {
  const rad = (grados * Math.PI) / 180
  return { x: centro.x + radio * Math.cos(rad), y: centro.y - radio * Math.sin(rad) }
}

// Arco dibujado como polilínea (varios segmentos rectos cortos), no con el
// comando SVG "A" — así no hay que lidiar con el flag de sentido del arco,
// que es fácil de arruinar sin poder ver el resultado en el momento.
function arcoPoligonal(centro: { x: number; y: number }, radio: number, desde: number, hasta: number, pasos = 16): string {
  const pts = Array.from({ length: pasos + 1 }, (_, i) => puntoEnCirculo(centro, radio, desde + (hasta - desde) * (i / pasos)))
  return 'M ' + pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')
}

// Dibuja el ángulo real (no la imagen de Minecraft) con dos rayos desde un
// vértice — un rayo fijo horizontal y el otro rotado la cantidad de grados
// que corresponde a la clasificación correcta. Ángulo recto: cuadradito en
// el vértice (la convención matemática habitual). Agudo/obtuso: arco.
function AnguloSVG({ grados, color }: { grados: number; color: string }) {
  const vw = 160
  const vh = 110
  const vertice = { x: 26, y: vh - 18 }
  const radioLinea = 100
  const p1 = puntoEnCirculo(vertice, radioLinea, 0)
  const p2 = puntoEnCirculo(vertice, radioLinea, grados)

  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" style={{ maxWidth: 170, display: 'block', margin: '0 auto' }}>
      <line x1={vertice.x} y1={vertice.y} x2={p1.x} y2={p1.y} stroke={color} strokeWidth={4} strokeLinecap="round" />
      <line x1={vertice.x} y1={vertice.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={4} strokeLinecap="round" />
      {grados === 90 ? (
        <rect x={vertice.x} y={vertice.y - 16} width={16} height={16} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
      ) : (
        <path d={arcoPoligonal(vertice, 24, 0, grados)} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
      )}
    </svg>
  )
}

// Ejemplo resuelto — no interactivo, con un ángulo distinto a los 9 de la
// actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const grados = 100

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🛩️</span>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0, flex: 1, minWidth: 0, fontWeight: 600, color: '#4c1d95' }}>Ala de un avión de papel</p>
        <BotonEscuchar texto={`Ejemplo: ¿qué tipo de ángulo es el del ala de un avión de papel? ${explicarAngulo(grados, 'obtuso')}`} tamano={32} />
      </div>

      <AnguloSVG grados={grados} color={color} />

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem' }}>
        {OPCIONES.map(o => (
          <div key={o.valor} style={{
            flex: 1, textAlign: 'center', padding: '0.55rem 0.2rem', borderRadius: 10,
            border: `2px solid ${o.valor === 'obtuso' ? '#22c55e' : '#ddd6fe'}`,
            background: o.valor === 'obtuso' ? '#dcfce7' : '#f5f3ff',
            color: o.valor === 'obtuso' ? '#16a34a' : '#4c1d95', fontWeight: 800, fontSize: '0.78rem',
          }}>
            {o.label}{o.valor === 'obtuso' ? ' ✅' : ''}
          </div>
        ))}
      </div>
      <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', textAlign: 'center', color: '#4c1d95', opacity: 0.85 }}>
        {explicarAngulo(grados, 'obtuso')}
      </p>
    </div>
  )
}

function TarjetaAngulo({ p, estado, color, onElegir, onExplicarEstado }: {
  p: PreguntaAngulo
  estado: EstadoAngulo
  color: string
  onElegir: (opcion: TipoAngulo) => void
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{p.emoji}</span>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0, flex: 1, minWidth: 0, fontWeight: 600, color: '#4c1d95', overflowWrap: 'break-word' }}>{p.contexto}</p>
        <BotonEscuchar texto={`¿Qué tipo de ángulo es el de ${p.contexto.toLowerCase()}?`} tamano={32} />
      </div>

      <AnguloSVG grados={p.grados} color={color} />

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.7rem' }}>
        {OPCIONES.map(o => {
          const esElegida = estado.seleccion === o.valor
          const esLaCorrecta = estado.evaluado && o.valor === p.correcta
          let bg = '#f5f3ff'
          let borde = '#ddd6fe'
          let textColor = '#4c1d95'
          if (estado.evaluado) {
            if (esElegida && estado.correcto) { bg = '#dcfce7'; borde = '#22c55e'; textColor = '#16a34a' }
            else if (esElegida && !estado.correcto) { bg = '#fee2e2'; borde = '#ef4444'; textColor = '#dc2626' }
            else if (esLaCorrecta) { bg = '#dcfce7'; borde = '#86efac'; textColor = '#16a34a' }
          }
          return (
            <button key={o.valor} onClick={() => onElegir(o.valor)} disabled={estado.evaluado} style={{
              flex: 1, minWidth: 0, padding: '0.55rem 0.2rem', borderRadius: 10, border: `2px solid ${borde}`,
              background: bg, color: textColor, fontWeight: 800, fontSize: '0.78rem',
              cursor: estado.evaluado ? 'default' : 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#c4b5fd'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f5f3ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#4c1d95' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #c4b5fd',
          background: 'white', color: '#4c1d95', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#4c1d95' }}>{p.despues}</span>
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
