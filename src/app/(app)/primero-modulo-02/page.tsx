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

// ── Datos de la actividad (basados en la hoja "Actividad 2 - Antes, Ahora y Después") ──
// La hoja original muestra cada escena YA en el orden correcto (1, 2, 3 de
// izquierda a derecha) y solo pide anotar los números. Para que la versión
// interactiva pruebe de verdad si el chico entiende la secuencia (no que
// copie "1, 2, 3" en automático), las 3 imágenes de cada fila se muestran
// desordenadas — un derangement fijo (nunca en su posición cronológica
// real), no aleatorio en cada carga, para no romper la hidratación de
// Next.js. `correcta` es el número de orden cronológico real de esa
// imagen (1, 2 o 3), no la posición en la que se la muestra.

interface PasoOrden {
  emoji: string
  correcta: number
}

interface PreguntaOrdenar {
  numero: number
  titulo: string
  pasos: [PasoOrden, PasoOrden, PasoOrden]
  explicacion: string
}

const ITEMS: PreguntaOrdenar[] = [
  {
    numero: 1, titulo: 'Del huevo a la gallina',
    pasos: [{ emoji: '🐤', correcta: 2 }, { emoji: '🐔', correcta: 3 }, { emoji: '🥚', correcta: 1 }],
    explicacion: 'Primero es el huevo, después nace el pollito, y al final el pollito crece y se convierte en gallina.',
  },
  {
    numero: 2, titulo: 'De semilla a flor',
    pasos: [{ emoji: '🌺', correcta: 3 }, { emoji: '🌰', correcta: 1 }, { emoji: '🌱', correcta: 2 }],
    explicacion: 'Primero se plantan las semillas, después crece un brote verde, y al final se convierte en una flor.',
  },
  {
    numero: 3, titulo: 'Del pollo al huevo',
    pasos: [{ emoji: '🐔💕', correcta: 2 }, { emoji: '🥚', correcta: 3 }, { emoji: '🐔', correcta: 1 }],
    explicacion: 'Primero está la gallina, después la gallina pone el huevo, y al final queda el huevo solo.',
  },
  {
    numero: 4, titulo: 'Del carbón al diamante',
    pasos: [{ emoji: '💎', correcta: 3 }, { emoji: '🪨', correcta: 1 }, { emoji: '🔥', correcta: 2 }],
    explicacion: 'Primero hay un bloque de mineral, después se usa el horno para procesarlo, y al final se consigue el diamante.',
  },
  {
    numero: 5, titulo: 'Del cofre cerrado al diamante',
    pasos: [{ emoji: '📂', correcta: 2 }, { emoji: '💎', correcta: 3 }, { emoji: '📦', correcta: 1 }],
    explicacion: 'Primero el cofre está cerrado, después se abre, y al final se ve el diamante que tiene adentro.',
  },
  {
    numero: 6, titulo: 'Del tronco a la tabla',
    pasos: [{ emoji: '🟧', correcta: 3 }, { emoji: '🪵', correcta: 1 }, { emoji: '🛠️', correcta: 2 }],
    explicacion: 'Primero hay un tronco, después se usa la mesa de trabajo, y al final se consiguen las tablas de madera.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length

// ── Bloque de estado ──

interface EstadoOrdenar {
  valores: [string, string, string]
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoOrdenar = { valores: ['', '', ''], evaluado: false, correcto: false }

export default function PrimeroModulo02() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [ordenar, setOrdenar] = useState<Record<number, EstadoOrdenar>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL, valores: [...ESTADO_INICIAL.valores] as [string, string, string] }])),
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

  const totalCorrectas = useMemo(() => Object.values(ordenar).filter(e => e.evaluado && e.correcto).length, [ordenar])
  const totalEvaluadas = useMemo(() => Object.values(ordenar).filter(e => e.evaluado).length, [ordenar])
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'primero-modulo-02', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarOrden(p: PreguntaOrdenar) {
    const actual = ordenar[p.numero]
    if (actual.evaluado || actual.valores.some(v => v.trim() === '')) return
    const correcto = p.pasos.every((paso, i) => Number(actual.valores[i].trim()) === paso.correcta)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setOrdenar(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setOrdenar(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL, valores: ['', '', ''] as [string, string, string] }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #fbbf24 0%, #fde68a 35%, #fef9c3 100%)',
      color: '#78350f', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #78350f', borderBottom: '4px solid #78350f',
      }}>
        <BotonMenu href="/primero-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>⏳🐣</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #78350f', margin: 0, color: 'white',
        }}>
          ¡Antes, ahora y después!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Observá las escenas y escribí el orden: 1, 2 y 3
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#f59e0b" />
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaOrdenar key={p.numero} p={p} estado={ordenar[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={(indice, valor) => setOrdenar(prev => {
                const valores = [...prev[p.numero].valores] as [string, string, string]
                valores[indice] = valor
                return { ...prev, [p.numero]: { ...prev[p.numero], valores } }
              })}
              onComprobar={() => comprobarOrden(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(120,53,15,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#78350f' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#d97706' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Entendés muy bien el orden de las cosas 🎮'
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

function TarjetaOrdenar({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaOrdenar
  estado: EstadoOrdenar
  color: string
  onCambiar: (indice: number, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const listo = estado.valores.every(v => v.trim() !== '')
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem', gap: '0.4rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, flex: 1, minWidth: 0, textAlign: 'center', color: '#78350f', overflowWrap: 'break-word' }}>{p.titulo}</p>
        <BotonEscuchar texto={`¿Cuál es el orden correcto de esta secuencia: ${p.titulo}?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
        {p.pasos.map((paso, i) => {
          const acierto = estado.evaluado ? Number(estado.valores[i].trim()) === paso.correcta : null
          const bordeInput = acierto === null ? `${color}55` : acierto ? '#22c55e' : '#ef4444'
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '1.8rem' }}>{paso.emoji}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={3}
                value={estado.valores[i]}
                disabled={estado.evaluado}
                onChange={e => onCambiar(i, e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="?"
                style={{
                  width: '100%', padding: '0.4rem', borderRadius: 10, border: `2px solid ${bordeInput}`,
                  background: '#fffbeb', color: '#78350f', fontSize: '1.2rem', fontWeight: 700, textAlign: 'center',
                }}
              />
            </div>
          )
        })}
      </div>

      {!estado.evaluado && (
        <button onClick={onComprobar} disabled={!listo} style={{
          width: '100%', marginTop: '0.7rem', padding: '0.55rem', borderRadius: 12, border: 'none', cursor: 'pointer',
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.pasos.map(paso => paso.correcta).join(', ')}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
