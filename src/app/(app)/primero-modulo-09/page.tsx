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

// ── Datos de la actividad (basados en la hoja "Actividad 9 - Contar y Marcar") ──
// Cantidades por fila confirmadas a mano por el usuario (esmeraldas
// corregidas a 9). A diferencia de otros módulos de conteo, la consigna acá
// es "coloreá una casilla por cada bloque" — se implementa con una tira de
// 10 casillas clickeables en vez de un input numérico, más fiel a la hoja.

interface PreguntaMarcar {
  numero: number
  nombre: string
  emoji: string
  cantidad: number
  explicacion: string
}

function explicarConteo(nombre: string, cantidad: number): string {
  const numeros = Array.from({ length: cantidad }, (_, i) => i + 1).join(', ')
  return `Contamos ${nombre.toLowerCase()} uno por uno: ${numeros}. Por eso coloreamos ${cantidad} casillas.`
}

const ITEMS: PreguntaMarcar[] = [
  { numero: 1, nombre: 'Bloques de tierra', emoji: '🟫', cantidad: 4, explicacion: explicarConteo('los bloques de tierra', 4) },
  { numero: 2, nombre: 'Diamantes', emoji: '💎', cantidad: 7, explicacion: explicarConteo('los diamantes', 7) },
  { numero: 3, nombre: 'Lingotes de oro', emoji: '🟨', cantidad: 3, explicacion: explicarConteo('los lingotes de oro', 3) },
  { numero: 4, nombre: 'Bloques de piedra', emoji: '🪨', cantidad: 6, explicacion: explicarConteo('los bloques de piedra', 6) },
  { numero: 5, nombre: 'Esmeraldas', emoji: '🟢', cantidad: 9, explicacion: explicarConteo('las esmeraldas', 9) },
  { numero: 6, nombre: 'Redstone', emoji: '🔴', cantidad: 5, explicacion: explicarConteo('el redstone', 5) },
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
    antes: 'El bloque que MÁS aparece es la',
    despues: '.',
    aceptables: ['esmeraldas', 'esmeralda'],
    lectura: '¿Cuál bloque aparece más veces?',
    explicacion: 'Comparamos las cantidades: 4, 7, 3, 6, 9 y 5. El número más grande es 9, y esas son las esmeraldas.',
  },
  {
    numero: 2,
    antes: 'El bloque que MENOS aparece es el',
    despues: '.',
    aceptables: ['lingotes de oro', 'lingote de oro', 'oro'],
    lectura: '¿Cuál bloque aparece menos veces?',
    explicacion: 'Comparamos las cantidades: 4, 7, 3, 6, 9 y 5. El número más chico es 3, y esos son los lingotes de oro.',
  },
  {
    numero: 3,
    antes: 'Hay',
    despues: 'diamantes.',
    aceptables: ['7'],
    lectura: '¿Cuántos diamantes hay?',
    explicacion: 'En la fila 2 contamos los diamantes uno por uno y son 7.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoMarcar {
  celdas: boolean[]
  evaluado: boolean
  correcto: boolean
}

function celdasIniciales(): boolean[] {
  return Array(10).fill(false)
}

interface EstadoCompleta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_COMPLETA_INICIAL: EstadoCompleta = { valor: '', evaluado: false, correcto: false }

export default function PrimeroModulo09() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoMarcar>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { celdas: celdasIniciales(), evaluado: false, correcto: false }])),
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'primero-modulo-09', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function alternarCelda(p: PreguntaMarcar, indice: number) {
    const actual = items[p.numero]
    if (actual.evaluado) return
    const celdas = [...actual.celdas]
    celdas[indice] = !celdas[indice]
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], celdas } }))
  }

  function comprobarItem(p: PreguntaMarcar) {
    const actual = items[p.numero]
    if (actual.evaluado) return
    const coloreadas = actual.celdas.filter(Boolean).length
    if (coloreadas === 0) return
    const correcto = coloreadas === p.cantidad
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { celdas: celdasIniciales(), evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #fb923c 0%, #fed7aa 35%, #fef9c3 100%)',
      color: '#7c2d12', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #f97316, #c2410c)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #7c2d12', borderBottom: '4px solid #7c2d12',
      }}>
        <BotonMenu href="/primero-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🔢🎨</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #7c2d12', margin: 0, color: 'white',
        }}>
          ¡Contar y marcar!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Contá los bloques y coloreá una casilla por cada uno
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#f97316" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {ITEMS.map((p, i) => (
            <FilaMarcar key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onAlternar={indice => alternarCelda(p, indice)}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #fdba74', boxShadow: '0 4px 0 rgba(124,45,18,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7c2d12' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(124,45,18,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#7c2d12' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#c2410c' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Contás y marcás muy bien 🎮'
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

function FilaMarcar({ p, estado, color, onAlternar, onComprobar, onExplicarEstado }: {
  p: PreguntaMarcar
  estado: EstadoMarcar
  color: string
  onAlternar: (indice: number) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const coloreadas = estado.celdas.filter(Boolean).length
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem', fontSize: '1.4rem' }}>
          {Array.from({ length: p.cantidad }, (_, i) => <span key={i}>{p.emoji}</span>)}
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, opacity: 0.7, color: '#7c2d12' }}>{p.nombre}</span>
        <BotonEscuchar texto={`¿Cuántos ${p.nombre.toLowerCase()} hay? Coloreá una casilla por cada uno.`} tamano={30} />
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {estado.celdas.map((coloreada, i) => (
          <button
            key={i}
            onClick={() => onAlternar(i)}
            disabled={estado.evaluado}
            style={{
              width: 32, height: 32, borderRadius: 8, border: `2px solid ${coloreada ? color : `${color}66`}`,
              background: coloreada ? color : 'white', color: coloreada ? 'white' : color,
              fontWeight: 800, fontSize: '0.95rem', cursor: estado.evaluado ? 'default' : 'pointer',
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {!estado.evaluado && (
        <button onClick={onComprobar} disabled={coloreadas === 0} style={{
          width: '100%', padding: '0.55rem', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: coloreadas === 0 ? '#e2e8f0' : '#22c55e',
          boxShadow: coloreadas === 0 ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1rem',
          opacity: coloreadas === 0 ? 0.7 : 1,
        }}>
          Comprobar ✓
        </button>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Eran ${p.cantidad}`}
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
  estado: EstadoCompleta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#fdba74'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fff7ed',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#7c2d12' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 130, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #fdba74',
          background: 'white', color: '#7c2d12', fontSize: '1.05rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#7c2d12' }}>{p.despues}</span>
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
