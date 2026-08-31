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

// ── Datos de la actividad (basados en la hoja "Actividad 8 - Perímetro y
// Área"). A diferencia de la mayoría de las hojas de esta serie, acá las
// medidas SÍ vienen impresas con claridad (6×4, 7×7, 9×2, 4×6 vs 8×3), sin
// ambigüedad de conteo.

interface ItemPA {
  numero: number
  ancho: number
  alto: number
}

const ITEMS: ItemPA[] = [
  { numero: 1, ancho: 6, alto: 4 },
  { numero: 2, ancho: 7, alto: 7 },
  { numero: 3, ancho: 9, alto: 2 },
]

function perimetro(p: ItemPA): number {
  return 2 * (p.ancho + p.alto)
}
function area(p: ItemPA): number {
  return p.ancho * p.alto
}

const COMPARA_A = { ancho: 4, alto: 6 }
const COMPARA_B = { ancho: 8, alto: 3 }

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
    numero: 1, antes: 'El perímetro se mide en bloques y el área en bloques', despues: '.',
    aceptables: ['cuadrados'],
    lectura: 'El perímetro se mide en bloques, ¿y el área en bloques qué?',
    explicacion: 'El perímetro es una longitud (bloques), pero el área cubre una superficie — se mide en bloques cuadrados (bloques²).',
  },
  {
    numero: 2, antes: 'Para cercar un terreno necesito el', despues: '.',
    aceptables: ['perimetro'],
    lectura: 'Para cercar un terreno con valla, ¿qué necesito saber?',
    explicacion: 'La valla rodea el borde del terreno, así que la cantidad que necesito es el perímetro, no el área.',
  },
  {
    numero: 3, antes: 'Dos terrenos con la misma área pueden tener distinto', despues: '.',
    aceptables: ['perimetro'],
    lectura: 'Dos terrenos con la misma área, ¿qué pueden tener distinto?',
    explicacion: 'El 4×6 y el 8×3 tienen la misma área (24), pero distinta forma — por eso sus perímetros son distintos (20 y 22).',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoPA { p: string; a: string; evaluado: boolean; correcto: boolean }
interface EstadoCompara { area: string; valla: string; evaluado: boolean; correcto: boolean }
interface EstadoSimple { valor: string; evaluado: boolean; correcto: boolean }

export default function CuartoModulo08() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoPA>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { p: '', a: '', evaluado: false, correcto: false }])),
  )
  const [compara, setCompara] = useState<EstadoCompara>({ area: '', valla: '', evaluado: false, correcto: false })
  const [completa, setCompleta] = useState<Record<number, EstadoSimple>>(() =>
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
    const b = compara.evaluado && compara.correcto ? 1 : 0
    const c = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return a + b + c
  }, [items, compara, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(items).filter(e => e.evaluado).length
    const b = compara.evaluado ? 1 : 0
    const c = Object.values(completa).filter(e => e.evaluado).length
    return a + b + c
  }, [items, compara, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'cuarto-modulo-08', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: ItemPA) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.p.trim() === '' || actual.a.trim() === '') return
    const correcto = Number(actual.p.trim()) === perimetro(p) && Number(actual.a.trim()) === area(p)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarCompara() {
    if (compara.evaluado || compara.area.trim() === '' || compara.valla.trim() === '') return
    const iguales = ['iguales', 'ninguna', 'ninguno', 'las dos', 'ambas', 'igual']
    const ganaValla = normalizarTexto(compara.valla).replace(/\s+/g, '')
    const okArea = iguales.includes(normalizarTexto(compara.area))
    const okValla = ganaValla.includes('8x3') || ganaValla.includes('segundo') || ganaValla.includes('ochoportres')
    const correcto = okArea && okValla
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompara(prev => ({ ...prev, evaluado: true, correcto }))
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { p: '', a: '', evaluado: false, correcto: false }])))
    setCompara({ area: '', valla: '', evaluado: false, correcto: false })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #57534e 0%, #a8a29e 35%, #f5f5f4 100%)',
      color: '#292524', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #57534e, #44403c)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #1c1917', borderBottom: '4px solid #1c1917',
      }}>
        <BotonMenu href="/cuarto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🧱📏</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #1c1917', margin: 0, color: 'white',
        }}>
          ¡Perímetro y área!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Para cada terreno, calculá las dos cosas: perímetro y área
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#57534e" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaPerimetroArea key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiarP={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], p: valor } }))}
              onCambiarA={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], a: valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <TarjetaComparacion estado={compara}
            onCambiarArea={valor => setCompara(prev => ({ ...prev, area: valor }))}
            onCambiarValla={valor => setCompara(prev => ({ ...prev, valla: valor }))}
            onComprobar={comprobarCompara} onExplicarEstado={reaccionarRickyExplicar} />
        </div>

        <div style={{
          background: 'white', border: '3px solid #d6d3d1', boxShadow: '0 4px 0 rgba(28,25,23,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#292524' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(28,25,23,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#292524' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#57534e' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás perímetro y área 🎮'
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

// Terreno cercado — rectángulo verde (pasto) con valla marrón alrededor y
// las medidas rotuladas, a escala real según ancho/alto.
function TerrenoSVG({ ancho, alto }: { ancho: number; alto: number }) {
  const ESCALA = 11
  const w = ancho * ESCALA
  const h = alto * ESCALA
  const padX = 30
  const padTop = 16
  const padBottom = 22
  const vw = w + padX * 2
  const vh = h + padTop + padBottom
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" style={{ maxWidth: 220, display: 'block', margin: '0 auto' }}>
      <rect x={padX} y={padTop} width={w} height={h} fill="#4ade80" stroke="#78350f" strokeWidth={4} rx={2} />
      <text x={vw / 2} y={padTop + h + 16} textAnchor="middle" fontSize={12} fontWeight={800} fill="#292524">{ancho}</text>
      <text x={padX + w + 16} y={padTop + h / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill="#292524">{alto}</text>
    </svg>
  )
}

// Ejemplo resuelto — no interactivo, con medidas distintas (5×3) a las 3 de
// la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const p: ItemPA = { numero: 0, ancho: 5, alto: 3 }

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
        <BotonEscuchar texto={`Ejemplo: terreno de 5 por 3. Perímetro: 5 más 3 es 8, por 2 es 16. Área: 5 por 3 es 15.`} tamano={32} />
      </div>

      <TerrenoSVG ancho={p.ancho} alto={p.alto} />

      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: '#1e3a8a', margin: '0.5rem 0 0.6rem' }}>{p.ancho} × {p.alto}</p>

      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <span style={{ padding: '0.4rem 0.8rem', borderRadius: 10, border: '2px solid #22c55e', background: '#dcfce7', color: '#16a34a', fontWeight: 800 }}>
          P = {perimetro(p)} bloques
        </span>
        <span style={{ padding: '0.4rem 0.8rem', borderRadius: 10, border: '2px solid #22c55e', background: '#dcfce7', color: '#16a34a', fontWeight: 800 }}>
          A = {area(p)} bloques²
        </span>
      </div>
      <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85 }}>
        Perímetro: sumo los 4 lados: (5 + 3) × 2 = 16. Área: multiplico ancho por alto: 5 × 3 = 15.
      </p>
    </div>
  )
}

function TarjetaPerimetroArea({ p, estado, color, onCambiarP, onCambiarA, onComprobar, onExplicarEstado }: {
  p: ItemPA
  estado: EstadoPA
  color: string
  onCambiarP: (valor: string) => void
  onCambiarA: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const faltan = estado.p.trim() === '' || estado.a.trim() === ''

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#292524' }}>{p.ancho} × {p.alto}</span>
        <BotonEscuchar texto={`Calculá el perímetro y el área de este terreno de ${p.ancho} por ${p.alto}.`} tamano={32} />
      </div>

      <TerrenoSVG ancho={p.ancho} alto={p.alto} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.7rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#292524' }}>P =</span>
          <input
            type="number" inputMode="numeric" value={estado.p} disabled={estado.evaluado}
            onChange={e => onCambiarP(e.target.value)} onKeyDown={handleKeyDown} placeholder="?"
            style={{
              width: 56, padding: '0.35rem', borderRadius: 8, border: `2px solid ${bordeColor}55`,
              background: '#f5f5f4', color: '#292524', fontSize: '1.05rem', fontWeight: 700, textAlign: 'center',
            }}
          />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#292524' }}>bloques</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: '#292524' }}>A =</span>
          <input
            type="number" inputMode="numeric" value={estado.a} disabled={estado.evaluado}
            onChange={e => onCambiarA(e.target.value)} onKeyDown={handleKeyDown} placeholder="?"
            style={{
              width: 56, padding: '0.35rem', borderRadius: 8, border: `2px solid ${bordeColor}55`,
              background: '#f5f5f4', color: '#292524', fontSize: '1.05rem', fontWeight: 700, textAlign: 'center',
            }}
          />
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#292524' }}>bloques²</span>
        </div>
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}>
          <button onClick={onComprobar} disabled={faltan} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: faltan ? 'default' : 'pointer',
            background: faltan ? '#e2e8f0' : '#22c55e',
            boxShadow: faltan ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: faltan ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era P=${perimetro(p)}, A=${area(p)}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Perímetro: sumo los 4 lados: (${p.ancho} + ${p.alto}) × 2 = ${perimetro(p)}. Área: multiplico ancho por alto: ${p.ancho} × ${p.alto} = ${area(p)}.`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaComparacion({ estado, onCambiarArea, onCambiarValla, onComprobar, onExplicarEstado }: {
  estado: EstadoCompara
  onCambiarArea: (valor: string) => void
  onCambiarValla: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#0ea5e9'
  const faltan = estado.area.trim() === '' || estado.valla.trim() === ''

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: '#0ea5e9', color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          4
        </span>
        <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0, color: '#292524' }}>Comparación</p>
        <BotonEscuchar texto="Un terreno de 4 por 6 y otro de 8 por 3, los dos tienen área 24. ¿Cuál tiene más área? ¿Cuál necesita más valla?" tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <div style={{ textAlign: 'center' }}>
          <TerrenoSVG ancho={COMPARA_A.ancho} alto={COMPARA_A.alto} />
          <p style={{ fontWeight: 700, margin: '0.3rem 0 0', color: '#292524' }}>{COMPARA_A.ancho} × {COMPARA_A.alto}</p>
          <p style={{ fontSize: '0.85rem', margin: 0, color: '#0ea5e9', fontWeight: 800 }}>Área = {area({ numero: 0, ...COMPARA_A })} bloques²</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <TerrenoSVG ancho={COMPARA_B.ancho} alto={COMPARA_B.alto} />
          <p style={{ fontWeight: 700, margin: '0.3rem 0 0', color: '#292524' }}>{COMPARA_B.ancho} × {COMPARA_B.alto}</p>
          <p style={{ fontSize: '0.85rem', margin: 0, color: '#0ea5e9', fontWeight: 800 }}>Área = {area({ numero: 0, ...COMPARA_B })} bloques²</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#292524' }}>¿Cuál tiene más área?</span>
          <input value={estado.area} disabled={estado.evaluado} onChange={e => onCambiarArea(e.target.value)} onKeyDown={handleKeyDown}
            style={{ width: 120, padding: '0.35rem 0.5rem', borderRadius: 8, border: '2px solid #bae6fd', background: '#f0f9ff', color: '#292524', fontWeight: 700, textAlign: 'center' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#292524' }}>¿Cuál necesita más valla (mayor perímetro)?</span>
          <input value={estado.valla} disabled={estado.evaluado} onChange={e => onCambiarValla(e.target.value)} onKeyDown={handleKeyDown}
            style={{ width: 120, padding: '0.35rem 0.5rem', borderRadius: 8, border: '2px solid #bae6fd', background: '#f0f9ff', color: '#292524', fontWeight: 700, textAlign: 'center' }} />
        </div>
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}>
          <button onClick={onComprobar} disabled={faltan} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: faltan ? 'default' : 'pointer',
            background: faltan ? '#e2e8f0' : '#22c55e',
            boxShadow: faltan ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: faltan ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ Eran iguales en área — y el de 8 × 3 necesita más valla'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Las dos áreas son iguales: 24 bloques². Pero los perímetros son distintos: (4+6)×2 = 20 para el primero, (8+3)×2 = 22 para el segundo — el de 8×3 necesita más valla.`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function FilaCompleta({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaCompleta
  estado: EstadoSimple
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#d6d3d1'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fafaf9',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#292524' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 130, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #d6d3d1',
          background: 'white', color: '#292524', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#292524' }}>{p.despues}</span>
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
