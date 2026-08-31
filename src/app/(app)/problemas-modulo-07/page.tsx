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

// ── Datos de la actividad (basados en la hoja "Misión 07 - El pastel de
// la abeja", serie "Problemas"). Todos los ítems son fracciones: un
// pastel dividido en partes iguales, de las que se toma o se comparte
// una cantidad. Los ítems 66 y 68 piden dos fracciones (lo que tiene
// ahora y lo que falta), igual que en la hoja. La numeración sigue de la
// misión 6 (61 a 70).

interface Campo { etiqueta: string; numerador: number; denominador: number }

interface Problema {
  numero: number
  enunciado: string
  lectura: string
  campos: Campo[]
  explicacion: string
}

const PROBLEMAS: Problema[] = [
  {
    numero: 61,
    enunciado: 'La abeja dividió un pastel de miel en 2 partes iguales. Si toma 1 parte, ¿qué fracción del pastel tiene?',
    lectura: 'La abeja dividió un pastel de miel en dos partes iguales. Si toma una parte, ¿qué fracción del pastel tiene?',
    campos: [{ etiqueta: 'R', numerador: 1, denominador: 2 }],
    explicacion: 'El pastel tiene 2 partes iguales y toma 1: la fracción es 1/2.',
  },
  {
    numero: 62,
    enunciado: 'La abeja dividió un pastel de miel en 3 partes iguales. Si toma 2 partes, ¿qué fracción del pastel tiene?',
    lectura: 'La abeja dividió un pastel de miel en tres partes iguales. Si toma dos partes, ¿qué fracción del pastel tiene?',
    campos: [{ etiqueta: 'R', numerador: 2, denominador: 3 }],
    explicacion: 'El pastel tiene 3 partes iguales y toma 2: la fracción es 2/3.',
  },
  {
    numero: 63,
    enunciado: 'La abeja dividió un pastel de miel en 4 partes iguales. Si comparte 3 partes con sus amigos, ¿qué fracción del pastel dio?',
    lectura: 'La abeja dividió un pastel de miel en cuatro partes iguales. Si comparte tres partes con sus amigos, ¿qué fracción del pastel dio?',
    campos: [{ etiqueta: 'R', numerador: 3, denominador: 4 }],
    explicacion: 'El pastel tiene 4 partes iguales y comparte 3: dio 3/4 del pastel.',
  },
  {
    numero: 64,
    enunciado: 'La abeja dividió un pastel de miel en 5 partes iguales. Si toma 2 partes, ¿qué fracción del pastel tiene?',
    lectura: 'La abeja dividió un pastel de miel en cinco partes iguales. Si toma dos partes, ¿qué fracción del pastel tiene?',
    campos: [{ etiqueta: 'R', numerador: 2, denominador: 5 }],
    explicacion: 'El pastel tiene 5 partes iguales y toma 2: la fracción es 2/5.',
  },
  {
    numero: 65,
    enunciado: 'La abeja dividió un pastel de miel en 6 partes iguales. Si comparte 4 partes, ¿qué fracción del pastel dio?',
    lectura: 'La abeja dividió un pastel de miel en seis partes iguales. Si comparte cuatro partes, ¿qué fracción del pastel dio?',
    campos: [{ etiqueta: 'R', numerador: 4, denominador: 6 }],
    explicacion: 'El pastel tiene 6 partes iguales y comparte 4: dio 4/6 del pastel.',
  },
  {
    numero: 66,
    enunciado: 'La abeja dividió un pastel de miel en 8 partes iguales. Si toma 3 partes y luego 2 partes más, ¿qué fracción del pastel tiene ahora? ¿Y qué fracción del pastel falta?',
    lectura: 'La abeja dividió un pastel de miel en ocho partes iguales. Si toma tres partes y luego dos partes más, ¿qué fracción del pastel tiene ahora? ¿Y qué fracción del pastel falta?',
    campos: [{ etiqueta: 'Tiene', numerador: 5, denominador: 8 }, { etiqueta: 'Falta', numerador: 3, denominador: 8 }],
    explicacion: 'Toma 3 y después 2 más: 3 + 2 = 5 partes de 8, tiene 5/8. Faltan 8 − 5 = 3 partes, falta 3/8.',
  },
  {
    numero: 67,
    enunciado: 'La abeja dividió un pastel de miel en 10 partes iguales. Si comparte 7 partes, ¿qué fracción del pastel dio?',
    lectura: 'La abeja dividió un pastel de miel en diez partes iguales. Si comparte siete partes, ¿qué fracción del pastel dio?',
    campos: [{ etiqueta: 'R', numerador: 7, denominador: 10 }],
    explicacion: 'El pastel tiene 10 partes iguales y comparte 7: dio 7/10 del pastel.',
  },
  {
    numero: 68,
    enunciado: 'La abeja dividió un pastel de miel en 12 partes iguales. Si toma 5 partes y luego 3 partes más, ¿qué fracción del pastel tiene ahora? ¿Y qué fracción del pastel falta?',
    lectura: 'La abeja dividió un pastel de miel en doce partes iguales. Si toma cinco partes y luego tres partes más, ¿qué fracción del pastel tiene ahora? ¿Y qué fracción del pastel falta?',
    campos: [{ etiqueta: 'Tiene', numerador: 8, denominador: 12 }, { etiqueta: 'Falta', numerador: 4, denominador: 12 }],
    explicacion: 'Toma 5 y después 3 más: 5 + 3 = 8 partes de 12, tiene 8/12. Faltan 12 − 8 = 4 partes, falta 4/12.',
  },
  {
    numero: 69,
    enunciado: 'La abeja dividió un pastel de miel en 9 partes iguales. Si da 6 partes a sus amigos, ¿qué fracción del pastel dio?',
    lectura: 'La abeja dividió un pastel de miel en nueve partes iguales. Si da seis partes a sus amigos, ¿qué fracción del pastel dio?',
    campos: [{ etiqueta: 'R', numerador: 6, denominador: 9 }],
    explicacion: 'El pastel tiene 9 partes iguales y da 6: dio 6/9 del pastel.',
  },
  {
    numero: 70,
    enunciado: 'La abeja dividió un pastel de miel en 11 partes iguales. Si toma 4 partes, ¿qué fracción del pastel tiene?',
    lectura: 'La abeja dividió un pastel de miel en once partes iguales. Si toma cuatro partes, ¿qué fracción del pastel tiene?',
    campos: [{ etiqueta: 'R', numerador: 4, denominador: 11 }],
    explicacion: 'El pastel tiene 11 partes iguales y toma 4: la fracción es 4/11.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

// ── Bloque de estado ──

interface ValorFraccion { num: string; den: string }
interface EstadoItem { valores: ValorFraccion[]; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo07() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valores: p.campos.map(() => ({ num: '', den: '' })), evaluado: false, correcto: false }])),
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'problemas-modulo-07', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: Problema) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valores.some(v => v.num.trim() === '' || v.den.trim() === '')) return
    const correcto = p.campos.every((c, i) => Number(actual.valores[i].num) === c.numerador && Number(actual.valores[i].den) === c.denominador)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valores: p.campos.map(() => ({ num: '', den: '' })), evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #db2777 0%, #f9a8d4 35%, #fdf2f8 100%)',
      color: '#831843', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #db2777, #831843)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #831843', borderBottom: '4px solid #831843',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🐝🍯</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #831843', margin: 0, color: 'white',
        }}>
          Misión 07: El pastel de la abeja
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Repartí los pasteles de miel en partes justas.
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#db2777" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={(indice, campo, valor) => setItems(prev => {
                const valores = prev[p.numero].valores.map(v => ({ ...v }))
                valores[indice][campo] = valor
                return { ...prev, [p.numero]: { ...prev[p.numero], valores } }
              })}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(131,24,67,0.15))' }}
          >
            <Ricky mood={rickyMood} loop={rickyMood === 'confused' ? 2 : undefined} size={140} />
          </div>
        )}

        {terminado && (
          <div style={{
            marginTop: '2rem', textAlign: 'center', background: 'white',
            border: '3px solid #db2777', boxShadow: '0 5px 0 rgba(219,39,119,0.2)', borderRadius: 20, padding: '1.75rem 1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Ricky mood={rickyMood} loop={rickyMood === 'celebrating'} size={160} />
            </div>
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#831843' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#db2777' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '🎉 ¡Misión completada! Repartiste todos los pasteles en partes justas 🏆'
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

// Ejemplo resuelto — un pastel de manzana, distinto a los 10 ítems reales
// para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#0ea5e9'
  const enunciado = 'Un pastel de manzana está dividido en 6 partes iguales. Si toma 5 partes, ¿qué fracción del pastel tiene?'

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
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🥧</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: un pastel de manzana está dividido en seis partes iguales. Si toma cinco partes, ¿qué fracción del pastel tiene? La respuesta es 5 sextos." tamano={32} />
      </div>

      <p style={{ fontSize: '0.9rem', margin: '0 0 0.7rem', color: '#0c4a6e', fontWeight: 600 }}>{enunciado}</p>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0c4a6e' }}>R: </span>
        <FraccionResultado numerador={5} denominador={6} />
      </div>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#0c4a6e', opacity: 0.85, margin: '0.7rem 0 0' }}>
        El pastel tiene 6 partes iguales y toma 5: la fracción es 5/6.
      </p>
    </div>
  )
}

function FraccionResultado({ numerador, denominador }: { numerador: number; denominador: number }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
      <span style={{
        padding: '0.1rem 0.6rem', borderRadius: '8px 8px 0 0', border: '2px solid #22c55e', borderBottom: 'none',
        background: '#dcfce7', color: '#16a34a', fontSize: '1.1rem', fontWeight: 800,
      }}>
        {numerador}
      </span>
      <span style={{
        padding: '0.1rem 0.6rem', borderRadius: '0 0 8px 8px', border: '2px solid #22c55e', borderTop: '2px solid #16a34a',
        background: '#dcfce7', color: '#16a34a', fontSize: '1.1rem', fontWeight: 800,
      }}>
        {denominador}
      </span>
    </span>
  )
}

function TarjetaProblema({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: Problema
  estado: EstadoItem
  color: string
  onCambiar: (indice: number, campo: 'num' | 'den', valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const listo = estado.valores.every(v => v.num.trim() !== '' && v.den.trim() !== '')

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
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🍰</span>
        <BotonEscuchar texto={p.lectura} tamano={32} />
      </div>

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#831843', fontWeight: 600 }}>{p.enunciado}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
        {p.campos.map((c, i) => (
          <div key={c.etiqueta} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
            {p.campos.length > 1 && (
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#831843' }}>{c.etiqueta}:</span>
            )}
            <input
              type="number"
              inputMode="numeric"
              value={estado.valores[i].num}
              disabled={estado.evaluado}
              onChange={e => onCambiar(i, 'num', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 52, padding: '0.3rem', borderRadius: '8px 8px 0 0', border: `2px solid ${bordeColor}55`,
                borderBottom: 'none', background: '#fdf2f8', color: '#831843', fontSize: '1.05rem', fontWeight: 800, textAlign: 'center',
              }}
            />
            <div style={{ width: 52, height: 2, background: bordeColor }} />
            <input
              type="number"
              inputMode="numeric"
              value={estado.valores[i].den}
              disabled={estado.evaluado}
              onChange={e => onCambiar(i, 'den', e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 52, padding: '0.3rem', borderRadius: '0 0 8px 8px', border: `2px solid ${bordeColor}55`,
                borderTop: 'none', background: '#fdf2f8', color: '#831843', fontSize: '1.05rem', fontWeight: 800, textAlign: 'center',
              }}
            />
          </div>
        ))}
      </div>

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
              : `❌ Era ${p.campos.map(c => `${c.etiqueta}: ${c.numerador}/${c.denominador}`).join(' · ')}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
