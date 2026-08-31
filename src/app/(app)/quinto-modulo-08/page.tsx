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

// ── Datos de la actividad (basados en la hoja "Actividad 8 - Ángulos y
// Circunferencia"). Ítems 1-6: clasificar el ángulo del monumento. Ítems
// 7-8: calcular diámetro o radio. Ítem 9 ("Rotula: centro, radio,
// diámetro" sobre un círculo sin medidas) no tiene nada para autocorregir
// tal cual — confirmado con el usuario: se convierte en 3 mini-preguntas
// de vocabulario en una sola tarjeta.

type Clasificacion = 'agudo' | 'recto' | 'obtuso' | 'llano'

interface ItemAngulo {
  numero: number
  grados: number
  clasificacion: Clasificacion
}

const ANGULOS: ItemAngulo[] = [
  { numero: 1, grados: 90, clasificacion: 'recto' },
  { numero: 2, grados: 45, clasificacion: 'agudo' },
  { numero: 3, grados: 120, clasificacion: 'obtuso' },
  { numero: 4, grados: 180, clasificacion: 'llano' },
  { numero: 5, grados: 60, clasificacion: 'agudo' },
  { numero: 6, grados: 135, clasificacion: 'obtuso' },
]

const OPCIONES_CLASIFICACION: { valor: Clasificacion; etiqueta: string }[] = [
  { valor: 'agudo', etiqueta: 'Agudo' },
  { valor: 'recto', etiqueta: 'Recto' },
  { valor: 'obtuso', etiqueta: 'Obtuso' },
  { valor: 'llano', etiqueta: 'Llano' },
]

interface ItemCirculo {
  numero: number
  dado: 'radio' | 'diametro'
  valorDado: number
  pregunta: string
  resultado: number
}

const CIRCULOS: ItemCirculo[] = [
  { numero: 7, dado: 'radio', valorDado: 3, pregunta: '¿Diámetro?', resultado: 6 },
  { numero: 8, dado: 'diametro', valorDado: 10, pregunta: '¿Radio?', resultado: 5 },
]

const ROTULAR = {
  a: { pregunta: 'El punto del medio se llama', aceptables: ['centro'] },
  b: { pregunta: 'El segmento del centro al borde se llama', aceptables: ['radio'] },
  c: { pregunta: 'El segmento de borde a borde que pasa por el centro se llama', aceptables: ['diametro'] },
}

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
    numero: 1, antes: 'Un ángulo de 90° se llama', despues: '.',
    aceptables: ['recto'],
    lectura: 'Un ángulo de noventa grados, ¿cómo se llama?',
    explicacion: 'Un ángulo de exactamente 90° se llama ángulo recto.',
  },
  {
    numero: 2, antes: 'El diámetro es el doble del', despues: '.',
    aceptables: ['radio'],
    lectura: 'El diámetro es el doble de... ¿qué?',
    explicacion: 'El diámetro es el doble del radio: D = 2 × r.',
  },
  {
    numero: 3, antes: 'Un ángulo menor de 90° es', despues: '.',
    aceptables: ['agudo'],
    lectura: 'Un ángulo menor de noventa grados, ¿cómo se llama?',
    explicacion: 'Un ángulo menor de 90° se llama ángulo agudo.',
  },
]

const TOTAL_PREGUNTAS = ANGULOS.length + CIRCULOS.length + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoAngulo { seleccion: Clasificacion | null; evaluado: boolean; correcto: boolean }
interface EstadoCirculo { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoRotular { a: string; b: string; c: string; evaluado: boolean; correcto: boolean }
interface EstadoCompleta { valor: string; evaluado: boolean; correcto: boolean }

export default function QuintoModulo08() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [angulos, setAngulos] = useState<Record<number, EstadoAngulo>>(() =>
    Object.fromEntries(ANGULOS.map(p => [p.numero, { seleccion: null, evaluado: false, correcto: false }])),
  )
  const [circulos, setCirculos] = useState<Record<number, EstadoCirculo>>(() =>
    Object.fromEntries(CIRCULOS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const [rotular, setRotular] = useState<EstadoRotular>({ a: '', b: '', c: '', evaluado: false, correcto: false })
  const [completa, setCompleta] = useState<Record<number, EstadoCompleta>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const fanfarriaSonada = useRef(false)

  const [puntos, setPuntos] = useState(0)
  const [racha, setRacha] = useState(0)
  const [mejorRacha, setMejorRacha] = useState(0)

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
    const a = Object.values(angulos).filter(e => e.evaluado && e.correcto).length
    const b = Object.values(circulos).filter(e => e.evaluado && e.correcto).length
    const c = rotular.evaluado && rotular.correcto ? 1 : 0
    const d = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return a + b + c + d
  }, [angulos, circulos, rotular, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(angulos).filter(e => e.evaluado).length
    const b = Object.values(circulos).filter(e => e.evaluado).length
    const c = rotular.evaluado ? 1 : 0
    const d = Object.values(completa).filter(e => e.evaluado).length
    return a + b + c + d
  }, [angulos, circulos, rotular, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'quinto-modulo-08', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarAngulo(p: ItemAngulo) {
    const actual = angulos[p.numero]
    if (actual.evaluado || actual.seleccion === null) return
    const correcto = actual.seleccion === p.clasificacion
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setAngulos(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarCirculo(p: ItemCirculo) {
    const actual = circulos[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.resultado
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCirculos(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarRotular() {
    if (rotular.evaluado || rotular.a.trim() === '' || rotular.b.trim() === '' || rotular.c.trim() === '') return
    const correcto = ROTULAR.a.aceptables.includes(normalizarTexto(rotular.a.trim()))
      && ROTULAR.b.aceptables.includes(normalizarTexto(rotular.b.trim()))
      && ROTULAR.c.aceptables.includes(normalizarTexto(rotular.c.trim()))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setRotular(prev => ({ ...prev, evaluado: true, correcto }))
  }

  function comprobarCompleta(p: PreguntaCompleta) {
    const actual = completa[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = p.aceptables.map(normalizarTexto).includes(normalizarTexto(actual.valor.trim()))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompleta(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setAngulos(Object.fromEntries(ANGULOS.map(p => [p.numero, { seleccion: null, evaluado: false, correcto: false }])))
    setCirculos(Object.fromEntries(CIRCULOS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
    setRotular({ a: '', b: '', c: '', evaluado: false, correcto: false })
    setCompleta(Object.fromEntries(COMPLETAR.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #0d9488 0%, #5eead4 35%, #f0fdfa 100%)',
      color: '#134e4a', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #0d9488, #134e4a)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #042f2e', borderBottom: '4px solid #042f2e',
      }}>
        <BotonMenu href="/quinto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>📐🔷</div>
        <h1 style={{
          fontSize: 'clamp(1.1rem, 4.5vw, 2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #042f2e', margin: 0, color: 'white',
        }}>
          ¡Ángulos y circunferencia!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Clasificá los ángulos del monumento y medí sus círculos
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#0d9488" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {ANGULOS.map((p, i) => (
            <TarjetaAngulo key={p.numero} p={p} estado={angulos[p.numero]} color={COLORES[i % COLORES.length]}
              onSeleccionar={valor => setAngulos(prev => {
                if (prev[p.numero].evaluado) return prev
                return { ...prev, [p.numero]: { ...prev[p.numero], seleccion: valor } }
              })}
              onComprobar={() => comprobarAngulo(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {CIRCULOS.map((p, i) => (
            <TarjetaCirculo key={p.numero} p={p} estado={circulos[p.numero]} color={COLORES[(i + 6) % COLORES.length]}
              onCambiar={valor => setCirculos(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarCirculo(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
          <TarjetaRotular estado={rotular} color={COLORES[8 % COLORES.length]}
            onCambiar={(campo, valor) => setRotular(prev => ({ ...prev, [campo]: valor }))}
            onComprobar={comprobarRotular} onExplicarEstado={reaccionarRickyExplicar} />
        </div>

        <div style={{
          background: 'white', border: '3px solid #5eead4', boxShadow: '0 4px 0 rgba(4,47,46,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem', marginTop: '1rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#134e4a' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(4,47,46,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#134e4a' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0d9488' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás los ángulos y la circunferencia 🎮'
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

// Dibujo del ángulo — dos rayos desde un vértice común, el segundo rotado
// según los grados reales, igual que en la hoja original.
function AnguloVisual({ grados, color }: { grados: number; color: string }) {
  const largo = 84
  const vx = 16, vy = 74
  return (
    <div style={{ position: 'relative', width: 140, height: 90, margin: '0 auto' }}>
      <div style={{
        position: 'absolute', left: vx, top: vy, width: largo, height: 3, background: color,
        transformOrigin: 'left center', borderRadius: 2,
      }} />
      <div style={{
        position: 'absolute', left: vx, top: vy, width: largo, height: 3, background: color,
        transformOrigin: 'left center', borderRadius: 2, transform: `rotate(-${grados}deg)`,
      }} />
      <div style={{
        position: 'absolute', left: vx - 4, top: vy - 4, width: 10, height: 10, borderRadius: 999, background: color,
      }} />
      <span style={{ position: 'absolute', left: vx + 8, top: vy - 34, fontSize: '0.85rem', fontWeight: 800, color }}>
        {grados}°
      </span>
    </div>
  )
}

function SelectorClasificacion({ seleccion, evaluado, correcta, onSeleccionar }: {
  seleccion: Clasificacion | null
  evaluado: boolean
  correcta: Clasificacion
  onSeleccionar: (valor: Clasificacion) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
      {OPCIONES_CLASIFICACION.map(op => {
        const marcada = seleccion === op.valor
        let bg = 'white', borde = '#cbd5e1', texto = '#475569'
        if (!evaluado && marcada) { bg = '#134e4a'; borde = '#134e4a'; texto = 'white' }
        if (evaluado) {
          if (op.valor === correcta) { bg = '#dcfce7'; borde = '#22c55e'; texto = '#16a34a' }
          else if (marcada) { bg = '#fee2e2'; borde = '#ef4444'; texto = '#dc2626' }
        }
        return (
          <button key={op.valor} disabled={evaluado} onClick={() => onSeleccionar(op.valor)} style={{
            padding: '0.4rem 0.7rem', borderRadius: 999, border: `2px solid ${borde}`, background: bg, color: texto,
            fontWeight: 800, fontSize: '0.85rem', cursor: evaluado ? 'default' : 'pointer',
          }}>
            {op.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

function explicacionAngulo(p: ItemAngulo): string {
  const nombres: Record<Clasificacion, string> = { agudo: 'agudo (menor de 90°)', recto: 'recto (exactamente 90°)', obtuso: 'obtuso (entre 90° y 180°)', llano: 'llano (exactamente 180°)' }
  return `El ángulo mide ${p.grados}°, así que es ${nombres[p.clasificacion]}.`
}

// Ejemplo resuelto — 30°, distinto a los 6 ángulos reales para no revelar
// ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const grados = 30

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: un ángulo de treinta grados. Como es menor de noventa grados, es un ángulo agudo." tamano={32} />
      </div>

      <AnguloVisual grados={grados} color={color} />

      <p style={{ textAlign: 'center', margin: '0.3rem 0 0' }}>
        <span style={{
          padding: '0.2rem 0.7rem', borderRadius: 8, border: '2px solid #22c55e', background: '#dcfce7',
          color: '#16a34a', fontSize: '1.05rem', fontWeight: 800,
        }}>
          Agudo
        </span>
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: '0.7rem 0 0' }}>
        30° es menor de 90°, así que es un ángulo agudo.
      </p>
    </div>
  )
}

function TarjetaAngulo({ p, estado, color, onSeleccionar, onComprobar, onExplicarEstado }: {
  p: ItemAngulo
  estado: EstadoAngulo
  color: string
  onSeleccionar: (valor: Clasificacion) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s', textAlign: 'center',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <BotonEscuchar texto={`Clasificá este ángulo de ${p.grados} grados.`} tamano={32} />
      </div>

      <AnguloVisual grados={p.grados} color={color} />

      <SelectorClasificacion seleccion={estado.seleccion} evaluado={estado.evaluado} correcta={p.clasificacion} onSeleccionar={onSeleccionar} />

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={estado.seleccion === null} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: estado.seleccion === null ? 'default' : 'pointer',
            background: estado.seleccion === null ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.seleccion === null ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: estado.seleccion === null ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ Revisá la clasificación'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={explicacionAngulo(p)} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function CirculoVisual({ dado, valorDado, color }: { dado: 'radio' | 'diametro'; valorDado: number; color: string }) {
  const tam = 90
  return (
    <div style={{ position: 'relative', width: tam, height: tam, margin: '0.3rem auto' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${color}` }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, borderRadius: 999, background: color, transform: 'translate(-50%, -50%)' }} />
      {dado === 'radio' ? (
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: tam / 2, height: 2, background: color, transformOrigin: 'left center' }} />
      ) : (
        <div style={{ position: 'absolute', left: 0, top: '50%', width: tam, height: 2, background: color, transform: 'translateY(-50%)' }} />
      )}
      <span style={{
        position: 'absolute', left: '50%', top: dado === 'radio' ? '35%' : '58%', transform: 'translateX(-50%)',
        fontSize: '0.75rem', fontWeight: 800, color, background: 'white', padding: '0 0.2rem',
      }}>
        {dado === 'radio' ? `r = ${valorDado}` : `d = ${valorDado}`}
      </span>
    </div>
  )
}

function TarjetaCirculo({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemCirculo
  estado: EstadoCirculo
  color: string
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && estado.valor.trim() !== '') onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s', textAlign: 'center',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <BotonEscuchar texto={`El ${p.dado} mide ${p.valorDado}. ${p.pregunta}`} tamano={32} />
      </div>

      <CirculoVisual dado={p.dado} valorDado={p.valorDado} color={color} />

      <p style={{ fontWeight: 800, fontSize: '1.1rem', margin: '0.3rem 0 0.5rem', color: '#134e4a' }}>{p.pregunta}</p>

      <input
        type="number"
        inputMode="numeric"
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="?"
        style={{
          width: 80, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
          background: '#f0fdfa', color: '#134e4a', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
        }}
      />

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: estado.valor.trim() === '' ? 'default' : 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.resultado}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Si el ${p.dado} es ${p.valorDado}, el ${p.dado === 'radio' ? 'diámetro es el doble' : 'radio es la mitad'}: ${p.resultado}.`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaRotular({ estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  estado: EstadoRotular
  color: string
  onCambiar: (campo: 'a' | 'b' | 'c', valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const faltan = estado.a.trim() === '' || estado.b.trim() === '' || estado.c.trim() === ''

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !faltan) onComprobar()
  }

  const filaEstilo = {
    display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' as const, justifyContent: 'flex-start',
  }
  const inputEstilo = {
    width: 110, padding: '0.3rem 0.5rem', borderRadius: 8, border: `2px solid ${bordeColor}55`,
    background: '#f0fdfa', color: '#134e4a', fontSize: '0.95rem', fontWeight: 700, textAlign: 'center' as const,
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
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          9
        </span>
        <p style={{ margin: 0, fontWeight: 800, color: '#134e4a', fontSize: '0.95rem' }}>Rotulá: centro, radio, diámetro</p>
        <BotonEscuchar texto="Rotulá las partes de la circunferencia: el punto del medio, el segmento del centro al borde, y el segmento de borde a borde que pasa por el centro." tamano={32} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
        <div style={filaEstilo}>
          <span style={{ fontSize: '0.85rem', color: '#134e4a', fontWeight: 600 }}>{ROTULAR.a.pregunta}</span>
          <input value={estado.a} disabled={estado.evaluado} onChange={e => onCambiar('a', e.target.value)} onKeyDown={handleKeyDown} style={inputEstilo} />
        </div>
        <div style={filaEstilo}>
          <span style={{ fontSize: '0.85rem', color: '#134e4a', fontWeight: 600 }}>{ROTULAR.b.pregunta}</span>
          <input value={estado.b} disabled={estado.evaluado} onChange={e => onCambiar('b', e.target.value)} onKeyDown={handleKeyDown} style={inputEstilo} />
        </div>
        <div style={filaEstilo}>
          <span style={{ fontSize: '0.85rem', color: '#134e4a', fontWeight: 600 }}>{ROTULAR.c.pregunta}</span>
          <input value={estado.c} disabled={estado.evaluado} onChange={e => onCambiar('c', e.target.value)} onKeyDown={handleKeyDown} style={inputEstilo} />
        </div>
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={faltan} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: faltan ? 'default' : 'pointer',
            background: faltan ? '#e2e8f0' : '#22c55e',
            boxShadow: faltan ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: faltan ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ Eran centro, radio y diámetro'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto="El centro es el punto del medio del círculo. El radio va del centro al borde. El diámetro va de borde a borde pasando por el centro, y es el doble del radio." onEstadoCambia={onExplicarEstado} />
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#5eead4'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0fdfa',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#134e4a' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 110, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #5eead4',
          background: 'white', color: '#134e4a', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#134e4a' }}>{p.despues}</span>
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
