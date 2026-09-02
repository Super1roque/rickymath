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
import CandadoPremium from '@/components/guia/CandadoPremium'

// ── Datos de la actividad (basados en la hoja "Misión 06 - La gran
// construcción", serie "Problemas"). Son problemas de medidas: área,
// perímetro, volumen, distancias con decimales y tiempo. Cada ítem tiene
// uno o dos campos de respuesta (`campos`) — la mayoría solo "R", pero
// algunos piden dos valores (perímetro y área, litros que quedan y
// litros totales, horas y minutos), igual que en la hoja. La numeración
// sigue de la misión 5 (51 a 60).

interface Campo { etiqueta: string; resultado: number }

interface Problema {
  numero: number
  emoji: string
  enunciado: string
  lectura: string
  campos: Campo[]
  explicacion: string
}

const PROBLEMAS: Problema[] = [
  {
    numero: 51, emoji: '🏰',
    enunciado: 'La pared del castillo mide 18 m de largo y 6 m de alto. ¿Cuántos metros cuadrados tiene en total?',
    lectura: 'La pared del castillo mide dieciocho metros de largo y seis metros de alto. ¿Cuántos metros cuadrados tiene en total?',
    campos: [{ etiqueta: 'R', resultado: 108 }],
    explicacion: 'Multiplico: 18 × 6 = 108 metros cuadrados.',
  },
  {
    numero: 52, emoji: '🌉',
    enunciado: 'Un puente mide 24 m de largo y 4 m de ancho. ¿Cuál es su área total?',
    lectura: 'Un puente mide veinticuatro metros de largo y cuatro metros de ancho. ¿Cuál es su área total?',
    campos: [{ etiqueta: 'R', resultado: 96 }],
    explicacion: 'Multiplico: 24 × 4 = 96 metros cuadrados.',
  },
  {
    numero: 53, emoji: '🧱',
    enunciado: 'Se necesitan 15 m³ de piedra para construir una torre. Si ya se tienen 9 m³, ¿cuántos metros cúbicos faltan?',
    lectura: 'Se necesitan quince metros cúbicos de piedra para construir una torre. Si ya se tienen nueve metros cúbicos, ¿cuántos metros cúbicos faltan?',
    campos: [{ etiqueta: 'R', resultado: 6 }],
    explicacion: 'Resto: 15 − 9 = 6 metros cúbicos.',
  },
  {
    numero: 54, emoji: '📐',
    enunciado: 'Un terreno rectangular mide 35 m de largo y 20 m de ancho. ¿Cuál es su perímetro y su área?',
    lectura: 'Un terreno rectangular mide treinta y cinco metros de largo y veinte metros de ancho. ¿Cuál es su perímetro y su área?',
    campos: [{ etiqueta: 'Perímetro', resultado: 110 }, { etiqueta: 'Área', resultado: 700 }],
    explicacion: 'Perímetro: 2 × (35 + 20) = 2 × 55 = 110 m. Área: 35 × 20 = 700 metros cuadrados.',
  },
  {
    numero: 55, emoji: '🚚',
    enunciado: 'Un camión de aldeanos transporta 1250 kg de piedra. Si hace 3 viajes iguales, ¿cuántos kilogramos transporta en total?',
    lectura: 'Un camión de aldeanos transporta mil doscientos cincuenta kilos de piedra. Si hace tres viajes iguales, ¿cuántos kilogramos transporta en total?',
    campos: [{ etiqueta: 'R', resultado: 3750 }],
    explicacion: 'Multiplico: 1250 × 3 = 3750 kg.',
  },
  {
    numero: 56, emoji: '⛏️',
    enunciado: 'Desde la aldea hasta la cantera hay 2,8 km. Si el constructor recorre 1,35 km, ¿cuántos kilómetros le faltan?',
    lectura: 'Desde la aldea hasta la cantera hay dos coma ocho kilómetros. Si el constructor recorre uno coma treinta y cinco kilómetros, ¿cuántos kilómetros le faltan?',
    campos: [{ etiqueta: 'R', resultado: 1.45 }],
    explicacion: 'Resto: 2,8 − 1,35 = 1,45 km.',
  },
  {
    numero: 57, emoji: '🪵',
    enunciado: 'Para el techo se usan vigas de 5 m de largo. Si se colocan 12 vigas, ¿cuántos metros en total se utilizan?',
    lectura: 'Para el techo se usan vigas de cinco metros de largo. Si se colocan doce vigas, ¿cuántos metros en total se utilizan?',
    campos: [{ etiqueta: 'R', resultado: 60 }],
    explicacion: 'Multiplico: 5 × 12 = 60 m.',
  },
  {
    numero: 58, emoji: '⚙️',
    enunciado: 'Un generador de hierro produce 20 lingotes cada 15 minutos. ¿Cuántos lingotes produce en 1 hora?',
    lectura: 'Un generador de hierro produce veinte lingotes cada quince minutos. ¿Cuántos lingotes produce en una hora?',
    campos: [{ etiqueta: 'R', resultado: 80 }],
    explicacion: 'En 1 hora hay 4 períodos de 15 minutos. Multiplico: 20 × 4 = 80 lingotes.',
  },
  {
    numero: 59, emoji: '💧',
    enunciado: 'Un depósito tiene 12 000 L de agua. Se usan 4350 L para riego y luego se añaden 1250 L más. ¿Cuántos litros quedan y cuántos litros hay en total después?',
    lectura: 'Un depósito tiene doce mil litros de agua. Se usan cuatro mil trescientos cincuenta litros para riego y luego se añaden mil doscientos cincuenta litros más. ¿Cuántos litros quedan y cuántos litros hay en total después?',
    campos: [{ etiqueta: 'Quedan', resultado: 7650 }, { etiqueta: 'Total', resultado: 8900 }],
    explicacion: 'Primero resto: 12000 − 4350 = 7650 L (quedan). Después sumo: 7650 + 1250 = 8900 L (total).',
  },
  {
    numero: 60, emoji: '👷',
    enunciado: 'Un constructor tardó 2 h 15 min en construir una sala y luego 3 h 40 min en otra. ¿Cuánto tiempo trabajó en total en ambas salas?',
    lectura: 'Un constructor tardó dos horas quince minutos en construir una sala y luego tres horas cuarenta minutos en otra. ¿Cuánto tiempo trabajó en total en ambas salas?',
    campos: [{ etiqueta: 'Horas', resultado: 5 }, { etiqueta: 'Minutos', resultado: 55 }],
    explicacion: 'Sumo horas: 2 + 3 = 5. Sumo minutos: 15 + 40 = 55. En total: 5 horas y 55 minutos.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

function aNumero(texto: string): number {
  return Number(texto.trim().replace(',', '.'))
}

// ── Bloque de estado ──

interface EstadoItem { valores: string[]; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo06() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valores: p.campos.map(() => ''), evaluado: false, correcto: false }])),
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'problemas-modulo-06', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: Problema) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valores.some(v => v.trim() === '')) return
    const correcto = p.campos.every((c, i) => Math.abs(aNumero(actual.valores[i]) - c.resultado) < 0.005)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valores: p.campos.map(() => ''), evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #475569 0%, #94a3b8 35%, #f1f5f9 100%)',
      color: '#1e293b', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #475569, #1e293b)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #1e293b', borderBottom: '4px solid #1e293b',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🏗️🧱</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #1e293b', margin: 0, color: 'white',
        }}>
          Misión 06: La gran construcción
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          El gólem de hierro dirige la obra — ¡medí antes de construir!
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#475569" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={(indice, valor) => setItems(prev => {
                const valores = [...prev[p.numero].valores]
                valores[indice] = valor
                return { ...prev, [p.numero]: { ...prev[p.numero], valores } }
              })}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(30,41,59,0.15))' }}
          >
            <Ricky mood={rickyMood} loop={rickyMood === 'confused' ? 2 : undefined} size={140} />
          </div>
        )}

        {terminado && (
          <div style={{
            marginTop: '2rem', textAlign: 'center', background: 'white',
            border: '3px solid #475569', boxShadow: '0 5px 0 rgba(71,85,105,0.2)', borderRadius: 20, padding: '1.75rem 1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Ricky mood={rickyMood} loop={rickyMood === 'celebrating'} size={160} />
            </div>
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#1e293b' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#475569' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '🎉 ¡Misión completada! La gran construcción quedó perfecta 🏆'
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
        {tenantData?.plan !== 'premium' && <CandadoPremium />}
      </div>
    </div>
  )
}

// Ejemplo resuelto — un jardín, distinto a los 10 ítems reales para no
// revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#0ea5e9'
  const enunciado = 'Un jardín mide 8 m de largo y 3 m de ancho. ¿Cuál es su área?'
  const resultado = 24

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
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🌻</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: un jardín mide ocho metros de largo y tres metros de ancho. ¿Cuál es su área? Multiplico 8 por 3, que es 24." tamano={32} />
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
        Multiplico: 8 × 3 = 24 metros cuadrados.
      </p>
    </div>
  )
}

function TarjetaProblema({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: Problema
  estado: EstadoItem
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

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#1e293b', fontWeight: 600 }}>{p.enunciado}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
        {p.campos.map((c, i) => (
          <div key={c.etiqueta} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '1rem', fontWeight: 800, color: '#1e293b',
              width: p.campos.length > 1 ? 92 : 'auto', textAlign: p.campos.length > 1 ? 'right' : 'left',
            }}>
              {p.campos.length > 1 ? `${c.etiqueta}:` : 'R:'}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={estado.valores[i]}
              disabled={estado.evaluado}
              onChange={e => onCambiar(i, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 80, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
                background: '#f1f5f9', color: '#1e293b', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center',
              }}
            />
            {i === p.campos.length - 1 && !estado.evaluado && (
              <button onClick={onComprobar} disabled={!listo} style={{
                padding: '0.5rem 0.9rem', borderRadius: 10, border: 'none', cursor: listo ? 'pointer' : 'default',
                background: listo ? '#22c55e' : '#e2e8f0',
                boxShadow: listo ? '0 3px 0 #15803d' : 'none',
                color: 'white', fontWeight: 800, fontSize: '1rem', opacity: listo ? 1 : 0.7,
              }}>
                ✓
              </button>
            )}
          </div>
        ))}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto
              ? '✅ ¡Correcto!'
              : `❌ Era ${p.campos.map(c => `${c.etiqueta}: ${c.resultado}`).join(' · ')}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
