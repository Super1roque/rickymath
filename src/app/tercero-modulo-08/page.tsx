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

// ── Datos de la actividad (basados en la hoja "Actividad 8 - Medidas") ──
// Dos tipos de pregunta en la misma hoja: equivalencia numérica (1 y 3 y 5)
// y elegir la unidad correcta entre 2 o 3 opciones (2, 4 y 6).

interface PreguntaEquivalencia {
  numero: number
  tipo: 'equivalencia'
  emoji: string
  contexto: string
  antesIgual: string
  unidadDespues: string
  respuesta: number
  lectura: string
  explicacion: string
}

interface PreguntaUnidad {
  numero: number
  tipo: 'unidad'
  emoji: string
  contexto: string
  pregunta: string
  opciones: string[]
  correcta: string
  lectura: string
  explicacion: string
}

type PreguntaMedida = PreguntaEquivalencia | PreguntaUnidad

const PREGUNTAS: PreguntaMedida[] = [
  {
    numero: 1, tipo: 'equivalencia', emoji: '🧍', contexto: 'Altura de Steve (≈ 2 bloques)',
    antesIgual: '1 m =', unidadDespues: 'cm', respuesta: 100,
    lectura: '¿Cuántos centímetros tiene un metro?',
    explicacion: 'Un metro equivale a 100 centímetros — por eso decís que 1 metro es igual a 100 centímetros.',
  },
  {
    numero: 2, tipo: 'unidad', emoji: '🛤️', contexto: 'Camino de 3 km',
    pregunta: '¿En qué unidad está medido?', opciones: ['cm', 'm', 'km'], correcta: 'km',
    lectura: 'Un camino de tres kilómetros, ¿en qué unidad está medido: centímetros, metros, o kilómetros?',
    explicacion: 'Para medir distancias largas, como un camino, se usa el kilómetro. El centímetro y el metro son unidades demasiado chicas para eso.',
  },
  {
    numero: 3, tipo: 'equivalencia', emoji: '⚒️', contexto: 'El yunque pesa más que la espada',
    antesIgual: '1 kg =', unidadDespues: 'g', respuesta: 1000,
    lectura: '¿Cuántos gramos tiene un kilogramo?',
    explicacion: 'Un kilogramo equivale a 1000 gramos — por eso decís que 1 kilogramo es igual a 1000 gramos.',
  },
  {
    numero: 4, tipo: 'unidad', emoji: '🍎', contexto: 'Una manzana',
    pregunta: '¿En qué unidad se mide su peso?', opciones: ['g', 'kg', 'toneladas'], correcta: 'g',
    lectura: '¿En qué unidad se mide el peso de una manzana: gramos, kilogramos, o toneladas?',
    explicacion: 'Una manzana pesa poco, así que se mide en gramos. Los kilogramos y las toneladas son para cosas mucho más pesadas.',
  },
  {
    numero: 5, tipo: 'equivalencia', emoji: '🥘', contexto: 'El caldero está lleno de agua',
    antesIgual: '1 L =', unidadDespues: 'mL', respuesta: 1000,
    lectura: '¿Cuántos mililitros tiene un litro?',
    explicacion: 'Un litro equivale a 1000 mililitros — por eso decís que 1 litro es igual a 1000 mililitros.',
  },
  {
    numero: 6, tipo: 'unidad', emoji: '🧪', contexto: 'Una poción',
    pregunta: '¿En qué unidad se mide?', opciones: ['mL', 'L'], correcta: 'mL',
    lectura: '¿En qué unidad se mide una poción pequeña: mililitros o litros?',
    explicacion: 'Una poción es una botella chica, así que se mide en mililitros. Los litros son para cantidades más grandes de líquido.',
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
    numero: 1,
    antes: 'Para medir cosas muy largas uso el',
    despues: '.',
    aceptables: ['kilometro', 'km'],
    lectura: '¿Qué unidad uso para medir cosas muy largas?',
    explicacion: 'Para distancias muy largas, como entre dos pueblos, la unidad que conviene usar es el kilómetro.',
  },
  {
    numero: 2,
    antes: '1 kg tiene',
    despues: 'gramos.',
    aceptables: ['1000'],
    lectura: '¿Cuántos gramos tiene un kilogramo?',
    explicacion: 'Un kilogramo equivale a 1000 gramos.',
  },
  {
    numero: 3,
    antes: 'El agua del caldero se mide en',
    despues: '.',
    aceptables: ['litros', 'litro', 'l'],
    lectura: '¿En qué unidad se mide el agua del caldero?',
    explicacion: 'Los líquidos, como el agua de un caldero, se miden en litros.',
  },
]

const TOTAL_PREGUNTAS = PREGUNTAS.length + COMPLETAR.length

// ── Bloque de estado por pregunta ──

interface EstadoMedida {
  valor: string
  seleccion: string | null
  evaluado: boolean
  correcto: boolean
}

interface EstadoCompleta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_MEDIDA_INICIAL: EstadoMedida = { valor: '', seleccion: null, evaluado: false, correcto: false }
const ESTADO_COMPLETA_INICIAL: EstadoCompleta = { valor: '', evaluado: false, correcto: false }

export default function TerceroModulo08() {
  const [medidas, setMedidas] = useState<Record<number, EstadoMedida>>(() =>
    Object.fromEntries(PREGUNTAS.map(p => [p.numero, { ...ESTADO_MEDIDA_INICIAL }])),
  )
  const [completa, setCompleta] = useState<Record<number, EstadoCompleta>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_COMPLETA_INICIAL }])),
  )
  const fanfarriaSonada = useRef(false)

  const [puntos, setPuntos] = useState(0)
  const [racha, setRacha] = useState(0)
  const [mejorRacha, setMejorRacha] = useState(0)

  // Ricky: UNA sola presencia en pantalla (regla del handoff de diseño —
  // nunca dos Rickys a la vez). Saluda al entrar (Wave ×2), después queda
  // respirando (Breathe/Idle) hasta que hay algo que reaccionar: rebota
  // feliz en un acierto, hace un pequeño Shake (confundido) en un error, piensa mientras
  // carga un "Explicar", y termina festejando (Bounce en loop) si el
  // módulo se completó perfecto.
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
    const cMed = Object.values(medidas).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cMed + cCompleta
  }, [medidas, completa])

  const totalEvaluadas = useMemo(() => {
    const eMed = Object.values(medidas).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eMed + eCompleta
  }, [medidas, completa])

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

  // Se lee el estado actual del closure (no la forma funcional de setState)
  // porque acá SÍ importa ejecutar el sonido una sola vez, exactamente
  // cuando el usuario hace clic — dentro de un updater de setState el efecto
  // de sonido podría dispararse más de una vez (p. ej. en modo estricto de
  // desarrollo, que invoca los updaters dos veces).
  function comprobarEquivalencia(p: PreguntaEquivalencia) {
    const actual = medidas[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.respuesta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setMedidas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function elegirUnidad(p: PreguntaUnidad, opcion: string) {
    const actual = medidas[p.numero]
    if (actual.evaluado) return
    const correcto = opcion === p.correcta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setMedidas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], seleccion: opcion, evaluado: true, correcto } }))
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
    setMedidas(Object.fromEntries(PREGUNTAS.map(p => [p.numero, { ...ESTADO_MEDIDA_INICIAL }])))
    setCompleta(Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_COMPLETA_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #22d3ee 0%, #a5f3fc 35%, #fef9c3 100%)',
      color: '#164e63', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #06b6d4, #0891b2)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #164e63', borderBottom: '4px solid #164e63',
      }}>
        <BotonMenu />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>📏🧪</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #164e63', margin: 0, color: 'white',
        }}>
          ¡Medidas!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Elegí la unidad correcta y completá las equivalencias
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#0891b2" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {PREGUNTAS.map((p, i) => (
            <TarjetaMedida key={p.numero} p={p} estado={medidas[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setMedidas(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => p.tipo === 'equivalencia' && comprobarEquivalencia(p)}
              onElegir={opcion => p.tipo === 'unidad' && elegirUnidad(p, opcion)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #67e8f9', boxShadow: '0 4px 0 rgba(22,78,99,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#164e63' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(22,78,99,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#164e63' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0891b2' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás las medidas 🎮'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi las dominás.'
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

// Ejemplo resuelto — no interactivo, con una equivalencia distinta a las 6
// de la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const respuesta = 60

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>🐉</span>
        <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0, flex: 1, minWidth: 0, fontWeight: 600, color: '#164e63' }}>El Ender Dragon vuela por 1 minuto</p>
        <BotonEscuchar texto={`Ejemplo: ¿cuántos segundos tiene un minuto? Un minuto equivale a ${respuesta} segundos.`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '0.6rem' }}>
        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#164e63' }}>1 min =</span>
        <span style={{
          padding: '0.4rem 0.9rem', borderRadius: 10, border: '2px solid #22c55e', background: '#dcfce7',
          color: '#16a34a', fontSize: '1.3rem', fontWeight: 800,
        }}>
          {respuesta}
        </span>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#164e63' }}>s</span>
      </div>
      <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', textAlign: 'center', color: '#164e63', opacity: 0.85 }}>
        Un minuto equivale a {respuesta} segundos — por eso decís que 1 minuto es igual a {respuesta} segundos.
      </p>
    </div>
  )
}

function TarjetaMedida({ p, estado, color, onCambiar, onComprobar, onElegir, onExplicarEstado }: {
  p: PreguntaMedida
  estado: EstadoMedida
  color: string
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onElegir: (opcion: string) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.emoji}</span>
        <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0, flex: 1, minWidth: 0, fontWeight: 600, color: '#164e63', overflowWrap: 'break-word' }}>{p.contexto}</p>
        <BotonEscuchar texto={p.lectura} tamano={32} />
      </div>

      {p.tipo === 'equivalencia' ? (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, flexShrink: 0, color: '#164e63' }}>{p.antesIgual}</span>
            <input
              type="number"
              inputMode="numeric"
              value={estado.valor}
              disabled={estado.evaluado}
              onChange={e => onCambiar(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                flex: 1, minWidth: 0, width: '100%', padding: '0.55rem', borderRadius: 12, border: `2px solid ${color}55`,
                background: '#ecfeff', color: '#164e63', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
              }}
            />
            <span style={{ fontSize: '1.1rem', fontWeight: 800, flexShrink: 0, color: '#164e63' }}>{p.unidadDespues}</span>
          </div>
          {!estado.evaluado && (
            <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
              width: '100%', marginTop: '0.6rem', padding: '0.55rem', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
              boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
              color: 'white', fontWeight: 800, fontSize: '1rem',
              opacity: estado.valor.trim() === '' ? 0.7 : 1,
            }}>
              Comprobar ✓
            </button>
          )}
        </>
      ) : (
        <>
          <p style={{ fontWeight: 800, fontSize: '1rem', margin: '0.4rem 0 0.6rem', color: '#164e63' }}>{p.pregunta}</p>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {p.opciones.map(o => {
              const esElegida = estado.seleccion === o
              const esLaCorrecta = estado.evaluado && o === p.correcta
              let bg = '#ecfeff'
              let borde = '#a5f3fc'
              let textColor = '#164e63'
              if (estado.evaluado) {
                if (esElegida && estado.correcto) { bg = '#dcfce7'; borde = '#22c55e'; textColor = '#16a34a' }
                else if (esElegida && !estado.correcto) { bg = '#fee2e2'; borde = '#ef4444'; textColor = '#dc2626' }
                else if (esLaCorrecta) { bg = '#dcfce7'; borde = '#86efac'; textColor = '#16a34a' }
              }
              return (
                <button key={o} onClick={() => onElegir(o)} disabled={estado.evaluado} style={{
                  flex: '1 1 auto', minWidth: 0, padding: '0.55rem 0.4rem', borderRadius: 10, border: `2px solid ${borde}`,
                  background: bg, color: textColor, fontWeight: 800, fontSize: '0.95rem',
                  cursor: estado.evaluado ? 'default' : 'pointer', whiteSpace: 'nowrap',
                }}>
                  {o}
                </button>
              )
            })}
          </div>
        </>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : p.tipo === 'equivalencia' ? `❌ Era ${p.respuesta}` : `❌ Era ${p.correcta}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#67e8f9'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#ecfeff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#164e63' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #67e8f9',
          background: 'white', color: '#164e63', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#164e63' }}>{p.despues}</span>
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
