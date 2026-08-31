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

// ── Datos de la actividad (basados en la hoja "Misión 10 - La misión
// final", serie "Problemas"). Es el desafío final: junta multiplicación,
// división, suma, resta, fracciones y área, con problemas de dos pasos.
// El ítem 96 pide una fracción (igual que en la Misión 07), el resto son
// respuestas enteras. La numeración cierra la serie completa (91 a 100).

interface Problema {
  numero: number
  emoji: string
  enunciado: string
  lectura: string
  explicacion: string
  fraccion?: boolean
  resultado?: number
  numerador?: number
  denominador?: number
}

const PROBLEMAS: Problema[] = [
  {
    numero: 91, emoji: '💎', resultado: 84,
    enunciado: 'Una mina tiene 3 niveles. En cada nivel hay 7 diamantes. Si se exploran 4 minas iguales, ¿cuántos diamantes se encuentran en total?',
    lectura: 'Una mina tiene tres niveles. En cada nivel hay siete diamantes. Si se exploran cuatro minas iguales, ¿cuántos diamantes se encuentran en total?',
    explicacion: 'Por mina: 3 × 7 = 21 diamantes. En 4 minas: 21 × 4 = 84 diamantes.',
  },
  {
    numero: 92, emoji: '📦', resultado: 338,
    enunciado: 'En un cofre hay 5 stacks de 64 bloques de oro y sobran 18 bloques. ¿Cuántos bloques de oro hay en total?',
    lectura: 'En un cofre hay cinco stacks de sesenta y cuatro bloques de oro y sobran dieciocho bloques. ¿Cuántos bloques de oro hay en total?',
    explicacion: 'Multiplico los stacks: 5 × 64 = 320. Sumo los que sobran: 320 + 18 = 338 bloques.',
  },
  {
    numero: 93, emoji: '🧱', resultado: 216,
    enunciado: 'Steve construye un muro de ladrillos de 12 bloques de largo por 6 de alto. Si hace 3 muros iguales, ¿cuántos bloques usa en total?',
    lectura: 'Steve construye un muro de ladrillos de doce bloques de largo por seis de alto. Si hace tres muros iguales, ¿cuántos bloques usa en total?',
    explicacion: 'Un muro: 12 × 6 = 72 bloques. En 3 muros: 72 × 3 = 216 bloques.',
  },
  {
    numero: 94, emoji: '💚', resultado: 226,
    enunciado: 'Alex tiene 250 esmeraldas. Gasta 87 en herramientas y luego gana 63 más. ¿Cuántas esmeraldas tiene ahora?',
    lectura: 'Alex tiene doscientas cincuenta esmeraldas. Gasta ochenta y siete en herramientas y luego gana sesenta y tres más. ¿Cuántas esmeraldas tiene ahora?',
    explicacion: 'Resto lo gastado: 250 − 87 = 163. Sumo lo ganado: 163 + 63 = 226 esmeraldas.',
  },
  {
    numero: 95, emoji: '🥛', resultado: 120,
    enunciado: 'Un granjero tiene 8 vacas. Cada vaca da 3 cubos de leche por día. Si pasan 5 días, ¿cuántos cubos de leche obtiene en total?',
    lectura: 'Un granjero tiene ocho vacas. Cada vaca da tres cubos de leche por día. Si pasan cinco días, ¿cuántos cubos de leche obtiene en total?',
    explicacion: 'Por día: 8 × 3 = 24 cubos. En 5 días: 24 × 5 = 120 cubos.',
  },
  {
    numero: 96, emoji: '💎', fraccion: true, numerador: 5, denominador: 15,
    enunciado: 'En un cofre hay 3 diamantes, 5 esmeraldas y 7 rubíes. ¿Cuál es la fracción que representa a las esmeraldas del total de gemas?',
    lectura: 'En un cofre hay tres diamantes, cinco esmeraldas y siete rubíes. ¿Cuál es la fracción que representa a las esmeraldas del total de gemas?',
    explicacion: 'Total de gemas: 3 + 5 + 7 = 15. Hay 5 esmeraldas, entonces la fracción es 5/15.',
  },
  {
    numero: 97, emoji: '🔮', resultado: 30,
    enunciado: 'Para encantar una espada se necesitan 2 lapislázulis por nivel. Si Steve quiere encantarla a nivel 15, ¿cuántos lapislázulis necesita en total?',
    lectura: 'Para encantar una espada se necesitan dos lapislázulis por nivel. Si Steve quiere encantarla a nivel quince, ¿cuántos lapislázulis necesita en total?',
    explicacion: 'Multiplico: 2 × 15 = 30 lapislázulis.',
  },
  {
    numero: 98, emoji: '🗺️', resultado: 256,
    enunciado: 'Un mapa tiene forma de cuadrado de 16 chunks de lado. ¿Cuántos chunks abarca el mapa en total?',
    lectura: 'Un mapa tiene forma de cuadrado de dieciséis chunks de lado. ¿Cuántos chunks abarca el mapa en total?',
    explicacion: 'Área del cuadrado: 16 × 16 = 256 chunks.',
  },
  {
    numero: 99, emoji: '🛤️', resultado: 324,
    enunciado: 'En una mina hay 3 vagones. En cada vagón hay 27 bloques de hierro. Si se hacen 4 viajes iguales, ¿cuántos bloques de hierro se transportan en total?',
    lectura: 'En una mina hay tres vagones. En cada vagón hay veintisiete bloques de hierro. Si se hacen cuatro viajes iguales, ¿cuántos bloques de hierro se transportan en total?',
    explicacion: 'Por viaje: 3 × 27 = 81 bloques. En 4 viajes: 81 × 4 = 324 bloques.',
  },
  {
    numero: 100, emoji: '🏰', resultado: 24,
    enunciado: 'Un castillo tiene 4 torres. Cada torre tiene 18 bloques de altura. Si se le agregan 6 bloques más a cada torre, ¿cuál será la altura total de cada torre?',
    lectura: 'Un castillo tiene cuatro torres. Cada torre tiene dieciocho bloques de altura. Si se le agregan seis bloques más a cada torre, ¿cuál será la altura total de cada torre?',
    explicacion: 'Sumo: 18 + 6 = 24 bloques de altura por torre.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

// ── Bloque de estado ──

interface EstadoItem { valor: string; valor2: string; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo10() {
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', valor2: '', evaluado: false, correcto: false }])),
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
    if (p.fraccion) {
      if (actual.evaluado || actual.valor.trim() === '' || actual.valor2.trim() === '') return
      const correcto = Number(actual.valor.trim()) === p.numerador && Number(actual.valor2.trim()) === p.denominador
      if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
      registrarResultado(correcto)
      reaccionarRicky(correcto)
      setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
      return
    }
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.resultado
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', valor2: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #ca8a04 0%, #fde68a 35%, #fffbeb 100%)',
      color: '#713f12', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #ca8a04, #713f12)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #713f12', borderBottom: '4px solid #713f12',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>⭐🏆</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #713f12', margin: 0, color: 'white',
        }}>
          Misión 10: La misión final
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Demostrá que sos un constructor matemático.
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#ca8a04" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onCambiar2={valor2 => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor2 } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(113,63,18,0.15))' }}
          >
            <Ricky mood={rickyMood} loop={rickyMood === 'confused' ? 2 : undefined} size={140} />
          </div>
        )}

        {terminado && (
          <div style={{
            marginTop: '2rem', textAlign: 'center', background: 'white',
            border: '3px solid #ca8a04', boxShadow: '0 5px 0 rgba(202,138,4,0.2)', borderRadius: 20, padding: '1.75rem 1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Ricky mood={rickyMood} loop={rickyMood === 'celebrating'} size={160} />
            </div>
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#713f12' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ca8a04' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '🎉 ¡Misión completada! Demostraste que sos un constructor matemático 🏆'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi completás la misión.'
                : 'Seguí practicando, ¡vas a lograrlo!'}
            </p>
            {totalCorrectas === TOTAL_PREGUNTAS && (
              <div style={{
                margin: '0 0 1.5rem', padding: '1rem', borderRadius: 16, background: '#fef9c3',
                border: '2px solid #facc15',
              }}>
                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#854d0e' }}>
                  🏆 ¡100 problemas completados! 🏆
                </p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.95rem', fontWeight: 600, color: '#854d0e' }}>
                  Completaste toda la serie Problemas, de la Misión 1 a la Misión 10. ¡Sos un constructor matemático! 🎉
                </p>
              </div>
            )}
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

// Ejemplo resuelto — una caja de juguetes, distinto a los 10 ítems reales
// para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#0ea5e9'
  const enunciado = 'Una caja tiene 4 filas de 6 juguetes. Si se compran 3 cajas iguales, ¿cuántos juguetes hay en total?'
  const resultado = 72

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
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🧸</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: una caja tiene cuatro filas de seis juguetes. Si se compran tres cajas iguales, ¿cuántos juguetes hay en total? Por caja: 4 por 6 es 24. En 3 cajas: 24 por 3 es 72." tamano={32} />
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
        Por caja: 4 × 6 = 24. En 3 cajas: 24 × 3 = 72.
      </p>
    </div>
  )
}

function TarjetaProblema({ p, estado, color, onCambiar, onCambiar2, onComprobar, onExplicarEstado }: {
  p: Problema
  estado: EstadoItem
  color: string
  onCambiar: (valor: string) => void
  onCambiar2: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const listo = p.fraccion ? estado.valor.trim() !== '' && estado.valor2.trim() !== '' : estado.valor.trim() !== ''

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

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#713f12', fontWeight: 600 }}>{p.enunciado}</p>

      {p.fraccion ? (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            <input
              type="number"
              inputMode="numeric"
              value={estado.valor}
              disabled={estado.evaluado}
              onChange={e => onCambiar(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 60, padding: '0.4rem', borderRadius: '8px 8px 0 0', border: `2px solid ${bordeColor}55`,
                borderBottom: 'none', background: '#fffbeb', color: '#713f12', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center',
              }}
            />
            <div style={{ width: 60, height: 2, background: bordeColor }} />
            <input
              type="number"
              inputMode="numeric"
              value={estado.valor2}
              disabled={estado.evaluado}
              onChange={e => onCambiar2(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 60, padding: '0.4rem', borderRadius: '0 0 8px 8px', border: `2px solid ${bordeColor}55`,
                borderTop: 'none', background: '#fffbeb', color: '#713f12', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center',
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#713f12' }}>R:</span>
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
              background: '#fffbeb', color: '#713f12', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
            }}
          />
        </div>
      )}

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={!listo} style={{
            padding: '0.5rem 1.2rem', borderRadius: 10, border: 'none', cursor: listo ? 'pointer' : 'default',
            background: listo ? '#22c55e' : '#e2e8f0',
            boxShadow: listo ? '0 3px 0 #15803d' : 'none',
            color: 'white', fontWeight: 800, fontSize: '1rem', opacity: listo ? 1 : 0.7,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto
              ? '✅ ¡Correcto!'
              : p.fraccion
              ? `❌ Era ${p.numerador}/${p.denominador}`
              : `❌ Era ${p.resultado}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
