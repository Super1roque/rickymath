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

// ── Datos de la actividad (basados en la hoja "Actividad 7 - Lados y Vértices") ──
// Conocimiento geométrico estándar, no depende de contar píxeles. La
// estrella se cuenta como polígono completo (10 lados, 10 vértices —
// 5 puntas hacia afuera + 5 ángulos cóncavos hacia adentro), confirmado a
// mano por el usuario porque es un caso ambiguo.

type TipoFigura = 'triangulo' | 'cuadrado' | 'rectangulo' | 'pentagono' | 'hexagono' | 'rombo' | 'trapecio' | 'circulo' | 'estrella'

interface PreguntaFigura {
  numero: number
  tipo: TipoFigura
  nombre: string
  lados: number
  vertices: number
  explicacion: string
}

const ITEMS: PreguntaFigura[] = [
  { numero: 1, tipo: 'triangulo', nombre: 'Triángulo', lados: 3, vertices: 3, explicacion: 'El triángulo tiene 3 lados y 3 vértices — donde se juntan los lados.' },
  { numero: 2, tipo: 'cuadrado', nombre: 'Cuadrado', lados: 4, vertices: 4, explicacion: 'El cuadrado tiene 4 lados iguales y 4 vértices.' },
  { numero: 3, tipo: 'rectangulo', nombre: 'Rectángulo', lados: 4, vertices: 4, explicacion: 'El rectángulo tiene 4 lados (dos largos y dos cortos) y 4 vértices.' },
  { numero: 4, tipo: 'pentagono', nombre: 'Pentágono', lados: 5, vertices: 5, explicacion: 'El pentágono tiene 5 lados y 5 vértices.' },
  { numero: 5, tipo: 'hexagono', nombre: 'Hexágono', lados: 6, vertices: 6, explicacion: 'El hexágono tiene 6 lados y 6 vértices.' },
  { numero: 6, tipo: 'rombo', nombre: 'Rombo', lados: 4, vertices: 4, explicacion: 'El rombo tiene 4 lados iguales (inclinados) y 4 vértices.' },
  { numero: 7, tipo: 'trapecio', nombre: 'Trapecio', lados: 4, vertices: 4, explicacion: 'El trapecio tiene 4 lados (dos paralelos de distinto largo) y 4 vértices.' },
  { numero: 8, tipo: 'circulo', nombre: 'Círculo', lados: 0, vertices: 0, explicacion: 'El círculo es una curva cerrada, sin lados rectos ni vértices — por eso L es 0 y V es 0.' },
  {
    numero: 9, tipo: 'estrella', nombre: 'Estrella', lados: 10, vertices: 10,
    explicacion: 'Contada como polígono completo, la estrella de 5 puntas tiene 10 lados y 10 vértices: 5 puntas hacia afuera y 5 ángulos hacia adentro.',
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
    antes: 'El vértice es donde se juntan dos',
    despues: '.',
    aceptables: ['lados'],
    lectura: '¿Dónde se juntan dos lados?',
    explicacion: 'Un vértice es el punto exacto donde se encuentran dos lados de una figura.',
  },
  {
    numero: 2,
    antes: 'El hexágono tiene',
    despues: 'lados.',
    aceptables: ['6'],
    lectura: '¿Cuántos lados tiene el hexágono?',
    explicacion: '"Hexa" significa seis — el hexágono siempre tiene 6 lados.',
  },
  {
    numero: 3,
    antes: 'La figura sin vértices es el',
    despues: '.',
    aceptables: ['circulo'],
    lectura: '¿Cuál figura no tiene vértices?',
    explicacion: 'El círculo es la única figura de esta hoja que no tiene esquinas ni vértices — es una curva redonda.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoFigura {
  lados: string
  vertices: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_FIGURA_INICIAL: EstadoFigura = { lados: '', vertices: '', evaluado: false, correcto: false }

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function SegundoModulo07() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoFigura>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_FIGURA_INICIAL }])),
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'segundo-modulo-07', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: PreguntaFigura) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.lados.trim() === '' || actual.vertices.trim() === '') return
    const correcto = Number(actual.lados.trim()) === p.lados && Number(actual.vertices.trim()) === p.vertices
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_FIGURA_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #64748b 0%, #cbd5e1 35%, #fef9c3 100%)',
      color: '#1e293b', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #475569, #1e293b)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #0f172a', borderBottom: '4px solid #0f172a',
      }}>
        <BotonMenu href="/segundo-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🔺🔷</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #0f172a', margin: 0, color: 'white',
        }}>
          ¡Lados y vértices!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Contá los lados y los vértices de cada figura
        </p>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1rem' }}>
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#475569" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.9rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaFigura key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiarLados={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], lados: valor } }))}
              onCambiarVertices={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], vertices: valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #cbd5e1', boxShadow: '0 4px 0 rgba(15,23,42,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(15,23,42,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#1e293b' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#475569' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás lados y vértices 🎮'
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
        {tenantData?.plan !== 'premium' && <CandadoPremium />}
      </div>
    </div>
  )
}

// Genera los puntos de un polígono regular de N lados (usado para
// triángulo, pentágono y hexágono).
function poligonoRegular(lados: number, rotarGrados = -90): string {
  const puntos: string[] = []
  for (let i = 0; i < lados; i++) {
    const angulo = (rotarGrados + i * (360 / lados)) * (Math.PI / 180)
    const x = 50 + 42 * Math.cos(angulo)
    const y = 50 + 42 * Math.sin(angulo)
    puntos.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return puntos.join(' ')
}

// Dibuja cada figura a mano en SVG (sin fotos reales) — mismo enfoque que
// primero-modulo-06.
function FiguraSVG({ tipo, color }: { tipo: TipoFigura; color: string }) {
  const props = { fill: 'none', stroke: color, strokeWidth: 7, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ maxWidth: 84, maxHeight: 84 }}>
      {tipo === 'triangulo' && <polygon points={poligonoRegular(3)} {...props} />}
      {tipo === 'cuadrado' && <rect x={12} y={12} width={76} height={76} {...props} />}
      {tipo === 'rectangulo' && <rect x={5} y={25} width={90} height={50} {...props} />}
      {tipo === 'pentagono' && <polygon points={poligonoRegular(5)} {...props} />}
      {tipo === 'hexagono' && <polygon points={poligonoRegular(6)} {...props} />}
      {tipo === 'rombo' && <polygon points="50,5 95,50 50,95 5,50" {...props} />}
      {tipo === 'trapecio' && <polygon points="20,90 80,90 65,30 35,30" {...props} />}
      {tipo === 'circulo' && <circle cx={50} cy={50} r={40} {...props} />}
      {tipo === 'estrella' && (
        <polygon points="50,5 60.58,35.44 92.75,36.10 67.12,55.56 76.45,86.40 50,68 23.55,86.40 32.88,55.56 7.25,36.10 39.42,35.44" {...props} />
      )}
    </svg>
  )
}

// Ejemplo resuelto — no interactivo, con una figura distinta a las 9 de la
// actividad para no revelar ninguna respuesta.
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
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>Ejemplo resuelto — Octágono</p>
        <BotonEscuchar texto="Ejemplo: el octágono tiene 8 lados y 8 vértices." tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
        <div style={{ width: 84, height: 84 }}>
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <polygon points={poligonoRegular(8)} fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a' }}>L</p>
            <div style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', color: '#1e3a8a' }}>8</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a' }}>V</p>
            <div style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', color: '#1e3a8a' }}>8</div>
          </div>
        </div>
      </div>
      <p style={{ marginTop: '0.7rem', fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85 }}>
        &ldquo;Octa&rdquo; significa ocho — el octágono siempre tiene 8 lados y 8 vértices.
      </p>
    </div>
  )
}

function TarjetaFigura({ p, estado, color, onCambiarLados, onCambiarVertices, onComprobar, onExplicarEstado }: {
  p: PreguntaFigura
  estado: EstadoFigura
  color: string
  onCambiarLados: (valor: string) => void
  onCambiarVertices: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const listo = estado.lados.trim() !== '' && estado.vertices.trim() !== ''

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && listo) onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '0.85rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', gap: '0.3rem' }}>
        <span style={{
          width: 26, height: 26, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>{p.nombre}</p>
        <BotonEscuchar texto={`¿Cuántos lados y vértices tiene el ${p.nombre.toLowerCase()}?`} tamano={28} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
        <FiguraSVG tipo={p.tipo} color={color} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <span style={{ fontWeight: 800, color: '#1e293b' }}>L</span>
          <input
            type="number" inputMode="numeric" value={estado.lados} disabled={estado.evaluado}
            onChange={e => onCambiarLados(e.target.value)} onKeyDown={handleKeyDown} placeholder="?"
            style={{
              width: 44, padding: '0.35rem', borderRadius: 10, border: `2px solid ${color}55`,
              background: '#f8fafc', color: '#1e293b', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <span style={{ fontWeight: 800, color: '#1e293b' }}>V</span>
          <input
            type="number" inputMode="numeric" value={estado.vertices} disabled={estado.evaluado}
            onChange={e => onCambiarVertices(e.target.value)} onKeyDown={handleKeyDown} placeholder="?"
            style={{
              width: 44, padding: '0.35rem', borderRadius: 10, border: `2px solid ${color}55`,
              background: '#f8fafc', color: '#1e293b', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
            }}
          />
        </div>
      </div>

      {!estado.evaluado && (
        <button onClick={onComprobar} disabled={!listo} style={{
          width: '100%', marginTop: '0.5rem', padding: '0.4rem', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: !listo ? '#e2e8f0' : '#22c55e',
          boxShadow: !listo ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '0.9rem',
          opacity: !listo ? 0.7 : 1,
        }}>
          Comprobar ✓
        </button>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era L=${p.lados}, V=${p.vertices}`}
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
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#cbd5e1'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f8fafc',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#1e293b' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #cbd5e1',
          background: 'white', color: '#1e293b', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b' }}>{p.despues}</span>
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
