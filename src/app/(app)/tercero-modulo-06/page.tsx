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

// ── Datos de la actividad (basados en la hoja "Actividad 6 - Perímetro") ──
// Lados de las figuras 5 y 6 (irregulares) confirmados a mano por el
// usuario mirando la hoja original.

function perimetro(lados: number[]): number {
  return lados.reduce((s, l) => s + l, 0)
}

function explicarPerimetro(lados: number[]): string {
  const suma = lados.join(' más ')
  return `El perímetro es la suma de todos los lados: ${suma}, que da ${perimetro(lados)}.`
}

interface PreguntaPerimetro {
  numero: number
  nombreFigura: string
  emoji: string
  lados: number[]
  dibujo: { tipo: 'rectangulo'; ancho: number; alto: number } | { tipo: 'pentagono' } | { tipo: 'triangulo' } | { tipo: 'l' }
  explicacion: string
}

const FIGURAS: PreguntaPerimetro[] = [
  { numero: 1, nombreFigura: 'Cuadrado', emoji: '🟩', lados: [5, 5, 5, 5], dibujo: { tipo: 'rectangulo', ancho: 5, alto: 5 }, explicacion: explicarPerimetro([5, 5, 5, 5]) },
  { numero: 2, nombreFigura: 'Rectángulo', emoji: '🟧', lados: [7, 3, 7, 3], dibujo: { tipo: 'rectangulo', ancho: 7, alto: 3 }, explicacion: explicarPerimetro([7, 3, 7, 3]) },
  { numero: 3, nombreFigura: 'Rectángulo', emoji: '🟧', lados: [8, 2, 8, 2], dibujo: { tipo: 'rectangulo', ancho: 8, alto: 2 }, explicacion: explicarPerimetro([8, 2, 8, 2]) },
  { numero: 4, nombreFigura: 'Triángulo', emoji: '🔺', lados: [4, 4, 6], dibujo: { tipo: 'triangulo' }, explicacion: explicarPerimetro([4, 4, 6]) },
  { numero: 5, nombreFigura: 'Figura en L', emoji: '🧩', lados: [3, 6, 3, 3, 3, 6], dibujo: { tipo: 'l' }, explicacion: explicarPerimetro([3, 6, 3, 3, 3, 6]) },
  { numero: 6, nombreFigura: 'Pentágono', emoji: '🔷', lados: [4, 5, 2, 3, 6], dibujo: { tipo: 'pentagono' }, explicacion: explicarPerimetro([4, 5, 2, 3, 6]) },
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
    antes: 'El perímetro es la suma de todos los',
    despues: '.',
    aceptables: ['lados'],
    lectura: '¿Qué se suma para calcular el perímetro?',
    explicacion: 'El perímetro se calcula sumando la medida de cada lado de la figura, uno por uno, hasta darle toda la vuelta.',
  },
  {
    numero: 2,
    antes: 'Un cuadrado de lado 5 tiene un perímetro de',
    despues: '.',
    aceptables: ['20'],
    lectura: 'Un cuadrado de lado cinco, ¿qué perímetro tiene?',
    explicacion: explicarPerimetro([5, 5, 5, 5]),
  },
  {
    numero: 3,
    antes: 'Para cercar un terreno necesito conocer su',
    despues: '.',
    aceptables: ['perimetro'],
    lectura: 'Para cercar un terreno, ¿qué necesito conocer?',
    explicacion: 'Para saber cuánta valla necesitás para cercar un terreno, tenés que conocer su perímetro, que es la distancia alrededor de toda la figura.',
  },
]

const TOTAL_PREGUNTAS = FIGURAS.length + COMPLETAR.length

// ── Bloque de estado por pregunta ──

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function TerceroModulo06() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [figuras, setFiguras] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(FIGURAS.map(p => [p.numero, { ...ESTADO_INICIAL }])),
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
    const cFig = Object.values(figuras).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cFig + cCompleta
  }, [figuras, completa])

  const totalEvaluadas = useMemo(() => {
    const eFig = Object.values(figuras).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eFig + eCompleta
  }, [figuras, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'tercero-modulo-06', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  // Se lee el estado actual del closure (no la forma funcional de setState)
  // porque acá SÍ importa ejecutar el sonido una sola vez, exactamente
  // cuando el usuario hace clic — dentro de un updater de setState el efecto
  // de sonido podría dispararse más de una vez (p. ej. en modo estricto de
  // desarrollo, que invoca los updaters dos veces).
  function comprobarFigura(p: PreguntaPerimetro) {
    const actual = figuras[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === perimetro(p.lados)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setFiguras(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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
    setFiguras(Object.fromEntries(FIGURAS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #a3e635 0%, #d9f99d 35%, #fef9c3 100%)',
      color: '#365314', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #84cc16, #65a30d)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #365314', borderBottom: '4px solid #365314',
      }}>
        <BotonMenu />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🐴🧱</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #365314', margin: 0, color: 'white',
        }}>
          ¡Perímetro!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Sumá todos los lados y escribí el perímetro en bloques
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#65a30d" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {FIGURAS.map((p, i) => (
            <TarjetaFigura key={p.numero} p={p} estado={figuras[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setFiguras(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarFigura(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #bef264', boxShadow: '0 4px 0 rgba(54,83,20,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#365314' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(54,83,20,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#365314' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#65a30d' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Ya sabés calcular el perímetro 🎮'
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

// Rectángulo a escala relativa (mismo factor para las dos figuras
// rectangulares, así se nota que una es más achatada que la otra) con el
// ancho y el alto rotulados igual que en la hoja original.
function RectanguloSVG({ ancho, alto }: { ancho: number; alto: number }) {
  const ESCALA = 11
  const w = ancho * ESCALA
  const h = alto * ESCALA
  const padX = 26
  const padTop = 22
  const padBottom = 14
  const vw = w + padX * 2
  const vh = h + padTop + padBottom
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" style={{ maxWidth: 200, display: 'block', margin: '0 auto' }}>
      <rect x={padX} y={padTop} width={w} height={h} fill="#4d7c0f" stroke="#a3e635" strokeWidth={2} rx={2} />
      <text x={vw / 2} y={padTop - 8} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">{ancho}</text>
      <text x={padX + w + 14} y={padTop + h / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">{alto}</text>
    </svg>
  )
}

// Pentágono tipo "casita" (base + dos lados verticales + techo a dos aguas)
// — coincide con la forma de la hoja original: abajo 6, lado izquierdo 2,
// lado derecho 3, techo izquierdo 4, techo derecho 5.
function PentagonoSVG() {
  const BL = { x: 20, y: 90 }
  const BR = { x: 120, y: 90 }
  const R = { x: 120, y: 55 }
  const P = { x: 70, y: 15 }
  const L = { x: 20, y: 55 }
  const path = `M${BL.x},${BL.y} L${BR.x},${BR.y} L${R.x},${R.y} L${P.x},${P.y} L${L.x},${L.y} Z`
  return (
    <svg viewBox="0 0 140 110" width="100%" style={{ maxWidth: 200, display: 'block', margin: '0 auto' }}>
      <path d={path} fill="#4d7c0f" stroke="#a3e635" strokeWidth={2} strokeLinejoin="round" />
      <text x={(BL.x + BR.x) / 2} y={BL.y + 16} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">6</text>
      <text x={BR.x + 14} y={(BR.y + R.y) / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">3</text>
      <text x={(R.x + P.x) / 2 + 12} y={(R.y + P.y) / 2} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">5</text>
      <text x={(P.x + L.x) / 2 - 12} y={(P.y + L.y) / 2} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">4</text>
      <text x={L.x - 14} y={(L.y + BL.y) / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">2</text>
    </svg>
  )
}

// Triángulo isósceles a escala real: lados 4, 4 y base 6 — la altura sale
// de Pitágoras (√(4²-3²) = √7) en vez de dibujar un triángulo genérico, así
// la proporción que ve el chico coincide con las medidas reales (sale
// bastante achatado, que es lo correcto para estas medidas).
function TrianguloSVG() {
  const ESCALA = 11
  const base = 6 * ESCALA
  const altura = Math.sqrt(4 * 4 - 3 * 3) * ESCALA
  const padX = 34
  const padTop = 18
  const padBottom = 14
  const vw = base + padX * 2
  const vh = altura + padTop + padBottom
  const BL = { x: padX, y: padTop + altura }
  const BR = { x: padX + base, y: padTop + altura }
  const Ap = { x: padX + base / 2, y: padTop }
  const path = `M${BL.x},${BL.y} L${BR.x},${BR.y} L${Ap.x},${Ap.y} Z`
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" style={{ maxWidth: 200, display: 'block', margin: '0 auto' }}>
      <path d={path} fill="#4d7c0f" stroke="#a3e635" strokeWidth={2} strokeLinejoin="round" />
      <text x={(BL.x + BR.x) / 2} y={BL.y + 16} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">6</text>
      <text x={(BL.x + Ap.x) / 2 - 14} y={(BL.y + Ap.y) / 2} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">4</text>
      <text x={(BR.x + Ap.x) / 2 + 14} y={(BR.y + Ap.y) / 2} textAnchor="middle" fontSize={13} fontWeight={800} fill="#365314">4</text>
    </svg>
  )
}

// Figura en L: un cuadrado de 6×6 con una muesca de 3×3 cortada en una
// esquina — la única forma simple (todo ángulo recto) que cierra con el
// conjunto de lados {3,3,3,3,6,6} confirmado a mano para esta figura. El
// orden exacto en que aparecían los lados en la hoja original no se sabe
// con certeza, pero para el ejercicio (sumar los 6 lados) no cambia nada.
function FiguraLSVG() {
  const ESCALA = 11
  const A = 6 * ESCALA
  const B = 3 * ESCALA
  const padX = 26
  const padTop = 18
  const padBottom = 14
  const vw = A + padX * 2
  const vh = A + padTop + padBottom
  const p1 = { x: padX, y: padTop + A }
  const p2 = { x: padX + A, y: padTop + A }
  const p3 = { x: padX + A, y: padTop + A - B }
  const p4 = { x: padX + A - B, y: padTop + A - B }
  const p5 = { x: padX + A - B, y: padTop }
  const p6 = { x: padX, y: padTop }
  const path = `M${p1.x},${p1.y} L${p2.x},${p2.y} L${p3.x},${p3.y} L${p4.x},${p4.y} L${p5.x},${p5.y} L${p6.x},${p6.y} Z`
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" style={{ maxWidth: 200, display: 'block', margin: '0 auto' }}>
      <path d={path} fill="#4d7c0f" stroke="#a3e635" strokeWidth={2} strokeLinejoin="round" />
      <text x={(p1.x + p2.x) / 2} y={p1.y + 16} textAnchor="middle" fontSize={12} fontWeight={800} fill="#365314">6</text>
      <text x={p2.x + 14} y={(p2.y + p3.y) / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="#365314">3</text>
      <text x={(p3.x + p4.x) / 2} y={p3.y - 8} textAnchor="middle" fontSize={12} fontWeight={800} fill="#365314">3</text>
      <text x={p4.x + 14} y={(p4.y + p5.y) / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="#365314">3</text>
      <text x={(p5.x + p6.x) / 2} y={p5.y - 8} textAnchor="middle" fontSize={12} fontWeight={800} fill="#365314">3</text>
      <text x={p6.x - 14} y={(p6.y + p1.y) / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="#365314">6</text>
    </svg>
  )
}

// Ejemplo resuelto — no interactivo, con un rectángulo de medidas distintas
// a las 6 figuras de la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const lados = [6, 4, 6, 4]
  const total = perimetro(lados)

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
        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🟦</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, minWidth: 0, color: '#365314' }}>Rectángulo</p>
        <BotonEscuchar texto={`Ejemplo: ¿cuál es el perímetro de este rectángulo con lados ${lados.join(', ')}? ${explicarPerimetro(lados)}`} tamano={32} />
      </div>

      <div style={{ marginBottom: '0.7rem' }}>
        <RectanguloSVG ancho={6} alto={4} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.7rem' }}>
        {lados.map((l, i) => (
          <span key={i} style={{
            background: '#f7fee7', border: '2px solid #d9f99d', color: '#365314',
            borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.95rem', fontWeight: 800,
          }}>
            {l}
          </span>
        ))}
      </div>

      <p style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 800, color: '#365314', margin: '0 0 0.4rem' }}>
        Perímetro = {total}
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#365314', opacity: 0.85, margin: 0 }}>
        {explicarPerimetro(lados)}
      </p>
    </div>
  )
}

function TarjetaFigura({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaPerimetro
  estado: EstadoPregunta
  color: string
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const total = perimetro(p.lados)
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
        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{p.emoji}</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, minWidth: 0, color: '#365314', overflowWrap: 'break-word' }}>{p.nombreFigura}</p>
        <BotonEscuchar texto={`¿Cuál es el perímetro de este ${p.nombreFigura.toLowerCase()} con lados ${p.lados.join(', ')}?`} tamano={34} />
      </div>

      <div style={{ marginBottom: '0.85rem' }}>
        {p.dibujo.tipo === 'rectangulo' ? <RectanguloSVG ancho={p.dibujo.ancho} alto={p.dibujo.alto} />
          : p.dibujo.tipo === 'pentagono' ? <PentagonoSVG />
          : p.dibujo.tipo === 'triangulo' ? <TrianguloSVG />
          : <FiguraLSVG />}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
        {p.lados.map((l, i) => (
          <span key={i} style={{
            background: '#f7fee7', border: '2px solid #d9f99d', color: '#365314',
            borderRadius: 8, padding: '0.3rem 0.6rem', fontSize: '0.95rem', fontWeight: 800,
          }}>
            {l}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, flexShrink: 0, color: '#365314' }}>P =</span>
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
            background: '#f7fee7', color: '#365314', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        <span style={{ fontSize: '0.9rem', opacity: 0.7, flexShrink: 0, fontWeight: 600 }}>bloques</span>
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.55rem 0.8rem', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1.1rem',
            opacity: estado.valor.trim() === '' ? 0.7 : 1, flexShrink: 0,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.lados.join('+')} = ${total}`}
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#bef264'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f7fee7',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#365314' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #bef264',
          background: 'white', color: '#365314', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#365314' }}>{p.despues}</span>
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
