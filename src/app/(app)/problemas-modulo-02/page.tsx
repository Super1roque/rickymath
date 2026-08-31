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

// ── Datos de la actividad (basados en la hoja "Misión 02 - El cofre del
// aldeano", serie "Problemas"). Cada ítem es un problema de un paso (suma,
// resta, o "¿cuánto tenía al principio?") con una sola casilla de
// respuesta, igual que en la hoja. La numeración sigue de la misión 1
// (11 a 20), tal como está impresa en la hoja original.

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
    numero: 11, emoji: '💚', resultado: 68,
    enunciado: 'El aldeano tenía 45 esmeraldas y encontró 23 más. ¿Cuántas esmeraldas tiene ahora?',
    lectura: 'El aldeano tenía cuarenta y cinco esmeraldas y encontró veintitrés más. ¿Cuántas esmeraldas tiene ahora?',
    explicacion: 'Sumo: 45 + 23 = 68.',
  },
  {
    numero: 12, emoji: '🍞', resultado: 65,
    enunciado: 'Vendió 37 panes y le quedaron 28. ¿Cuántos panes tenía al principio?',
    lectura: 'Vendió treinta y siete panes y le quedaron veintiocho. ¿Cuántos panes tenía al principio?',
    explicacion: 'Lo que tenía al principio es lo que vendió más lo que le quedó: 37 + 28 = 65.',
  },
  {
    numero: 13, emoji: '🏹', resultado: 75,
    enunciado: 'Tenía 56 flechas y fabricó 19 más. ¿Cuántas flechas tiene en total?',
    lectura: 'Tenía cincuenta y seis flechas y fabricó diecinueve más. ¿Cuántas flechas tiene en total?',
    explicacion: 'Sumo: 56 + 19 = 75.',
  },
  {
    numero: 14, emoji: '🍎', resultado: 59,
    enunciado: 'Compró 24 manzanas y ya tenía 35 en su cofre. ¿Cuántas manzanas tiene en total?',
    lectura: 'Compró veinticuatro manzanas y ya tenía treinta y cinco en su cofre. ¿Cuántas manzanas tiene en total?',
    explicacion: 'Sumo: 24 + 35 = 59.',
  },
  {
    numero: 15, emoji: '🪨', resultado: 44,
    enunciado: 'Tenía 70 bloques de piedra y usó 26 para construir. ¿Cuántos bloques le quedaron?',
    lectura: 'Tenía setenta bloques de piedra y usó veintiséis para construir. ¿Cuántos bloques le quedaron?',
    explicacion: 'Resto: 70 − 26 = 44.',
  },
  {
    numero: 16, emoji: '🪵', resultado: 60,
    enunciado: 'Recolectó 33 maderas y luego recolectó 27 más. ¿Cuántas maderas tiene en total?',
    lectura: 'Recolectó treinta y tres maderas y luego recolectó veintisiete más. ¿Cuántas maderas tiene en total?',
    explicacion: 'Sumo: 33 + 27 = 60.',
  },
  {
    numero: 17, emoji: '🥕', resultado: 37,
    enunciado: 'Tenía 62 zanahorias y vendió 25 en el mercado. ¿Cuántas zanahorias le quedaron?',
    lectura: 'Tenía sesenta y dos zanahorias y vendió veinticinco en el mercado. ¿Cuántas zanahorias le quedaron?',
    explicacion: 'Resto: 62 − 25 = 37.',
  },
  {
    numero: 18, emoji: '🔩', resultado: 47,
    enunciado: 'Encontró un cofre con 18 lingotes de hierro y otro con 29. ¿Cuántos lingotes tiene en total?',
    lectura: 'Encontró un cofre con dieciocho lingotes de hierro y otro con veintinueve. ¿Cuántos lingotes tiene en total?',
    explicacion: 'Sumo: 18 + 29 = 47.',
  },
  {
    numero: 19, emoji: '🔥', resultado: 46,
    enunciado: 'Tenía 80 antorchas y colocó 34 en la aldea. ¿Cuántas antorchas le quedaron?',
    lectura: 'Tenía ochenta antorchas y colocó treinta y cuatro en la aldea. ¿Cuántas antorchas le quedaron?',
    explicacion: 'Resto: 80 − 34 = 46.',
  },
  {
    numero: 20, emoji: '📚', resultado: 79,
    enunciado: 'Compró 47 libros encantados y ya tenía 32. ¿Cuántos libros encantados tiene en total?',
    lectura: 'Compró cuarenta y siete libros encantados y ya tenía treinta y dos. ¿Cuántos libros encantados tiene en total?',
    explicacion: 'Sumo: 47 + 32 = 79.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

// ── Bloque de estado ──

interface EstadoItem { valor: string; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo02() {
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const fanfarriaSonada = useRef(false)

  const [puntos, setPuntos] = useState(0)
  const [racha, setRacha] = useState(0)
  const [mejorRacha, setMejorRacha] = useState(0)

  const [rickyMood, setRickyMood] = useState<RickyMood>('waving')
  const terminadoRef = useRef(false)
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #92400e 0%, #d9b48f 35%, #fef3c7 100%)',
      color: '#451a03', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #92400e, #451a03)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #292018', borderBottom: '4px solid #292018',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🧑‍🌾📦</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #292018', margin: 0, color: 'white',
        }}>
          Misión 02: El cofre del aldeano
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          El aldeano abre su cofre y necesita ordenar todo lo que guardó este mes
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#92400e" />
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(41,32,24,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#451a03' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#92400e' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '🎉 ¡Misión completada! Ayudaste al aldeano a ordenar su cofre 🏆'
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

// Ejemplo resuelto — semillas, distinto a los 10 ítems reales para no
// revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const enunciado = 'El aldeano tenía 10 semillas y encontró 5 más. ¿Cuántas semillas tiene ahora?'
  const resultado = 15

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
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🌱</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: el aldeano tenía diez semillas y encontró cinco más. ¿Cuántas semillas tiene ahora? Sumo 10 más 5, que es 15." tamano={32} />
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
        Sumo lo que tenía y lo que encontró: 10 + 5 = 15.
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

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#451a03', fontWeight: 600 }}>{p.enunciado}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#451a03' }}>R:</span>
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
            background: '#fffbeb', color: '#451a03', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
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
