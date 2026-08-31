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

// ── Datos de la actividad (basados en la hoja "Actividad 4 - Fracciones
// con Distinto Denominador"). Cada ítem trae impresos el denominador común
// y el resultado final — igual que en el resto de la serie, se convierten
// en casillas que el chico completa y la app corrige. Se piden 2 pasos:
// convertir cada fracción al denominador común, y escribir el resultado
// (se acepta sin simplificar o simplificado, comparando por producto
// cruzado en vez de una lista fija de strings).

interface ItemFraccion {
  numero: number
  aNum: number
  aDen: number
  bNum: number
  bDen: number
  operador: '+' | '-'
  comun: number
  convA: number
  convB: number
  resNum: number
  resDen: number
  explicacion: string
}

const ITEMS: ItemFraccion[] = [
  {
    numero: 1, aNum: 1, aDen: 2, bNum: 1, bDen: 4, operador: '+', comun: 4, convA: 2, convB: 1, resNum: 3, resDen: 4,
    explicacion: '1/2 = 2/4 y 1/4 = 1/4. Sumo los numeradores: 2/4 + 1/4 = 3/4.',
  },
  {
    numero: 2, aNum: 1, aDen: 3, bNum: 1, bDen: 6, operador: '+', comun: 6, convA: 2, convB: 1, resNum: 3, resDen: 6,
    explicacion: '1/3 = 2/6 y 1/6 = 1/6. Sumo los numeradores: 2/6 + 1/6 = 3/6, que simplificado es 1/2.',
  },
  {
    numero: 3, aNum: 2, aDen: 5, bNum: 3, bDen: 10, operador: '+', comun: 10, convA: 4, convB: 3, resNum: 7, resDen: 10,
    explicacion: '2/5 = 4/10 y 3/10 = 3/10. Sumo los numeradores: 4/10 + 3/10 = 7/10.',
  },
  {
    numero: 4, aNum: 3, aDen: 4, bNum: 1, bDen: 2, operador: '-', comun: 4, convA: 3, convB: 2, resNum: 1, resDen: 4,
    explicacion: '3/4 = 3/4 y 1/2 = 2/4. Resto los numeradores: 3/4 − 2/4 = 1/4.',
  },
  {
    numero: 5, aNum: 2, aDen: 3, bNum: 1, bDen: 6, operador: '-', comun: 6, convA: 4, convB: 1, resNum: 3, resDen: 6,
    explicacion: '2/3 = 4/6 y 1/6 = 1/6. Resto los numeradores: 4/6 − 1/6 = 3/6, que simplificado es 1/2.',
  },
  {
    numero: 6, aNum: 1, aDen: 2, bNum: 1, bDen: 3, operador: '+', comun: 6, convA: 3, convB: 2, resNum: 5, resDen: 6,
    explicacion: '1/2 = 3/6 y 1/3 = 2/6. Sumo los numeradores: 3/6 + 2/6 = 5/6.',
  },
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
    numero: 1, antes: 'Para sumar fracciones necesito el mismo', despues: '.',
    aceptables: ['denominador'],
    lectura: 'Para sumar fracciones, ¿qué necesito que sea igual?',
    explicacion: 'Para sumar o restar fracciones necesito que tengan el mismo denominador — si no lo tienen, primero busco un denominador común.',
  },
  {
    numero: 2, antes: '1/2 es igual a', despues: '/4.',
    aceptables: ['2'],
    lectura: 'Un medio, ¿es igual a cuántos cuartos?',
    explicacion: '1/2 es igual a 2/4 — multiplico numerador y denominador por 2.',
  },
  {
    numero: 3, antes: '1/2 + 1/3 =', despues: '',
    aceptables: ['5/6'],
    lectura: 'Un medio más un tercio, ¿cuánto es?',
    explicacion: '1/2 = 3/6 y 1/3 = 2/6. Sumo: 3/6 + 2/6 = 5/6.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoItem { convA: string; convB: string; resNum: string; resDen: string; evaluado: boolean; correcto: boolean }
interface EstadoCompleta { valor: string; evaluado: boolean; correcto: boolean }

export default function QuintoModulo04() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { convA: '', convB: '', resNum: '', resDen: '', evaluado: false, correcto: false }])),
  )
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
    const b = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return a + b
  }, [items, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(items).filter(e => e.evaluado).length
    const b = Object.values(completa).filter(e => e.evaluado).length
    return a + b
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'quinto-modulo-04', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: ItemFraccion) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.convA.trim() === '' || actual.convB.trim() === '' || actual.resNum.trim() === '' || actual.resDen.trim() === '') return
    const resDenNum = Number(actual.resDen.trim())
    const convOk = Number(actual.convA.trim()) === p.convA && Number(actual.convB.trim()) === p.convB
    const resultadoOk = resDenNum !== 0 && Number(actual.resNum.trim()) * p.resDen === p.resNum * resDenNum
    const correcto = convOk && resultadoOk
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarCompleta(p: PreguntaCompleta) {
    const actual = completa[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = p.aceptables.map(normalizarTexto).includes(normalizarTexto(actual.valor.replace(/\s+/g, '')))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompleta(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { convA: '', convB: '', resNum: '', resDen: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #d97706 0%, #fcd34d 35%, #fef3c7 100%)',
      color: '#78350f', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <style>{`
        .gj-input-digito::-webkit-outer-spin-button,
        .gj-input-digito::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .gj-input-digito { -moz-appearance: textfield; }
      `}</style>
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #d97706, #78350f)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #451a03', borderBottom: '4px solid #451a03',
      }}>
        <BotonMenu href="/quinto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🥚🐔</div>
        <h1 style={{
          fontSize: 'clamp(1.1rem, 4.5vw, 2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #451a03', margin: 0, color: 'white',
        }}>
          ¡Fracciones con distinto denominador!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Buscá el denominador común y resolvé
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#d97706" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaFraccion key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={(campo, valor) => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], [campo]: valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #fcd34d', boxShadow: '0 4px 0 rgba(69,26,3,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#78350f' }}>
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
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#d97706' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás las fracciones con distinto denominador 🎮'
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

function Fraccion({ num, den, size = '1.3rem' }: { num: number | string; den: number | string; size?: string }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontWeight: 800, fontSize: size, lineHeight: 1.1, verticalAlign: 'middle' }}>
      <span>{num}</span>
      <span style={{ borderTop: '2px solid currentColor', minWidth: '1.2em', textAlign: 'center' }}>{den}</span>
    </span>
  )
}

// Ejemplo resuelto — 1/4 + 1/8, distinto a los 6 ítems reales para no
// revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'

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
        <BotonEscuchar texto="Ejemplo: un cuarto más un octavo. Busco el denominador común, que es 8. Un cuarto es dos octavos, un octavo es un octavo. Sumo dos octavos más un octavo, y da tres octavos." tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <Fraccion num={1} den={4} size="1.5rem" />
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e3a8a' }}>+</span>
        <Fraccion num={1} den={8} size="1.5rem" />
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e3a8a' }}>=</span>
        <span style={{
          padding: '0.2rem 0.6rem', borderRadius: 8, border: '2px solid #22c55e', background: '#dcfce7', color: '#16a34a',
        }}>
          <Fraccion num={3} den={8} size="1.5rem" />
        </span>
      </div>

      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: 0 }}>
        Denominador común: 8. 1/4 = 2/8, 1/8 = 1/8. Sumo los numeradores: 2/8 + 1/8 = 3/8.
      </p>
    </div>
  )
}

type CampoItem = 'convA' | 'convB' | 'resNum' | 'resDen'

function TarjetaFraccion({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemFraccion
  estado: EstadoItem
  color: string
  onCambiar: (campo: CampoItem, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const faltan = [estado.convA, estado.convB, estado.resNum, estado.resDen].some(v => v.trim() === '')

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !faltan) onComprobar()
  }

  const campoEstilo = (ancho: number) => ({
    width: ancho, padding: '0.3rem', borderRadius: 8, border: `2px solid ${bordeColor}55`,
    background: '#fffbeb', color: '#78350f', fontSize: '1rem', fontWeight: 700, textAlign: 'center' as const,
  })

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
          {p.numero}
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🥚</span>
        <BotonEscuchar texto={`¿Cuánto es ${p.aNum} ${p.aDen === 1 ? 'entero' : `${p.aDen}avo`}, ${p.operador === '+' ? 'más' : 'menos'}, ${p.bNum} ${p.bDen}avo?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
        <Fraccion num={p.aNum} den={p.aDen} />
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#78350f' }}>{p.operador}</span>
        <Fraccion num={p.bNum} den={p.bDen} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <Fraccion num={p.aNum} den={p.aDen} size="1rem" />
          <span style={{ fontWeight: 700 }}>=</span>
          <input type="number" inputMode="numeric" className="gj-input-digito" value={estado.convA} disabled={estado.evaluado}
            onChange={e => onCambiar('convA', e.target.value)} onKeyDown={handleKeyDown} placeholder="?" style={campoEstilo(40)} />
          <Fraccion num="" den={p.comun} size="1rem" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
          <Fraccion num={p.bNum} den={p.bDen} size="1rem" />
          <span style={{ fontWeight: 700 }}>=</span>
          <input type="number" inputMode="numeric" className="gj-input-digito" value={estado.convB} disabled={estado.evaluado}
            onChange={e => onCambiar('convB', e.target.value)} onKeyDown={handleKeyDown} placeholder="?" style={campoEstilo(40)} />
          <Fraccion num="" den={p.comun} size="1rem" />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
        <span style={{ fontWeight: 700, color: '#78350f' }}>Resultado:</span>
        <input type="number" inputMode="numeric" className="gj-input-digito" value={estado.resNum} disabled={estado.evaluado}
          onChange={e => onCambiar('resNum', e.target.value)} onKeyDown={handleKeyDown} placeholder="?" style={campoEstilo(40)} />
        <span style={{ fontWeight: 700 }}>/</span>
        <input type="number" inputMode="numeric" className="gj-input-digito" value={estado.resDen} disabled={estado.evaluado}
          onChange={e => onCambiar('resDen', e.target.value)} onKeyDown={handleKeyDown} placeholder="?" style={campoEstilo(40)} />
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.convA}/${p.comun} y ${p.convB}/${p.comun}, resultado ${p.resNum}/${p.resDen}`}
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#fcd34d'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fffbeb',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#78350f' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #fcd34d',
          background: 'white', color: '#78350f', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#78350f' }}>{p.despues}</span>
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
