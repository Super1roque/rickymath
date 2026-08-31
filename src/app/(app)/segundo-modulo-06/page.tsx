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

// ── Datos de la actividad (basados en la hoja "Actividad 6 - Secuencias Numéricas") ──
// Los números y el patrón de figuras salen directo de la hoja (impresos),
// sin ambigüedad de conteo.

interface PreguntaSecuencia {
  numero: number
  titulo: string
  emoji: string
  terminos: [number, number, number]
  paso: number
  explicacion: string
}

const SECUENCIAS: PreguntaSecuencia[] = [
  { numero: 1, titulo: 'De 2 en 2', emoji: '🟩', terminos: [2, 4, 6], paso: 2, explicacion: 'Cada bloque suma 2 al anterior: 2, 4, 6, 8, 10, 12.' },
  { numero: 2, titulo: 'De 5 en 5', emoji: '🪨', terminos: [5, 10, 15], paso: 5, explicacion: 'Cada bloque suma 5 al anterior: 5, 10, 15, 20, 25, 30.' },
  { numero: 3, titulo: 'De 10 en 10', emoji: '🟨', terminos: [10, 20, 30], paso: 10, explicacion: 'Cada bloque suma 10 al anterior: 10, 20, 30, 40, 50, 60.' },
  { numero: 4, titulo: 'Descendente 1 en 1', emoji: '🧱', terminos: [20, 19, 18], paso: -1, explicacion: 'Cada bloque resta 1 al anterior: 20, 19, 18, 17, 16, 15.' },
]

const PATRON_FIGURAS = {
  numero: 5,
  titulo: 'Patrón figuras',
  patron: ['🟩', '🔥', '🟩', '🔥'],
  siguientes: ['🟩', '🔥'] as [string, string],
  explicacion: 'El patrón se repite de a dos: tierra, antorcha, tierra, antorcha… y sigue igual: tierra, antorcha.',
}

const OPCIONES_FIGURA = [
  { valor: '🟩', label: 'Tierra' },
  { valor: '🔥', label: 'Antorcha' },
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
    antes: 'En la secuencia de 5 en 5, después del 15 viene el',
    despues: '.',
    aceptables: ['20'],
    lectura: 'En la secuencia de cinco en cinco, después del quince, ¿qué número viene?',
    explicacion: 'La secuencia de 5 en 5 es 5, 10, 15, 20 — después del 15 sigue el 20.',
  },
  {
    numero: 2,
    antes: 'Contar hacia atrás es contar de forma',
    despues: '.',
    aceptables: ['descendente'],
    lectura: 'Contar hacia atrás es contar de forma, ¿cómo?',
    explicacion: 'Cuando los números van bajando de a uno (o del paso que sea), se dice que la secuencia es descendente.',
  },
  {
    numero: 3,
    antes: 'El patrón se',
    despues: '(repite / termina).',
    aceptables: ['repite'],
    lectura: 'El patrón se, ¿repite o termina?',
    explicacion: 'Un patrón sigue una regla que se repite una y otra vez — por eso podemos predecir lo que sigue.',
  },
]

const TOTAL_PREGUNTAS = SECUENCIAS.length + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoSecuencia {
  valores: [string, string, string]
  evaluado: boolean
  correcto: boolean
}

const ESTADO_SECUENCIA_INICIAL: EstadoSecuencia = { valores: ['', '', ''], evaluado: false, correcto: false }

interface EstadoFiguras {
  valores: [string | null, string | null]
  evaluado: boolean
  correcto: boolean
}

const ESTADO_FIGURAS_INICIAL: EstadoFiguras = { valores: [null, null], evaluado: false, correcto: false }

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function SegundoModulo06() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [secuencias, setSecuencias] = useState<Record<number, EstadoSecuencia>>(() =>
    Object.fromEntries(SECUENCIAS.map(p => [p.numero, { ...ESTADO_SECUENCIA_INICIAL, valores: ['', '', ''] as [string, string, string] }])),
  )
  const [figuras, setFiguras] = useState<EstadoFiguras>({ ...ESTADO_FIGURAS_INICIAL, valores: [null, null] })
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
    const cSec = Object.values(secuencias).filter(e => e.evaluado && e.correcto).length
    const cFig = figuras.evaluado && figuras.correcto ? 1 : 0
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cSec + cFig + cCompleta
  }, [secuencias, figuras, completa])

  const totalEvaluadas = useMemo(() => {
    const eSec = Object.values(secuencias).filter(e => e.evaluado).length
    const eFig = figuras.evaluado ? 1 : 0
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eSec + eFig + eCompleta
  }, [secuencias, figuras, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'segundo-modulo-06', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarSecuencia(p: PreguntaSecuencia) {
    const actual = secuencias[p.numero]
    if (actual.evaluado || actual.valores.some(v => v.trim() === '')) return
    const ultimo = p.terminos[2]
    const correcto = actual.valores.every((v, i) => Number(v.trim()) === ultimo + p.paso * (i + 1))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setSecuencias(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarFiguras() {
    if (figuras.evaluado || figuras.valores[0] === null || figuras.valores[1] === null) return
    const correcto = figuras.valores[0] === PATRON_FIGURAS.siguientes[0] && figuras.valores[1] === PATRON_FIGURAS.siguientes[1]
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setFiguras(prev => ({ ...prev, evaluado: true, correcto }))
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
    setSecuencias(Object.fromEntries(SECUENCIAS.map(p => [p.numero, { ...ESTADO_SECUENCIA_INICIAL, valores: ['', '', ''] as [string, string, string] }])))
    setFiguras({ ...ESTADO_FIGURAS_INICIAL, valores: [null, null] })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #38bdf8 0%, #bae6fd 35%, #fef9c3 100%)',
      color: '#0c4a6e', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #0ea5e9, #0369a1)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #0c4a6e', borderBottom: '4px solid #0c4a6e',
      }}>
        <BotonMenu href="/segundo-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🔷🔢</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #0c4a6e', margin: 0, color: 'white',
        }}>
          ¡Secuencias numéricas!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Descubrí el patrón y completá la secuencia
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#0ea5e9" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {SECUENCIAS.map((p, i) => (
            <TarjetaSecuencia key={p.numero} p={p} estado={secuencias[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={(indice, valor) => setSecuencias(prev => {
                const valores = [...prev[p.numero].valores] as [string, string, string]
                valores[indice] = valor
                return { ...prev, [p.numero]: { ...prev[p.numero], valores } }
              })}
              onComprobar={() => comprobarSecuencia(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}

          <TarjetaPatronFiguras estado={figuras} color={COLORES[4 % COLORES.length]}
            onElegir={(indice, valor) => setFiguras(prev => {
              const valores = [...prev.valores] as [string | null, string | null]
              valores[indice] = valor
              return { ...prev, valores }
            })}
            onComprobar={comprobarFiguras} onExplicarEstado={reaccionarRickyExplicar} />
        </div>

        <div style={{
          background: 'white', border: '3px solid #7dd3fc', boxShadow: '0 4px 0 rgba(12,74,110,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0c4a6e' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(12,74,110,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#0c4a6e' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0369a1' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Descubrís los patrones muy bien 🎮'
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

function BloqueNumero({ n, color }: { n: number; color: string }) {
  return (
    <div style={{
      width: 54, height: 54, borderRadius: 10, background: color, color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: '1.3rem', flexShrink: 0, boxShadow: `0 3px 0 ${color}99`,
    }}>
      {n}
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con un patrón distinto a los 5 de la
// actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const terminos: [number, number, number] = [3, 6, 9]
  const paso = 3
  const siguientes = [terminos[2] + paso, terminos[2] + paso * 2, terminos[2] + paso * 3]

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
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>Ejemplo resuelto — De 3 en 3</p>
        <BotonEscuchar texto={`Ejemplo: de 3 en 3. 3, 6, 9. Cada bloque suma 3 al anterior, así que sigue: ${siguientes.join(', ')}.`} tamano={32} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}>
        {terminos.map((n, i) => <BloqueNumero key={`t${i}`} n={n} color={color} />)}
        <span style={{ fontSize: '1.3rem', color: '#1e3a8a' }}>➡️</span>
        {siguientes.map((n, i) => (
          <div key={`s${i}`} style={{
            width: 54, height: 54, borderRadius: 10, border: `2px solid ${color}`, background: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.3rem', color: '#1e3a8a',
          }}>
            {n}
          </div>
        ))}
      </div>
      <p style={{ marginTop: '0.7rem', fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85 }}>
        El patrón es &ldquo;suma 3&rdquo;: 3, 6, 9, {siguientes.join(', ')}.
      </p>
    </div>
  )
}

function TarjetaSecuencia({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaSecuencia
  estado: EstadoSecuencia
  color: string
  onCambiar: (indice: number, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const listo = estado.valores.every(v => v.trim() !== '')

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && listo) onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e' }}>{p.titulo}:</p>
        <BotonEscuchar texto={`${p.titulo}: ${p.terminos.join(', ')}. ¿Qué sigue?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
        {p.terminos.map((n, i) => <BloqueNumero key={i} n={n} color={color} />)}
        {estado.valores.map((v, i) => (
          <input
            key={i}
            type="number" inputMode="numeric" value={v} disabled={estado.evaluado}
            onChange={e => onCambiar(i, e.target.value)} onKeyDown={handleKeyDown} placeholder="?"
            style={{
              width: 54, height: 54, borderRadius: 10, border: `2px solid ${color}`,
              background: '#f0f9ff', color: '#0c4a6e', fontWeight: 800, fontSize: '1.2rem', textAlign: 'center',
            }}
          />
        ))}
      </div>

      {!estado.evaluado && (
        <button onClick={onComprobar} disabled={!listo} style={{
          width: '100%', marginTop: '0.7rem', padding: '0.5rem', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: !listo ? '#e2e8f0' : '#22c55e',
          boxShadow: !listo ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1rem',
          opacity: !listo ? 0.7 : 1,
        }}>
          Comprobar ✓
        </button>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ Revisá el patrón'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaPatronFiguras({ estado, color, onElegir, onComprobar, onExplicarEstado }: {
  estado: EstadoFiguras
  color: string
  onElegir: (indice: number, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const listo = estado.valores[0] !== null && estado.valores[1] !== null

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {PATRON_FIGURAS.numero}
        </span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e' }}>{PATRON_FIGURAS.titulo}:</p>
        <BotonEscuchar texto="Patrón de figuras: tierra, antorcha, tierra, antorcha. ¿Qué figuras siguen?" tamano={32} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center', alignItems: 'center', marginBottom: '0.8rem' }}>
        {PATRON_FIGURAS.patron.map((f, i) => (
          <div key={i} style={{
            width: 54, height: 54, borderRadius: 10, background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0,
            boxShadow: `0 3px 0 ${color}99`,
          }}>
            {f}
          </div>
        ))}
        <span style={{ fontSize: '1.3rem' }}>❓</span>
        <span style={{ fontSize: '1.3rem' }}>❓</span>
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[0, 1].map(indice => (
          <div key={indice} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, opacity: 0.7, color: '#0c4a6e' }}>Figura {indice + 5}</p>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {OPCIONES_FIGURA.map(o => {
                const elegida = estado.valores[indice] === o.valor
                return (
                  <button
                    key={o.valor}
                    onClick={() => onElegir(indice, o.valor)}
                    disabled={estado.evaluado}
                    title={o.label}
                    style={{
                      width: 44, height: 44, borderRadius: 10, fontSize: '1.4rem', cursor: estado.evaluado ? 'default' : 'pointer',
                      border: `2px solid ${elegida ? color : `${color}55`}`,
                      background: elegida ? `${color}22` : 'white',
                    }}
                  >
                    {o.valor}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {!estado.evaluado && (
        <button onClick={onComprobar} disabled={!listo} style={{
          width: '100%', marginTop: '0.8rem', padding: '0.5rem', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: !listo ? '#e2e8f0' : '#22c55e',
          boxShadow: !listo ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1rem',
          opacity: !listo ? 0.7 : 1,
        }}>
          Comprobar ✓
        </button>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ Revisá el patrón'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={PATRON_FIGURAS.explicacion} onEstadoCambia={onExplicarEstado} />
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#7dd3fc'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0f9ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#0c4a6e' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 130, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #7dd3fc',
          background: 'white', color: '#0c4a6e', fontSize: '1.05rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0c4a6e' }}>{p.despues}</span>
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
