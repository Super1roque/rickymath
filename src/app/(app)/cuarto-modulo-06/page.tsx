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

// ── Datos de la actividad (basados en la hoja "Actividad 6 - Decimales").
// Dos inconsistencias de la hoja original, confirmadas a mano con el
// usuario: el ítem 2 trae la palabra "tres coma setenta y cinco" impresa,
// pero la flecha está justo en la marca 3,5 de una escala que solo marca
// cada 0,5 — se usa 3,5 (manda la flecha). El ítem 5 pide ubicar el 2,8
// pero en la recta impresa el número resaltado es el 2,9 — es una trampa a
// propósito, no un error: el chico tiene que elegir el 2,8 real.

type Signo = '>' | '<' | '='

interface ItemLectura {
  numero: number
  valor: number
  palabras: string
  color: string
}

const LECTURAS: ItemLectura[] = [
  { numero: 1, valor: 2.5, palabras: 'dos coma cinco', color: '#f97316' },
  { numero: 2, valor: 3.5, palabras: 'tres coma cinco', color: '#2563eb' },
]

interface ItemComparar {
  numero: number
  a: string; b: string
  correcta: Signo
  color: string
}

const COMPARAR: ItemComparar[] = [
  { numero: 3, a: '1,2', b: '1,05', correcta: '>', color: '#22c55e' },
  { numero: 4, a: '4,60', b: '4,6', correcta: '=', color: '#dc2626' },
]

const OPCIONES_RECTA = [2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3]
const RECTA_CORRECTA = 2.8

const SUMA = { a: 1.5, b: 2.3 }

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
    numero: 1, antes: 'La primera cifra después de la coma son los', despues: '.',
    aceptables: ['decimos'],
    lectura: 'La primera cifra después de la coma, ¿cómo se llama?',
    explicacion: 'La primera cifra después de la coma representa los décimos — la segunda son los centésimos.',
  },
  {
    numero: 2, antes: '4,60 y 4,6 son', despues: '(iguales / distintos).',
    aceptables: ['iguales'],
    lectura: '4,60 y 4,6, ¿son iguales o distintos?',
    explicacion: 'El cero al final de un decimal no cambia su valor — 4,60 y 4,6 son exactamente el mismo número.',
  },
  {
    numero: 3, antes: '1,5 + 2,3 =', despues: '.',
    aceptables: ['3,8', '3.8'],
    lectura: '¿Uno coma cinco más dos coma tres?',
    explicacion: 'Sumo los enteros: 1 + 2 = 3. Sumo los decimales: 5 + 3 = 8. El resultado es 3,8.',
  },
]

const TOTAL_PREGUNTAS = LECTURAS.length + COMPARAR.length + 1 + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoSimple { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoComparar { seleccion: string; evaluado: boolean; correcto: boolean }
interface EstadoRecta { seleccion: number | null; evaluado: boolean; correcto: boolean }

export default function CuartoModulo06() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [lecturas, setLecturas] = useState<Record<number, EstadoSimple>>(() =>
    Object.fromEntries(LECTURAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const [comparar, setComparar] = useState<Record<number, EstadoComparar>>(() =>
    Object.fromEntries(COMPARAR.map(p => [p.numero, { seleccion: '', evaluado: false, correcto: false }])),
  )
  const [recta, setRecta] = useState<EstadoRecta>({ seleccion: null, evaluado: false, correcto: false })
  const [suma, setSuma] = useState<EstadoSimple>({ valor: '', evaluado: false, correcto: false })
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
    const a = Object.values(lecturas).filter(e => e.evaluado && e.correcto).length
    const b = Object.values(comparar).filter(e => e.evaluado && e.correcto).length
    const c = recta.evaluado && recta.correcto ? 1 : 0
    const d = suma.evaluado && suma.correcto ? 1 : 0
    const e = Object.values(completa).filter(x => x.evaluado && x.correcto).length
    return a + b + c + d + e
  }, [lecturas, comparar, recta, suma, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(lecturas).filter(e => e.evaluado).length
    const b = Object.values(comparar).filter(e => e.evaluado).length
    const c = recta.evaluado ? 1 : 0
    const d = suma.evaluado ? 1 : 0
    const e = Object.values(completa).filter(x => x.evaluado).length
    return a + b + c + d + e
  }, [lecturas, comparar, recta, suma, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'cuarto-modulo-06', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarLectura(p: ItemLectura) {
    const actual = lecturas[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = normalizarTexto(actual.valor) === normalizarTexto(p.palabras)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setLecturas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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

  function elegirRecta(valor: number) {
    if (recta.evaluado) return
    const correcto = valor === RECTA_CORRECTA
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setRecta({ seleccion: valor, evaluado: true, correcto })
  }

  function comprobarSuma() {
    if (suma.evaluado || suma.valor.trim() === '') return
    const valor = normalizarTexto(suma.valor).replace(',', '.')
    const correcto = Number(valor) === SUMA.a + SUMA.b
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setSuma(prev => ({ ...prev, evaluado: true, correcto }))
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
    setLecturas(Object.fromEntries(LECTURAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
    setComparar(Object.fromEntries(COMPARAR.map(p => [p.numero, { seleccion: '', evaluado: false, correcto: false }])))
    setRecta({ seleccion: null, evaluado: false, correcto: false })
    setSuma({ valor: '', evaluado: false, correcto: false })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #0369a1 0%, #7dd3fc 35%, #ecfeff 100%)',
      color: '#0c4a6e', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #0369a1, #075985)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #0c4a6e', borderBottom: '4px solid #0c4a6e',
      }}>
        <BotonMenu href="/cuarto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🐬📏</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #0c4a6e', margin: 0, color: 'white',
        }}>
          ¡Decimales!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          El delfín mide la profundidad — leé y comparó los decimales
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#0369a1" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {LECTURAS.map(p => (
            <TarjetaLectura key={p.numero} p={p} estado={lecturas[p.numero]}
              onCambiar={valor => setLecturas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarLectura(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {COMPARAR.map(p => (
            <TarjetaComparar key={p.numero} p={p} estado={comparar[p.numero]}
              onElegir={opcion => elegirComparar(p, opcion)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          <TarjetaRecta estado={recta} onElegir={elegirRecta} onExplicarEstado={reaccionarRickyExplicar} />
          <TarjetaSuma estado={suma} onCambiar={valor => setSuma(prev => ({ ...prev, valor }))}
            onComprobar={comprobarSuma} onExplicarEstado={reaccionarRickyExplicar} />
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
                ? '¡Perfecto! Dominás los decimales 🎮'
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

function formatoDecimal(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

// Regla vertical del delfín — de 0,0 arriba a 5,0 abajo, con una flecha de
// color marcando la profundidad.
function Regla({ valor, color }: { valor: number; color: string }) {
  const marcas = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '2px solid #0369a1', borderRadius: 8, overflow: 'hidden', width: 72, flexShrink: 0 }}>
      {marcas.map((m, i) => (
        <div key={m} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', padding: '0.18rem 0',
          background: m === valor ? `${color}22` : 'white',
          borderBottom: i < marcas.length - 1 ? '1px solid #e0f2fe' : 'none',
          fontSize: '0.7rem', fontWeight: 700, color: '#0c4a6e',
        }}>
          {m === valor && <span style={{ color, fontSize: '0.8rem' }}>◀</span>}
          {formatoDecimal(m)}
        </div>
      ))}
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con una profundidad distinta (1,5) a
// las 2 de la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const valor = 1.5
  const palabras = 'uno coma cinco'

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
        <BotonEscuchar texto={`Ejemplo: la profundidad del delfín es uno coma cinco.`} tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Regla valor={valor} color={color} />
        <div>
          <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e3a8a', margin: '0 0 0.4rem' }}>Lee la profundidad y escribila con letras:</p>
          <p style={{
            padding: '0.5rem 0.8rem', borderRadius: 10, border: '2px solid #22c55e', background: '#dcfce7',
            color: '#16a34a', fontWeight: 800, fontSize: '1.05rem', margin: 0, display: 'inline-block',
          }}>
            {palabras}
          </p>
        </div>
      </div>
    </div>
  )
}

function TarjetaLectura({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemLectura
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
        <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#0c4a6e' }}>Lee la profundidad</p>
        <BotonEscuchar texto="Lee la profundidad del delfín y escribila con letras." tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <Regla valor={p.valor} color={p.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={estado.valor}
            disabled={estado.evaluado}
            onChange={e => onCambiar(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí con letras"
            style={{
              width: '100%', padding: '0.5rem 0.6rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
              background: '#f0f9ff', color: '#0c4a6e', fontSize: '0.95rem', fontWeight: 600,
            }}
          />
          {!estado.evaluado && (
            <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
              marginTop: '0.5rem', width: '100%', padding: '0.5rem', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
              boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
              color: 'white', fontWeight: 800, fontSize: '0.95rem',
              opacity: estado.valor.trim() === '' ? 0.7 : 1,
            }}>
              ✓ Comprobar
            </button>
          )}
        </div>
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era "${p.palabras}"`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`La flecha marca la profundidad ${formatoDecimal(p.valor)} — se lee "${p.palabras}".`} onEstadoCambia={onExplicarEstado} />
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
        <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#0c4a6e' }}>Comparar decimales</p>
        <BotonEscuchar texto={`¿${p.a} es mayor, menor, o igual a ${p.b}?`} tamano={32} />
      </div>

      <p style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 800, color: '#0c4a6e', margin: '0 0 0.7rem' }}>
        {p.a} <span style={{ opacity: 0.4, fontSize: '1.1rem' }}>?</span> {p.b}
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
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
              width: 54, height: 46, borderRadius: 10, border: `2px solid ${borde}`,
              background: bg, color: textColor, fontWeight: 800, fontSize: '1.4rem',
              cursor: estado.evaluado ? 'default' : 'pointer',
            }}>
              {o}
            </button>
          )
        })}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.correcta}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={
              p.correcta === '='
                ? `Un cero al final de un decimal no cambia su valor: ${p.a} y ${p.b} son iguales.`
                : `Comparo cifra por cifra: ${p.a} ${p.correcta} ${p.b}.`
            } onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaRecta({ estado, onElegir, onExplicarEstado }: {
  estado: EstadoRecta
  onElegir: (valor: number) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#7c3aed'

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
          width: 30, height: 30, borderRadius: 999, background: '#7c3aed', color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          5
        </span>
        <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#0c4a6e' }}>Ubica 2,8 en la recta numérica</p>
        <BotonEscuchar texto="Ubicá el dos coma ocho en la recta numérica." tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {OPCIONES_RECTA.map(v => {
          const esElegida = estado.seleccion === v
          const esLaCorrecta = estado.evaluado && v === RECTA_CORRECTA
          let bg = '#faf5ff', borde = '#e9d5ff', textColor = '#0c4a6e'
          if (estado.evaluado) {
            if (esElegida && estado.correcto) { bg = '#dcfce7'; borde = '#22c55e'; textColor = '#16a34a' }
            else if (esElegida && !estado.correcto) { bg = '#fee2e2'; borde = '#ef4444'; textColor = '#dc2626' }
            else if (esLaCorrecta) { bg = '#dcfce7'; borde = '#86efac'; textColor = '#16a34a' }
          }
          return (
            <button key={v} onClick={() => onElegir(v)} disabled={estado.evaluado} style={{
              width: 44, height: 40, borderRadius: 8, border: `2px solid ${borde}`,
              background: bg, color: textColor, fontWeight: 800, fontSize: '0.8rem',
              cursor: estado.evaluado ? 'default' : 'pointer',
            }}>
              {formatoDecimal(v)}
            </button>
          )
        })}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ Era 2,8'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto="El 2,8 está entre el 2,7 y el 2,9, un paso antes del 2,9 — ojo con confundirlo con el vecino." onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaSuma({ estado, onCambiar, onComprobar, onExplicarEstado }: {
  estado: EstadoSimple
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#0891b2'

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
          width: 30, height: 30, borderRadius: 999, background: '#0891b2', color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          6
        </span>
        <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: '#0c4a6e' }}>Sumá las profundidades</p>
        <BotonEscuchar texto="¿Uno coma cinco más dos coma tres?" tamano={32} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0c4a6e' }}>{formatoDecimal(SUMA.a)} + {formatoDecimal(SUMA.b)} =</span>
        <input
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 64, padding: '0.4rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
            background: '#f0f9ff', color: '#0c4a6e', fontSize: '1.15rem', fontWeight: 700, textAlign: 'center',
          }}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.5rem 0.7rem', borderRadius: 10, border: 'none', cursor: 'pointer',
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
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${formatoDecimal(SUMA.a + SUMA.b)}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Sumo los enteros: 1 + 2 = 3. Sumo los decimales: 5 + 3 = 8. El resultado es ${formatoDecimal(SUMA.a + SUMA.b)}.`} onEstadoCambia={onExplicarEstado} />
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
