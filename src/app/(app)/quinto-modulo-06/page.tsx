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

// ── Datos de la actividad (basados en la hoja "Actividad 6 - Porcentajes").
// Ítems 1-4: porcentaje de un número. Ítem 5: problema de descuento con dos
// respuestas (cuánto ahorra y cuánto paga). Igual que en el resto de la
// serie, las casillas de respuesta vienen en blanco y la app corrige.

interface ItemPorcentaje {
  numero: number
  porcentaje: number
  base: number
  resultado: number
  explicacion: string
}

const ITEMS: ItemPorcentaje[] = [
  { numero: 1, porcentaje: 50, base: 80, resultado: 40, explicacion: 'El 50% es la mitad: 80 ÷ 2 = 40.' },
  { numero: 2, porcentaje: 25, base: 60, resultado: 15, explicacion: 'El 25% es un cuarto: 60 ÷ 4 = 15.' },
  { numero: 3, porcentaje: 10, base: 200, resultado: 20, explicacion: 'El 10% es la décima parte: 200 ÷ 10 = 20.' },
  { numero: 4, porcentaje: 75, base: 40, resultado: 30, explicacion: 'El 75% es tres cuartos: 40 ÷ 4 = 10, y 10 × 3 = 30.' },
]

const DESCUENTO = {
  precio: 120, porcentaje: 25, ahorra: 30, paga: 90,
  explicacion: 'El 25% de 120 es 120 ÷ 4 = 30 — eso es lo que ahorra. Paga el resto: 120 − 30 = 90.',
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
    numero: 1, antes: 'El 50 % es lo mismo que la mitad, o sea', despues: '/2.',
    aceptables: ['1'],
    lectura: 'El 50%, ¿es lo mismo que un medio? Un... ¿sobre dos?',
    explicacion: 'El 50% es la mitad, es decir 1/2.',
  },
  {
    numero: 2, antes: 'El 10 % de 200 es', despues: '.',
    aceptables: ['20'],
    lectura: '¿Cuánto es el diez por ciento de doscientos?',
    explicacion: 'El 10% es la décima parte: 200 ÷ 10 = 20.',
  },
  {
    numero: 3, antes: 'Con 25 % de descuento, una espada de 120 cuesta', despues: '.',
    aceptables: ['90'],
    lectura: 'Con veinticinco por ciento de descuento, ¿cuánto cuesta una espada de ciento veinte?',
    explicacion: 'El 25% de 120 es 30 (lo que se descuenta). Paga el resto: 120 − 30 = 90.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoItem { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoDescuento { ahorra: string; paga: string; evaluado: boolean; correcto: boolean }
interface EstadoCompleta { valor: string; evaluado: boolean; correcto: boolean }

export default function QuintoModulo06() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const [descuento, setDescuento] = useState<EstadoDescuento>({ ahorra: '', paga: '', evaluado: false, correcto: false })
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
    const a = Object.values(items).filter(e => e.evaluado && e.correcto).length
    const b = descuento.evaluado && descuento.correcto ? 1 : 0
    const c = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return a + b + c
  }, [items, descuento, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(items).filter(e => e.evaluado).length
    const b = descuento.evaluado ? 1 : 0
    const c = Object.values(completa).filter(e => e.evaluado).length
    return a + b + c
  }, [items, descuento, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'quinto-modulo-06', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: ItemPorcentaje) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.resultado
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarDescuento() {
    if (descuento.evaluado || descuento.ahorra.trim() === '' || descuento.paga.trim() === '') return
    const correcto = Number(descuento.ahorra.trim()) === DESCUENTO.ahorra && Number(descuento.paga.trim()) === DESCUENTO.paga
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setDescuento(prev => ({ ...prev, evaluado: true, correcto }))
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
    setDescuento({ ahorra: '', paga: '', evaluado: false, correcto: false })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #059669 0%, #6ee7b7 35%, #ecfdf5 100%)',
      color: '#064e3b', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #059669, #064e3b)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #022c22', borderBottom: '4px solid #022c22',
      }}>
        <BotonMenu href="/quinto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>💚🏪</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #022c22', margin: 0, color: 'white',
        }}>
          ¡Porcentajes!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          El vendedor ambulante hace ofertas — calculá los porcentajes
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#059669" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaPorcentaje key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <TarjetaDescuento estado={descuento} color={COLORES[4 % COLORES.length]}
            onCambiarAhorra={valor => setDescuento(prev => ({ ...prev, ahorra: valor }))}
            onCambiarPaga={valor => setDescuento(prev => ({ ...prev, paga: valor }))}
            onComprobar={comprobarDescuento} onExplicarEstado={reaccionarRickyExplicar} />
        </div>

        <div style={{
          background: 'white', border: '3px solid #6ee7b7', boxShadow: '0 4px 0 rgba(2,44,34,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#064e3b' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(2,44,34,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#064e3b' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#059669' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás los porcentajes 🎮'
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

// Barra decorativa 0-50-100 marcando dónde cae el porcentaje pedido —
// imita la cuadrícula de la hoja, sin revelar el resultado.
function BarraPorcentaje({ porcentaje, color }: { porcentaje: number; color: string }) {
  return (
    <div style={{ margin: '0.5rem 0 0.3rem' }}>
      <div style={{ position: 'relative', height: 14, borderRadius: 999, background: '#f1f5f9', border: '2px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${porcentaje}%`, background: color }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontWeight: 700, color: '#64748b', marginTop: '0.15rem' }}>
        <span>0</span><span>50</span><span>100</span>
      </div>
    </div>
  )
}

// Ejemplo resuelto — 20% de 50, distinto a los 4 ítems reales para no
// revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const porcentaje = 20
  const base = 50
  const resultado = 10

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
        <BotonEscuchar texto="Ejemplo: veinte por ciento de cincuenta. El diez por ciento de cincuenta es cinco, así que el veinte por ciento es el doble: diez." tamano={32} />
      </div>

      <p style={{ textAlign: 'center', fontSize: '1.3rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 0.3rem' }}>{porcentaje} % de {base} =</p>
      <BarraPorcentaje porcentaje={porcentaje} color={color} />
      <p style={{ textAlign: 'center', margin: '0.5rem 0 0' }}>
        <span style={{
          padding: '0.2rem 0.7rem', borderRadius: 8, border: '2px solid #22c55e', background: '#dcfce7',
          color: '#16a34a', fontSize: '1.3rem', fontWeight: 800,
        }}>
          {resultado}
        </span>
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: '0.7rem 0 0' }}>
        El 10% de 50 es 5, así que el 20% es el doble: 10.
      </p>
    </div>
  )
}

function TarjetaPorcentaje({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemPorcentaje
  estado: EstadoItem
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <BotonEscuchar texto={`¿Cuánto es el ${p.porcentaje} por ciento de ${p.base}?`} tamano={32} />
      </div>

      <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.2rem 0 0', color: '#064e3b' }}>{p.porcentaje} % de {p.base} =</p>
      <BarraPorcentaje porcentaje={p.porcentaje} color={color} />

      <input
        type="number"
        inputMode="numeric"
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="?"
        style={{
          width: 90, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
          background: '#ecfdf5', color: '#064e3b', fontSize: '1.2rem', fontWeight: 800, textAlign: 'center', marginTop: '0.3rem',
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
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaDescuento({ estado, color, onCambiarAhorra, onCambiarPaga, onComprobar, onExplicarEstado }: {
  estado: EstadoDescuento
  color: string
  onCambiarAhorra: (valor: string) => void
  onCambiarPaga: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const faltan = estado.ahorra.trim() === '' || estado.paga.trim() === ''

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
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          5
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⚔️</span>
        <p style={{ fontWeight: 700, margin: 0, flex: 1, color: '#064e3b' }}>
          Descuento: espada de diamante, {DESCUENTO.precio} esmeraldas, con {DESCUENTO.porcentaje}% de descuento.
        </p>
        <BotonEscuchar texto={`Espada de diamante, ${DESCUENTO.precio} esmeraldas, con ${DESCUENTO.porcentaje} por ciento de descuento. ¿Cuánto ahorra y cuánto paga?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#064e3b', marginBottom: '0.3rem' }}>Ahorra:</label>
          <input
            type="number"
            inputMode="numeric"
            value={estado.ahorra}
            disabled={estado.evaluado}
            onChange={e => onCambiarAhorra(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="?"
            style={{
              width: 90, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
              background: '#ecfdf5', color: '#064e3b', fontSize: '1.2rem', fontWeight: 800, textAlign: 'center',
            }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#064e3b', marginBottom: '0.3rem' }}>Paga:</label>
          <input
            type="number"
            inputMode="numeric"
            value={estado.paga}
            disabled={estado.evaluado}
            onChange={e => onCambiarPaga(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="?"
            style={{
              width: 90, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
              background: '#ecfdf5', color: '#064e3b', fontSize: '1.2rem', fontWeight: 800, textAlign: 'center',
            }}
          />
        </div>
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.8rem' }}>
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Ahorra ${DESCUENTO.ahorra}, paga ${DESCUENTO.paga}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={DESCUENTO.explicacion} onEstadoCambia={onExplicarEstado} />
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#6ee7b7'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#ecfdf5',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#064e3b' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 90, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #6ee7b7',
          background: 'white', color: '#064e3b', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#064e3b' }}>{p.despues}</span>
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
