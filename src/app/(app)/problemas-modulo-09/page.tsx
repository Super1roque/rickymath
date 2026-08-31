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

// ── Datos de la actividad (basados en la hoja "Misión 09 - La torre del
// Fin", serie "Problemas"). Todos los ítems son de volumen: prismas,
// cubos y figuras compuestas con huecos. La numeración sigue de la
// misión 8 (81 a 90).

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
    numero: 81, emoji: '🗼', resultado: 72,
    enunciado: 'Calculá el volumen de la torre rectangular. Base de 4 × 3 bloques y altura de 6 bloques.',
    lectura: 'Calculá el volumen de la torre rectangular. Base de cuatro por tres bloques y altura de seis bloques.',
    explicacion: 'Multiplico: 4 × 3 × 6 = 72 bloques.',
  },
  {
    numero: 82, emoji: '🟦', resultado: 40,
    enunciado: 'Calculá el volumen de este prisma rectangular. Base de 5 × 2 bloques y altura de 4 bloques.',
    lectura: 'Calculá el volumen de este prisma rectangular. Base de cinco por dos bloques y altura de cuatro bloques.',
    explicacion: 'Multiplico: 5 × 2 × 4 = 40 bloques.',
  },
  {
    numero: 83, emoji: '🟪', resultado: 216,
    enunciado: 'Calculá el volumen de este cubo de 6 bloques de arista.',
    lectura: 'Calculá el volumen de este cubo de seis bloques de arista.',
    explicacion: 'Multiplico: 6 × 6 × 6 = 216 bloques.',
  },
  {
    numero: 84, emoji: '🟩', resultado: 24,
    enunciado: 'Calculá el volumen de esta figura en forma de L. La base tiene 8 bloques y todas las capas tienen altura de 3 bloques.',
    lectura: 'Calculá el volumen de esta figura en forma de ele. La base tiene ocho bloques y todas las capas tienen altura de tres bloques.',
    explicacion: 'Multiplico la base por la altura: 8 × 3 = 24 bloques.',
  },
  {
    numero: 85, emoji: '🔲', resultado: 22,
    enunciado: 'Calculá el volumen de este prisma rectangular de 5 × 3 × 2 bloques, con un hueco cúbico de 2 × 2 × 2 bloques en el centro.',
    lectura: 'Calculá el volumen de este prisma rectangular de cinco por tres por dos bloques, con un hueco cúbico de dos por dos por dos bloques en el centro.',
    explicacion: 'Volumen del prisma completo: 5 × 3 × 2 = 30. Resto el hueco: 2 × 2 × 2 = 8. 30 − 8 = 22 bloques.',
  },
  {
    numero: 86, emoji: '🪜', resultado: 30,
    enunciado: 'Calculá el volumen de esta figura escalonada de 4 escalones, con una profundidad de 3 bloques. Todas las capas tienen altura de 1 bloque.',
    lectura: 'Calculá el volumen de esta figura escalonada de cuatro escalones, con una profundidad de tres bloques. Todas las capas tienen altura de un bloque.',
    explicacion: 'Sumo los escalones: 1 + 2 + 3 + 4 = 10 bloques por fila. Multiplico por la profundidad: 10 × 3 = 30 bloques.',
  },
  {
    numero: 87, emoji: '🟩', resultado: 12,
    enunciado: 'Calculá el volumen de esta figura en forma de T. La base tiene 6 bloques y todas las capas tienen altura de 2 bloques.',
    lectura: 'Calculá el volumen de esta figura en forma de te. La base tiene seis bloques y todas las capas tienen altura de dos bloques.',
    explicacion: 'Multiplico la base por la altura: 6 × 2 = 12 bloques.',
  },
  {
    numero: 88, emoji: '🧊', resultado: 63,
    enunciado: 'Calculá el volumen de este cubo al que se le quita un cubo de 1 × 1 × 1 en una esquina. La arista del cubo completo es de 4 bloques.',
    lectura: 'Calculá el volumen de este cubo al que se le quita un cubo de uno por uno por uno en una esquina. La arista del cubo completo es de cuatro bloques.',
    explicacion: 'Volumen del cubo completo: 4 × 4 × 4 = 64. Resto el cubo quitado: 64 − 1 = 63 bloques.',
  },
  {
    numero: 89, emoji: '🟧', resultado: 48,
    enunciado: 'Calculá el volumen de este prisma rectangular de 6 × 3 × 3 bloques, con dos huecos cúbicos que atraviesan la figura. Cada hueco es de 1 × 1 × 3 bloques.',
    lectura: 'Calculá el volumen de este prisma rectangular de seis por tres por tres bloques, con dos huecos cúbicos que atraviesan la figura. Cada hueco es de uno por uno por tres bloques.',
    explicacion: 'Volumen del prisma completo: 6 × 3 × 3 = 54. Cada hueco mide 1 × 1 × 3 = 3 bloques, y hay dos: 3 × 2 = 6. Resto: 54 − 6 = 48 bloques.',
  },
  {
    numero: 90, emoji: '🔷', resultado: 7,
    enunciado: 'Calculá el volumen total de esta figura compuesta por dos prismas rectangulares: uno de 1 × 1 × 3 bloques y otro de 2 × 2 × 1 bloques.',
    lectura: 'Calculá el volumen total de esta figura compuesta por dos prismas rectangulares: uno de uno por uno por tres bloques y otro de dos por dos por uno bloques.',
    explicacion: 'Volumen del primer prisma: 1 × 1 × 3 = 3. Volumen del segundo: 2 × 2 × 1 = 4. Sumo: 3 + 4 = 7 bloques.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

// ── Bloque de estado ──

interface EstadoItem { valor: string; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo09() {
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'problemas-modulo-09', {
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #7c3aed 0%, #c4b5fd 35%, #f5f3ff 100%)',
      color: '#4c1d95', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #7c3aed, #4c1d95)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #4c1d95', borderBottom: '4px solid #4c1d95',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>👁️🌌</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #4c1d95', margin: 0, color: 'white',
        }}>
          Misión 09: La torre del Fin
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Contá los bloques, incluso los que no se ven.
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(76,29,149,0.15))' }}
          >
            <Ricky mood={rickyMood} loop={rickyMood === 'confused' ? 2 : undefined} size={140} />
          </div>
        )}

        {terminado && (
          <div style={{
            marginTop: '2rem', textAlign: 'center', background: 'white',
            border: '3px solid #7c3aed', boxShadow: '0 5px 0 rgba(124,58,237,0.2)', borderRadius: 20, padding: '1.75rem 1.5rem',
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
                ? '🎉 ¡Misión completada! Contaste hasta el último bloque del vacío 🏆'
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

// Ejemplo resuelto — un prisma distinto a los 10 ítems reales, para no
// revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#0ea5e9'
  const enunciado = 'Calculá el volumen de un prisma con base 3 × 3 bloques y altura de 2 bloques.'
  const resultado = 18

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
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🧱</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: calculá el volumen de un prisma con base tres por tres bloques y altura de dos bloques. Multiplico 3 por 3 por 2, que es 18." tamano={32} />
      </div>

      <p style={{ fontSize: '0.9rem', margin: '0 0 0.7rem', color: '#0c4a6e', fontWeight: 600 }}>{enunciado}</p>

      <p style={{ textAlign: 'center', margin: 0 }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0c4a6e' }}>R: </span>
        <span style={{
          padding: '0.2rem 0.7rem', borderRadius: 8, border: '2px solid #22c55e', background: '#dcfce7',
          color: '#16a34a', fontSize: '1.2rem', fontWeight: 800,
        }}>
          {resultado}
        </span>
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#0c4a6e', opacity: 0.85, margin: '0.7rem 0 0' }}>
        Multiplico: 3 × 3 × 2 = 18 bloques.
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

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#4c1d95', fontWeight: 600 }}>{p.enunciado}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4c1d95' }}>R:</span>
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
            background: '#f5f3ff', color: '#4c1d95', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
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
