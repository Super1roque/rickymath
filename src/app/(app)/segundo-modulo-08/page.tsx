'use client'

import { useEffect, useMemo, useState, useRef, type KeyboardEvent } from 'react'
import { reproducirCorrecto, reproducirIncorrecto, reproducirFanfarria, normalizarTexto } from '@/lib/guiaAudio'
import { fuenteJuego } from '@/lib/fuenteJuego'
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

// ── Datos de la actividad (basados en la hoja "Actividad 8 - Peso y
// Capacidad"). Lecturas visuales confirmadas a mano por el usuario:
// ítem 2 = bloque de nieve (liviano) vs oro, gana el oro; ítem 3 = los 3
// calderos van en orden 1,2,3 de izquierda a derecha (menos a más agua);
// ítem 4 = 6 baldes dibujados; ítem 6 = pociones ya en orden morada, rosa,
// azul, verde de más llena a más vacía (sin necesidad de reordenar).

interface OpcionPeso {
  clave: string
  emoji: string
  etiqueta: string
}

interface PreguntaComparar {
  numero: number
  contexto: string
  opciones: [OpcionPeso, OpcionPeso]
  correcta: string
  explicacion: string
}

const COMPARAR: PreguntaComparar[] = [
  {
    numero: 1, contexto: '¿Qué objeto es más pesado?',
    opciones: [{ clave: 'yunque', emoji: '🗿', etiqueta: 'Yunque' }, { clave: 'pluma', emoji: '🪶', etiqueta: 'Pluma' }],
    correcta: 'yunque',
    explicacion: 'El yunque es un bloque de hierro sólido y pesado. La pluma es tan liviana que flota en el aire. El yunque pesa más.',
  },
  {
    numero: 2, contexto: '¿Qué objeto es más pesado?',
    opciones: [{ clave: 'oro', emoji: '🪙', etiqueta: 'Oro' }, { clave: 'nieve', emoji: '❄️', etiqueta: 'Nieve' }],
    correcta: 'oro',
    explicacion: 'El oro es un metal denso y pesado. La nieve es liviana y esponjosa. El oro pesa más.',
  },
]

interface SlotNumerar {
  nivel: number
  color?: string
  correcta: string
}

interface PreguntaNumerar {
  numero: number
  tipo: 'caldero' | 'pocion'
  instruccion: string
  slots: SlotNumerar[]
  explicacion: string
}

const NUMERAR: PreguntaNumerar[] = [
  {
    numero: 3, tipo: 'caldero',
    instruccion: 'Numera los calderos del 1 al 3 según la cantidad de agua (de menor a mayor).',
    slots: [{ nivel: 0.28, correcta: '1' }, { nivel: 0.6, correcta: '2' }, { nivel: 0.95, correcta: '3' }],
    explicacion: 'El caldero con menos agua es el 1, el del medio es el 2, y el que está casi lleno es el 3.',
  },
  {
    numero: 6, tipo: 'pocion',
    instruccion: 'Ordena las pociones de la más llena (1) a la más vacía (4).',
    slots: [
      { nivel: 0.92, color: '#a855f7', correcta: '1' },
      { nivel: 0.64, color: '#ec4899', correcta: '2' },
      { nivel: 0.36, color: '#38bdf8', correcta: '3' },
      { nivel: 0.14, color: '#22c55e', correcta: '4' },
    ],
    explicacion: 'La poción morada está casi llena (1), le sigue la rosa (2), después la azul (3), y la verde es la más vacía (4).',
  },
]

interface PreguntaNumero {
  numero: number
  contexto: string
  correcta: number
  unidad: string
  visual: 'baldes' | 'balanza'
  explicacion: string
}

const NUMEROS: PreguntaNumero[] = [
  {
    numero: 4, contexto: '¿Cuántos cubos de agua se necesitan para llenar el caldero?', correcta: 6, unidad: 'balde',
    visual: 'baldes',
    explicacion: 'Contamos los baldes de agua dibujados junto al caldero: hay 6. Se necesitan 6 cubos de agua para llenarlo.',
  },
  {
    numero: 5, contexto: 'Si 2 hierros pesan lo mismo que cierta cantidad de tierra, ¿cuántas tierras son?', correcta: 1, unidad: 'tierra',
    visual: 'balanza',
    explicacion: 'La balanza está equilibrada: 2 hierros pesan exactamente lo mismo que 1 bloque de tierra.',
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
    numero: 1, antes: 'El objeto más pesado hace bajar el', despues: 'de la balanza.',
    aceptables: ['platillo', 'plato', 'lado'],
    lectura: 'El objeto más pesado hace bajar el... ¿qué de la balanza?',
    explicacion: 'La balanza se inclina: el lado con el objeto más pesado siempre baja — ese es el platillo.',
  },
  {
    numero: 2, antes: 'La capacidad se mide en', despues: '(litros / metros).',
    aceptables: ['litros'],
    lectura: 'La capacidad se mide en litros o en metros, ¿cuál es?',
    explicacion: 'La capacidad (cuánto líquido cabe) se mide en litros, no en metros — los metros miden longitud.',
  },
  {
    numero: 3, antes: 'Si los dos platos quedan igual, el peso es', despues: '.',
    aceptables: ['igual'],
    lectura: 'Si los dos platos de la balanza quedan a la misma altura, ¿cómo es el peso?',
    explicacion: 'Cuando la balanza queda nivelada (ningún lado baja), significa que ambos pesos son iguales.',
  },
]

const TOTAL_PREGUNTAS = COMPARAR.length + NUMERAR.length + NUMEROS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoComparar { seleccion: string; evaluado: boolean; correcto: boolean }
interface EstadoNumerar { valores: string[]; evaluado: boolean; correcto: boolean }
interface EstadoSimple { valor: string; evaluado: boolean; correcto: boolean }

export default function SegundoModulo08() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [comparar, setComparar] = useState<Record<number, EstadoComparar>>(() =>
    Object.fromEntries(COMPARAR.map(p => [p.numero, { seleccion: '', evaluado: false, correcto: false }])),
  )
  const [numerar, setNumerar] = useState<Record<number, EstadoNumerar>>(() =>
    Object.fromEntries(NUMERAR.map(p => [p.numero, { valores: p.slots.map(() => ''), evaluado: false, correcto: false }])),
  )
  const [numeros, setNumeros] = useState<Record<number, EstadoSimple>>(() =>
    Object.fromEntries(NUMEROS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
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
    const a = Object.values(comparar).filter(e => e.evaluado && e.correcto).length
    const b = Object.values(numerar).filter(e => e.evaluado && e.correcto).length
    const c = Object.values(numeros).filter(e => e.evaluado && e.correcto).length
    const d = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return a + b + c + d
  }, [comparar, numerar, numeros, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(comparar).filter(e => e.evaluado).length
    const b = Object.values(numerar).filter(e => e.evaluado).length
    const c = Object.values(numeros).filter(e => e.evaluado).length
    const d = Object.values(completa).filter(e => e.evaluado).length
    return a + b + c + d
  }, [comparar, numerar, numeros, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'segundo-modulo-08', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function elegirComparar(p: PreguntaComparar, opcion: string) {
    const actual = comparar[p.numero]
    if (actual.evaluado) return
    const correcto = opcion === p.correcta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setComparar(prev => ({ ...prev, [p.numero]: { seleccion: opcion, evaluado: true, correcto } }))
  }

  function comprobarNumerar(p: PreguntaNumerar) {
    const actual = numerar[p.numero]
    if (actual.evaluado || actual.valores.some(v => v.trim() === '')) return
    const correcto = actual.valores.every((v, i) => v.trim() === p.slots[i].correcta)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setNumerar(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarNumero(p: PreguntaNumero) {
    const actual = numeros[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.correcta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setNumeros(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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
    setComparar(Object.fromEntries(COMPARAR.map(p => [p.numero, { seleccion: '', evaluado: false, correcto: false }])))
    setNumerar(Object.fromEntries(NUMERAR.map(p => [p.numero, { valores: p.slots.map(() => ''), evaluado: false, correcto: false }])))
    setNumeros(Object.fromEntries(NUMEROS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #2dd4bf 0%, #99f6e4 35%, #fef9c3 100%)',
      color: '#134e4a', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #0d9488, #115e59)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #134e4a', borderBottom: '4px solid #134e4a',
      }}>
        <BotonMenu href="/segundo-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>⚖️🪣</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #134e4a', margin: 0, color: 'white',
        }}>
          ¡Peso y capacidad!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Compará pesos en la balanza y ordená los niveles de líquido
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#0d9488" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {COMPARAR.map(p => (
            <TarjetaComparar key={p.numero} p={p} estado={comparar[p.numero]}
              onElegir={opcion => elegirComparar(p, opcion)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {NUMERAR.map(p => (
            <TarjetaNumerar key={p.numero} p={p} estado={numerar[p.numero]}
              onCambiar={(i, valor) => setNumerar(prev => {
                const valores = [...prev[p.numero].valores]
                valores[i] = valor
                return { ...prev, [p.numero]: { ...prev[p.numero], valores } }
              })}
              onComprobar={() => comprobarNumerar(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {NUMEROS.map(p => (
            <TarjetaNumero key={p.numero} p={p} estado={numeros[p.numero]}
              onCambiar={valor => setNumeros(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarNumero(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #5eead4', boxShadow: '0 4px 0 rgba(19,78,74,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#134e4a' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(19,78,74,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#134e4a' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f766e' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Ya sabés de peso y capacidad 🎮'
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
        {tenantData?.plan !== 'premium' && <CandadoPremium />}
      </div>
    </div>
  )
}

// ── Visuales de nivel de líquido — caldero (recipiente de hierro, ancho y
// bajo) y poción (frasco angosto con cuello) comparten la misma idea:
// borde grueso + relleno de color que sube desde abajo según `nivel`. ──

function CalderoVisual({ nivel }: { nivel: number }) {
  return (
    <div style={{
      width: 46, height: 42, borderRadius: '6px 6px 16px 16px', border: '3px solid #1f2937',
      background: '#4b5563', position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${nivel * 100}%`, background: '#3b82f6' }} />
    </div>
  )
}

function VisualBaldes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
      <CalderoVisual nivel={0} />
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.1rem', fontSize: '1.5rem', maxWidth: 170 }}>
        {Array.from({ length: 6 }, (_, i) => <span key={i}>🪣</span>)}
      </div>
    </div>
  )
}

function VisualBalanza({ cantidadTierra }: { cantidadTierra: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.9rem', marginBottom: '0.8rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
        <span style={{ fontSize: '1.7rem' }}>⬜⬜</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#134e4a', opacity: 0.75 }}>2 hierros</span>
      </div>
      <span style={{ fontSize: '1.6rem', marginBottom: '0.9rem' }}>⚖️</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
        <span style={{ fontSize: '1.7rem' }}>{'🟫'.repeat(cantidadTierra)}</span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#134e4a', opacity: 0.75 }}>tierra(s)</span>
      </div>
    </div>
  )
}

function PocionVisual({ nivel, color }: { nivel: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div style={{ width: 12, height: 9, background: '#92400e', borderRadius: '3px 3px 0 0' }} />
      <div style={{
        width: 32, height: 44, borderRadius: '8px 8px 16px 16px', border: '3px solid #94a3b8',
        background: '#f1f5f9', position: 'relative', overflow: 'hidden', marginTop: -1,
      }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${nivel * 100}%`, background: color }} />
      </div>
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con objetos distintos a los de la
// actividad real (piedra vs manzana) para no revelar ninguna respuesta.
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
        <BotonEscuchar texto="Ejemplo: ¿qué objeto es más pesado, la piedra o la manzana? La piedra es un bloque sólido de mineral. La manzana es liviana y se puede comer de un bocado. La piedra pesa más." tamano={32} />
      </div>

      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#1e3a8a', margin: '0 0 0.6rem' }}>
        ¿Qué objeto es más pesado?
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem', borderRadius: 10, background: '#dcfce7', border: '2px solid #22c55e' }}>
          <span style={{ fontSize: '1.8rem' }}>🪨</span>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>Piedra ✅</p>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '0.5rem', borderRadius: 10, background: '#f8fafc', border: '2px solid #cbd5e1' }}>
          <span style={{ fontSize: '1.8rem' }}>🍎</span>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>Manzana</p>
        </div>
      </div>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: 0 }}>
        La piedra es un bloque sólido y pesado — la manzana es liviana. Gana la piedra.
      </p>
    </div>
  )
}

function TarjetaComparar({ p, estado, onElegir, onExplicarEstado }: {
  p: PreguntaComparar
  estado: EstadoComparar
  onElegir: (opcion: string) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#0d9488'

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem', gap: '0.4rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: '#0d9488', color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, flex: 1, minWidth: 0, textAlign: 'center', color: '#134e4a', overflowWrap: 'break-word' }}>
          {p.contexto}
        </p>
        <BotonEscuchar texto={`${p.contexto} ¿${p.opciones[0].etiqueta} o ${p.opciones[1].etiqueta}?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {p.opciones.map(o => {
          const esElegida = estado.seleccion === o.clave
          const esLaCorrecta = estado.evaluado && o.clave === p.correcta
          let bg = '#f0fdfa'
          let borde = '#99f6e4'
          let textColor = '#134e4a'
          if (estado.evaluado) {
            if (esElegida && estado.correcto) { bg = '#dcfce7'; borde = '#22c55e'; textColor = '#16a34a' }
            else if (esElegida && !estado.correcto) { bg = '#fee2e2'; borde = '#ef4444'; textColor = '#dc2626' }
            else if (esLaCorrecta) { bg = '#dcfce7'; borde = '#86efac'; textColor = '#16a34a' }
          }
          return (
            <button key={o.clave} onClick={() => onElegir(o.clave)} disabled={estado.evaluado} style={{
              flex: 1, minWidth: 0, padding: '0.7rem 0.4rem', borderRadius: 12, border: `2px solid ${borde}`,
              background: bg, color: textColor, fontWeight: 800, fontSize: '0.95rem',
              cursor: estado.evaluado ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
            }}>
              <span style={{ fontSize: '1.9rem' }}>{o.emoji}</span>
              {o.etiqueta}
            </button>
          )
        })}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.opciones.find(o => o.clave === p.correcta)?.etiqueta}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaNumerar({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaNumerar
  estado: EstadoNumerar
  onCambiar: (indice: number, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#0d9488'
  const faltan = estado.valores.some(v => v.trim() === '')

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem', gap: '0.4rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: '#0d9488', color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, flex: 1, minWidth: 0, textAlign: 'center', color: '#134e4a', overflowWrap: 'break-word' }}>
          {p.instruccion}
        </p>
        <BotonEscuchar texto={p.instruccion} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.7rem' }}>
        {p.slots.map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
            {p.tipo === 'caldero' ? <CalderoVisual nivel={s.nivel} /> : <PocionVisual nivel={s.nivel} color={s.color ?? '#3b82f6'} />}
            <input
              type="number"
              inputMode="numeric"
              value={estado.valores[i]}
              disabled={estado.evaluado}
              onChange={e => onCambiar(i, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 42, padding: '0.35rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
                background: '#f0fdfa', color: '#134e4a', fontSize: '1.05rem', fontWeight: 700, textAlign: 'center',
              }}
            />
          </div>
        ))}
      </div>

      {!estado.evaluado ? (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={onComprobar} disabled={faltan} style={{
            padding: '0.55rem 1.4rem', borderRadius: 12, border: 'none', cursor: faltan ? 'default' : 'pointer',
            background: faltan ? '#e2e8f0' : '#22c55e',
            boxShadow: faltan ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1rem', opacity: faltan ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      ) : (
        <>
          <p style={{ marginTop: '0.3rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.slots.map(s => s.correcta).join(', ')}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaNumero({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaNumero
  estado: EstadoSimple
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#0d9488'

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem', gap: '0.4rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: '#0d9488', color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0, flex: 1, minWidth: 0, textAlign: 'center', color: '#134e4a', overflowWrap: 'break-word' }}>
          {p.contexto}
        </p>
        <BotonEscuchar texto={p.contexto} tamano={32} />
      </div>

      {p.visual === 'baldes' ? <VisualBaldes /> : <VisualBalanza cantidadTierra={p.correcta} />}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 70, padding: '0.5rem', borderRadius: 12, border: `2px solid ${bordeColor}55`,
            background: '#f0fdfa', color: '#134e4a', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.55rem 0.9rem', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1.2rem',
            opacity: estado.valor.trim() === '' ? 0.7 : 1, flexShrink: 0,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.correcta}`}
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
  estado: EstadoSimple
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#5eead4'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0fdfa',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#134e4a' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #5eead4',
          background: 'white', color: '#134e4a', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#134e4a' }}>{p.despues}</span>
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
