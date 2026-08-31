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

// ── Datos de la actividad (basados en la hoja "Misión 03 - La granja de
// pollos", serie "Problemas"). Todos los ítems son problemas de
// multiplicación (grupos iguales), con una sola casilla de respuesta,
// igual que en la hoja. La numeración sigue de la misión 2 (21 a 30).

interface Problema {
  numero: number
  emoji: string
  enunciado: string
  lectura: string
  resultado: number
  explicacion: string
}

const PROBLEMAS: Problema[] = [
  {
    numero: 21, emoji: '🥚', resultado: 12,
    enunciado: 'Hay 4 nidos con 3 huevos cada uno. ¿Cuántos huevos hay en total?',
    lectura: 'Hay cuatro nidos con tres huevos cada uno. ¿Cuántos huevos hay en total?',
    explicacion: 'Multiplico: 4 × 3 = 12.',
  },
  {
    numero: 22, emoji: '🌽', resultado: 20,
    enunciado: 'Hay 5 comederos con 4 granos cada uno. ¿Cuántos granos hay en total?',
    lectura: 'Hay cinco comederos con cuatro granos cada uno. ¿Cuántos granos hay en total?',
    explicacion: 'Multiplico: 5 × 4 = 20.',
  },
  {
    numero: 23, emoji: '🐤', resultado: 18,
    enunciado: 'Hay 3 gallinas y cada una tiene 6 pollitos. ¿Cuántos pollitos hay en total?',
    lectura: 'Hay tres gallinas y cada una tiene seis pollitos. ¿Cuántos pollitos hay en total?',
    explicacion: 'Multiplico: 3 × 6 = 18.',
  },
  {
    numero: 24, emoji: '🪶', resultado: 12,
    enunciado: 'Hay 6 cajas con 2 plumas cada una. ¿Cuántas plumas hay en total?',
    lectura: 'Hay seis cajas con dos plumas cada una. ¿Cuántas plumas hay en total?',
    explicacion: 'Multiplico: 6 × 2 = 12.',
  },
  {
    numero: 25, emoji: '🌾', resultado: 21,
    enunciado: 'Hay 7 pacas de heno con 3 bloques cada una. ¿Cuántos bloques de heno hay en total?',
    lectura: 'Hay siete pacas de heno con tres bloques cada una. ¿Cuántos bloques de heno hay en total?',
    explicacion: 'Multiplico: 7 × 3 = 21.',
  },
  {
    numero: 26, emoji: '🪣', resultado: 20,
    enunciado: 'Hay 4 bebederos con 5 cubos de agua cada uno. ¿Cuántos cubos de agua hay en total?',
    lectura: 'Hay cuatro bebederos con cinco cubos de agua cada uno. ¿Cuántos cubos de agua hay en total?',
    explicacion: 'Multiplico: 4 × 5 = 20.',
  },
  {
    numero: 27, emoji: '🐔', resultado: 16,
    enunciado: 'Hay 8 cercas y en cada una hay 2 gallinas. ¿Cuántas gallinas hay en total?',
    lectura: 'Hay ocho cercas y en cada una hay dos gallinas. ¿Cuántas gallinas hay en total?',
    explicacion: 'Multiplico: 8 × 2 = 16.',
  },
  {
    numero: 28, emoji: '🐣', resultado: 21,
    enunciado: 'Hay 3 establos y en cada uno hay 7 pollitos. ¿Cuántos pollitos hay en total?',
    lectura: 'Hay tres establos y en cada uno hay siete pollitos. ¿Cuántos pollitos hay en total?',
    explicacion: 'Multiplico: 3 × 7 = 21.',
  },
  {
    numero: 29, emoji: '🧺', resultado: 27,
    enunciado: 'Hay 9 sacos de alimento y cada uno pesa 3 kg. ¿Cuántos kilogramos hay en total?',
    lectura: 'Hay nueve sacos de alimento y cada uno pesa tres kilos. ¿Cuántos kilogramos hay en total?',
    explicacion: 'Multiplico: 9 × 3 = 27.',
  },
  {
    numero: 30, emoji: '🚚', resultado: 16,
    enunciado: 'Hay 2 camiones y cada uno lleva 8 cajas de huevos. ¿Cuántas cajas de huevos hay en total?',
    lectura: 'Hay dos camiones y cada uno lleva ocho cajas de huevos. ¿Cuántas cajas de huevos hay en total?',
    explicacion: 'Multiplico: 2 × 8 = 16.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

// ── Bloque de estado ──

interface EstadoItem { valor: string; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo03() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
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

  const totalCorrectas = useMemo(() => Object.values(items).filter(e => e.evaluado && e.correcto).length, [items])
  const totalEvaluadas = useMemo(() => Object.values(items).filter(e => e.evaluado).length, [items])
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'problemas-modulo-03', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: Problema) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.resultado
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #f59e0b 0%, #fde68a 35%, #fffbeb 100%)',
      color: '#78350f', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #f59e0b, #78350f)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #451a03', borderBottom: '4px solid #451a03',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🐔🥚</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #451a03', margin: 0, color: 'white',
        }}>
          Misión 03: La granja de pollos
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Todo viene en grupos iguales — ¡multiplicá!
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

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(69,26,3,0.15))' }}
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
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f59e0b' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '🎉 ¡Misión completada! Ayudaste a la gallina con toda la granja 🏆'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi completás la misión.'
                : 'Seguí practicando, ¡vas a lograrlo!'}
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

// Ejemplo resuelto — canastas de manzanas, distinto a los 10 ítems reales
// para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const enunciado = 'Hay 3 canastas con 4 manzanas cada una. ¿Cuántas manzanas hay en total?'
  const resultado = 12

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🍎</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: hay tres canastas con cuatro manzanas cada una. ¿Cuántas manzanas hay en total? Multiplico 3 por 4, que es 12." tamano={32} />
      </div>

      <p style={{ fontSize: '0.9rem', margin: '0 0 0.7rem', color: '#1e3a8a', fontWeight: 600 }}>{enunciado}</p>

      <p style={{ textAlign: 'center', margin: 0 }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e3a8a' }}>R: </span>
        <span style={{
          padding: '0.2rem 0.7rem', borderRadius: 8, border: '2px solid #22c55e', background: '#dcfce7',
          color: '#16a34a', fontSize: '1.2rem', fontWeight: 800,
        }}>
          {resultado}
        </span>
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: '0.7rem 0 0' }}>
        Multiplico los grupos: 3 × 4 = 12.
      </p>
    </div>
  )
}

function TarjetaProblema({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: Problema
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
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem',
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.emoji}</span>
        <BotonEscuchar texto={p.lectura} tamano={32} />
      </div>

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#78350f', fontWeight: 600 }}>{p.enunciado}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#78350f' }}>R:</span>
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
            background: '#fffbeb', color: '#78350f', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
          }}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.5rem 0.9rem', borderRadius: 10, border: 'none', cursor: estado.valor.trim() === '' ? 'default' : 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1rem', opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
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
