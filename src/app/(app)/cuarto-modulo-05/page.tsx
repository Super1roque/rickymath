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

// ── Datos de la actividad (basados en la hoja "Actividad 5 - Fracciones").
// La hoja trae las equivalencias ya resueltas entre paréntesis (ej. "(2/4)")
// — igual que en las actividades anteriores, se convierten en una casilla
// en blanco que el chico completa.

type Signo = '>' | '<' | '='

interface ItemEquivalente {
  numero: number
  numA: number; denA: number
  denB: number; numB: number // numB es la respuesta correcta
  color: string
}

const EQUIVALENTES: ItemEquivalente[] = [
  { numero: 1, numA: 1, denA: 2, denB: 4, numB: 2, color: '#2563eb' },
  { numero: 2, numA: 2, denA: 3, denB: 6, numB: 4, color: '#f97316' },
]

interface ItemComparar {
  numero: number
  numA: number; denA: number
  numB: number; denB: number
  correcta: Signo
  color: string
}

const COMPARAR: ItemComparar[] = [
  { numero: 3, numA: 3, denA: 4, numB: 2, denB: 4, correcta: '>', color: '#0891b2' },
  { numero: 4, numA: 1, denA: 3, numB: 1, denB: 2, correcta: '<', color: '#22c55e' },
]

interface ItemSuma {
  numero: number
  numA: number; numB: number; den: number; numC: number // numC es la respuesta correcta
  color: string
}

const SUMAS: ItemSuma[] = [
  { numero: 5, numA: 2, numB: 1, den: 5, numC: 3, color: '#dc2626' },
  { numero: 6, numA: 3, numB: 4, den: 8, numC: 7, color: '#7c3aed' },
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
    numero: 1, antes: 'Dos fracciones que valen lo mismo son', despues: '.',
    aceptables: ['equivalentes'],
    lectura: 'Dos fracciones que valen lo mismo, ¿cómo se llaman?',
    explicacion: 'Dos fracciones que representan la misma cantidad, aunque se escriban distinto, se llaman fracciones equivalentes — como 1/2 y 2/4.',
  },
  {
    numero: 2, antes: 'Si el denominador es más grande, las partes son más', despues: '.',
    aceptables: ['chicas', 'pequenas', 'pequeno', 'pequenio'],
    lectura: 'Si el denominador es más grande, ¿las partes son más grandes o más chicas?',
    explicacion: 'Cuando el denominador crece, el entero se reparte en más partes — y cada parte queda más chica.',
  },
  {
    numero: 3, antes: '2/5 + 1/5 =', despues: '.',
    aceptables: ['3/5'],
    lectura: '¿Dos quintos más un quinto?',
    explicacion: 'Con el mismo denominador, sumo solo los numeradores: 2 + 1 = 3. El resultado es 3/5.',
  },
]

const TOTAL_PREGUNTAS = EQUIVALENTES.length + COMPARAR.length + SUMAS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoSimple { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoComparar { seleccion: string; evaluado: boolean; correcto: boolean }

export default function CuartoModulo05() {
  const [equivalentes, setEquivalentes] = useState<Record<number, EstadoSimple>>(() =>
    Object.fromEntries(EQUIVALENTES.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const [comparar, setComparar] = useState<Record<number, EstadoComparar>>(() =>
    Object.fromEntries(COMPARAR.map(p => [p.numero, { seleccion: '', evaluado: false, correcto: false }])),
  )
  const [sumas, setSumas] = useState<Record<number, EstadoSimple>>(() =>
    Object.fromEntries(SUMAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
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
    const a = Object.values(equivalentes).filter(e => e.evaluado && e.correcto).length
    const b = Object.values(comparar).filter(e => e.evaluado && e.correcto).length
    const c = Object.values(sumas).filter(e => e.evaluado && e.correcto).length
    const d = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return a + b + c + d
  }, [equivalentes, comparar, sumas, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(equivalentes).filter(e => e.evaluado).length
    const b = Object.values(comparar).filter(e => e.evaluado).length
    const c = Object.values(sumas).filter(e => e.evaluado).length
    const d = Object.values(completa).filter(e => e.evaluado).length
    return a + b + c + d
  }, [equivalentes, comparar, sumas, completa])

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

  function comprobarEquivalente(p: ItemEquivalente) {
    const actual = equivalentes[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.numB
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setEquivalentes(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function elegirComparar(p: ItemComparar, opcion: Signo) {
    const actual = comparar[p.numero]
    if (actual.evaluado) return
    const correcto = opcion === p.correcta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setComparar(prev => ({ ...prev, [p.numero]: { seleccion: opcion, evaluado: true, correcto } }))
  }

  function comprobarSuma(p: ItemSuma) {
    const actual = sumas[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.numC
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setSumas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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
    setEquivalentes(Object.fromEntries(EQUIVALENTES.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
    setComparar(Object.fromEntries(COMPARAR.map(p => [p.numero, { seleccion: '', evaluado: false, correcto: false }])))
    setSumas(Object.fromEntries(SUMAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #38bdf8 0%, #bae6fd 35%, #f0f9ff 100%)',
      color: '#0c4a6e', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #0284c7, #0369a1)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #0c4a6e', borderBottom: '4px solid #0c4a6e',
      }}>
        <BotonMenu href="/cuarto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🥛➗</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #0c4a6e', margin: 0, color: 'white',
        }}>
          ¡Fracciones!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Comparó, simplificá y sumá fracciones con los cubos de leche
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#0284c7" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {EQUIVALENTES.map(p => (
            <TarjetaEquivalente key={p.numero} p={p} estado={equivalentes[p.numero]}
              onCambiar={valor => setEquivalentes(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarEquivalente(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {COMPARAR.map(p => (
            <TarjetaComparar key={p.numero} p={p} estado={comparar[p.numero]}
              onElegir={opcion => elegirComparar(p, opcion)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {SUMAS.map(p => (
            <TarjetaSuma key={p.numero} p={p} estado={sumas[p.numero]}
              onCambiar={valor => setSumas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarSuma(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #7dd3fc', boxShadow: '0 4px 0 rgba(12,74,110,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0c4a6e' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(12,74,110,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#0c4a6e' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0369a1' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás las fracciones 🎮'
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

// Cubo de leche — recipiente dividido en `denominador` franjas horizontales,
// con las últimas `numerador` franjas (desde abajo) llenas de leche celeste
// — la leche se junta abajo del vaso, como un líquido real, con el vacío
// arriba.
function VasoLeche({ numerador, denominador, ancho = 60, alto = 88 }: {
  numerador: number; denominador: number; ancho?: number; alto?: number
}) {
  const segAltura = alto / denominador
  return (
    <div style={{
      width: ancho, height: alto, border: '3px solid #0369a1', borderRadius: 6,
      position: 'relative', overflow: 'hidden', background: '#fefce8', flexShrink: 0,
    }}>
      {Array.from({ length: denominador }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', top: i * segAltura, left: 0, right: 0, height: segAltura,
          background: i >= denominador - numerador ? '#7dd3fc' : '#fefce8',
          borderBottom: i < denominador - 1 ? '2px dashed #0369a166' : 'none',
        }} />
      ))}
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con una fracción distinta (1/4 = ?/8)
// a los 6 ítems de la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const numA = 1, denA = 4, denB = 8, numB = 2

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
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>Equivalentes</p>
        <BotonEscuchar texto={`Ejemplo: un cuarto es igual a cuántos octavos. Un cuarto es igual a dos octavos: ${numA}/${denA} = ${numB}/${denB}.`} tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7rem', marginBottom: '0.7rem' }}>
        <VasoLeche numerador={numA} denominador={denA} />
        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e3a8a' }}>=</span>
        <VasoLeche numerador={numB} denominador={denB} />
      </div>

      <p style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.4rem', color: '#1e3a8a', margin: '0 0 0.4rem' }}>
        {numA}/{denA} = {numB}/{denB}
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: 0 }}>
        Los dos cubos tienen la misma cantidad de leche, aunque estén repartidos en distinta cantidad de franjas — por eso son fracciones equivalentes.
      </p>
    </div>
  )
}

function TarjetaEquivalente({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemEquivalente
  estado: EstadoSimple
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : p.color

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: p.color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0, color: '#0c4a6e' }}>Equivalentes</p>
        <BotonEscuchar texto={`¿${p.numA} sobre ${p.denA} es igual a cuántos sobre ${p.denB}?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7rem', marginBottom: '0.7rem' }}>
        <VasoLeche numerador={p.numA} denominador={p.denA} />
        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0c4a6e' }}>=</span>
        <VasoLeche numerador={p.numB} denominador={p.denB} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0c4a6e' }}>{p.numA}/{p.denA} =</span>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 56, padding: '0.4rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
            background: '#f0f9ff', color: '#0c4a6e', fontSize: '1.2rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0c4a6e' }}>/{p.denB}</span>
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            marginLeft: '0.3rem', padding: '0.5rem 0.7rem', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1.1rem',
            opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.numB}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`${p.numA}/${p.denA} es lo mismo que ${p.numB}/${p.denB} — el mismo cubo lleno hasta la misma altura, repartido en distinta cantidad de franjas.`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaComparar({ p, estado, onElegir, onExplicarEstado }: {
  p: ItemComparar
  estado: EstadoComparar
  onElegir: (opcion: Signo) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : p.color
  const OPCIONES: Signo[] = ['>', '<', '=']

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
          width: 30, height: 30, borderRadius: 999, background: p.color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0, color: '#0c4a6e' }}>Comparar</p>
        <BotonEscuchar texto={`¿${p.numA} sobre ${p.denA} es mayor, menor, o igual a ${p.numB} sobre ${p.denB}?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.7rem', marginBottom: '0.5rem' }}>
        <div style={{ textAlign: 'center' }}>
          <VasoLeche numerador={p.numA} denominador={p.denA} />
          <p style={{ margin: '0.3rem 0 0', fontWeight: 800, color: '#0c4a6e' }}>{p.numA}/{p.denA}</p>
        </div>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0c4a6e' }}>vs</span>
        <div style={{ textAlign: 'center' }}>
          <VasoLeche numerador={p.numB} denominador={p.denB} />
          <p style={{ margin: '0.3rem 0 0', fontWeight: 800, color: '#0c4a6e' }}>{p.numB}/{p.denB}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
        {OPCIONES.map(o => {
          const esElegida = estado.seleccion === o
          const esLaCorrecta = estado.evaluado && o === p.correcta
          let bg = '#f0f9ff', borde = '#bae6fd', textColor = '#0c4a6e'
          if (estado.evaluado) {
            if (esElegida && estado.correcto) { bg = '#dcfce7'; borde = '#22c55e'; textColor = '#16a34a' }
            else if (esElegida && !estado.correcto) { bg = '#fee2e2'; borde = '#ef4444'; textColor = '#dc2626' }
            else if (esLaCorrecta) { bg = '#dcfce7'; borde = '#86efac'; textColor = '#16a34a' }
          }
          return (
            <button key={o} onClick={() => onElegir(o)} disabled={estado.evaluado} style={{
              width: 52, height: 44, borderRadius: 10, border: `2px solid ${borde}`,
              background: bg, color: textColor, fontWeight: 800, fontSize: '1.3rem',
              cursor: estado.evaluado ? 'default' : 'pointer',
            }}>
              {o}
            </button>
          )
        })}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.correcta}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={
              p.denA === p.denB
                ? `Con el mismo denominador, comparo los numeradores: ${p.numA} ${p.correcta} ${p.numB}.`
                : `Con el mismo numerador, la fracción con denominador más chico es más grande — las partes son más grandes. Por eso ${p.numA}/${p.denA} ${p.correcta} ${p.numB}/${p.denB}.`
            } onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaSuma({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemSuma
  estado: EstadoSimple
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : p.color

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: p.color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0, color: '#0c4a6e' }}>Sumar igual denominador</p>
        <BotonEscuchar texto={`¿${p.numA} sobre ${p.den} más ${p.numB} sobre ${p.den}?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <VasoLeche numerador={p.numA} denominador={p.den} ancho={50} />
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c4a6e' }}>+</span>
        <VasoLeche numerador={p.numB} denominador={p.den} ancho={50} />
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c4a6e' }}>=</span>
        <VasoLeche numerador={p.numC} denominador={p.den} ancho={50} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c4a6e' }}>{p.numA}/{p.den} + {p.numB}/{p.den} =</span>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 52, padding: '0.4rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
            background: '#f0f9ff', color: '#0c4a6e', fontSize: '1.15rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0c4a6e' }}>/{p.den}</span>
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            marginLeft: '0.3rem', padding: '0.5rem 0.7rem', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1.1rem',
            opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.numC}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Con el mismo denominador, sumo solo los numeradores: ${p.numA} + ${p.numB} = ${p.numC}. El resultado es ${p.numC}/${p.den}.`} onEstadoCambia={onExplicarEstado} />
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#7dd3fc'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0f9ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#0c4a6e' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 110, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #7dd3fc',
          background: 'white', color: '#0c4a6e', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0c4a6e' }}>{p.despues}</span>
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
