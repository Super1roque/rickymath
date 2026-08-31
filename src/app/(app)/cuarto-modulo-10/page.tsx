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

// ── Datos de la actividad (basados en la hoja "Actividad 10 - Misión
// Final: Resolución de Problemas"). Las respuestas de los 3 problemas
// salen enteras del enunciado (vienen entre paréntesis en la hoja como
// clave), así que se convierten en casillas en blanco igual que en el
// resto de la serie. La sección "Completa" del final de la hoja solo trae
// íconos de animales sin ninguna oración — confirmado con el usuario que
// es decorativa, así que no tiene tarea interactiva.

interface Respuesta {
  etiqueta: string
  valor: number
  explicacion: string
}

interface Problema {
  numero: number
  titulo: string
  emoji: string
  enunciado: string
  lectura: string
  respuestas: Respuesta[]
}

const PROBLEMAS: Problema[] = [
  {
    numero: 1, titulo: 'La granja del camello', emoji: '🐫',
    enunciado: 'Terreno de 12 por 8. Se cerca el borde y se planta la mitad de la superficie. ¿Cuánta valla se necesita? ¿Cuánto queda plantado?',
    lectura: 'Terreno de doce por ocho. Se cerca el borde y se planta la mitad de la superficie. ¿Cuánta valla se necesita? ¿Cuánto queda plantado?',
    respuestas: [
      { etiqueta: 'Valla', valor: 40, explicacion: 'La valla rodea el borde, así que es el perímetro: (12 + 8) × 2 = 40.' },
      { etiqueta: 'Plantado', valor: 48, explicacion: 'El área del terreno es 12 × 8 = 96. La mitad plantada es 96 ÷ 2 = 48.' },
    ],
  },
  {
    numero: 2, titulo: 'El reparto del slime', emoji: '🟢',
    enunciado: 'Hay 84 esmeraldas repartidas en 6 cofres iguales. Sacan 3 esmeraldas de cada cofre. ¿Cuántas quedan en cada cofre? ¿Cuántas quedan en total?',
    lectura: 'Hay ochenta y cuatro esmeraldas repartidas en seis cofres iguales. Sacan tres esmeraldas de cada cofre. ¿Cuántas quedan en cada cofre? ¿Cuántas quedan en total?',
    respuestas: [
      { etiqueta: 'Por cofre', valor: 11, explicacion: 'Reparto 84 entre 6 cofres: 84 ÷ 6 = 14 por cofre. Sacan 3: 14 − 3 = 11 quedan en cada uno.' },
      { etiqueta: 'Total', valor: 66, explicacion: 'Quedan 11 en cada uno de los 6 cofres: 11 × 6 = 66 en total.' },
    ],
  },
  {
    numero: 3, titulo: 'La expedición del delfín', emoji: '🐬',
    enunciado: 'El delfín bajó 2,5 bloques por la mañana y 3,75 por la tarde. La cueva está a 7 bloques de profundidad. ¿Cuánto bajó en total? ¿Cuánto le falta para llegar?',
    lectura: 'El delfín bajó dos coma cinco bloques por la mañana y tres coma setenta y cinco por la tarde. La cueva está a siete bloques de profundidad. ¿Cuánto bajó en total? ¿Cuánto le falta para llegar?',
    respuestas: [
      { etiqueta: 'Bajó en total', valor: 6.25, explicacion: 'Sumo lo que bajó: 2,5 + 3,75 = 6,25.' },
      { etiqueta: 'Falta', valor: 0.75, explicacion: 'La cueva está a 7 bloques. Ya bajó 6,25, así que falta 7 − 6,25 = 0,75.' },
    ],
  },
]

interface Autoeval {
  numero: number
  texto: string
}

const AUTOEVALUACION: Autoeval[] = [
  { numero: 1, texto: 'Entendí qué me pedía cada problema.' },
  { numero: 2, texto: 'Revisé mi resultado antes de escribirlo.' },
  { numero: 3, texto: '¡Completé el 4.º de Primaria!' },
]

function idResp(numeroProblema: number, etiqueta: string): string {
  return `${numeroProblema}_${etiqueta}`
}

const TOTAL_RESPUESTAS = PROBLEMAS.reduce((s, p) => s + p.respuestas.length, 0)
const TOTAL_PREGUNTAS = TOTAL_RESPUESTAS + AUTOEVALUACION.length

// ── Bloque de estado ──

interface EstadoPregunta { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoAutoeval { seleccion: string; evaluado: boolean }

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function CuartoModulo10() {
  const [respuestas, setRespuestas] = useState<Record<string, EstadoPregunta>>(() =>
    Object.fromEntries(PROBLEMAS.flatMap(p => p.respuestas.map(r => [idResp(p.numero, r.etiqueta), { ...ESTADO_INICIAL }]))),
  )
  const [autoeval, setAutoeval] = useState<Record<number, EstadoAutoeval>>(() =>
    Object.fromEntries(AUTOEVALUACION.map(a => [a.numero, { seleccion: '', evaluado: false }])),
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
    const cResp = Object.values(respuestas).filter(e => e.evaluado && e.correcto).length
    const cAuto = Object.values(autoeval).filter(e => e.evaluado).length
    return cResp + cAuto
  }, [respuestas, autoeval])

  const totalEvaluadas = useMemo(() => {
    const eResp = Object.values(respuestas).filter(e => e.evaluado).length
    const eAuto = Object.values(autoeval).filter(e => e.evaluado).length
    return eResp + eAuto
  }, [respuestas, autoeval])

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

  function comprobarRespuesta(p: Problema, r: Respuesta) {
    const id = idResp(p.numero, r.etiqueta)
    const actual = respuestas[id]
    if (actual.evaluado || actual.valor.trim() === '') return
    const valorNormalizado = actual.valor.trim().replace(',', '.')
    const correcto = Number(valorNormalizado) === r.valor
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setRespuestas(prev => ({ ...prev, [id]: { ...prev[id], evaluado: true, correcto } }))
  }

  function elegirAutoeval(a: Autoeval, opcion: string) {
    const actual = autoeval[a.numero]
    if (actual.evaluado) return
    reproducirCorrecto()
    registrarResultado(true)
    reaccionarRicky(true)
    setAutoeval(prev => ({ ...prev, [a.numero]: { seleccion: opcion, evaluado: true } }))
  }

  function reiniciar() {
    setRespuestas(Object.fromEntries(PROBLEMAS.flatMap(p => p.respuestas.map(r => [idResp(p.numero, r.etiqueta), { ...ESTADO_INICIAL }]))))
    setAutoeval(Object.fromEntries(AUTOEVALUACION.map(a => [a.numero, { seleccion: '', evaluado: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #6d28d9 0%, #c4b5fd 35%, #f5f3ff 100%)',
      color: '#2e1065', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #6d28d9, #4c1d95)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #2e1065', borderBottom: '4px solid #2e1065',
      }}>
        <BotonMenu href="/cuarto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🌌🏆</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #2e1065', margin: 0, color: 'white',
        }}>
          ¡Misión final!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Tres misiones finales — leé, planificá, resolvé y revisá
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#6d28d9" />
          </div>
        </div>

        <EjemploResuelto />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.1rem', marginBottom: '1.5rem' }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} color={COLORES[i % COLORES.length]}
              respuestas={respuestas}
              onCambiar={(id, valor) => setRespuestas(prev => ({ ...prev, [id]: { ...prev[id], valor } }))}
              onComprobar={r => comprobarRespuesta(p, r)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #ddd6fe', boxShadow: '0 4px 0 rgba(46,16,101,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem', marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2e1065' }}>
            📝 Autoevaluación
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {AUTOEVALUACION.map(a => (
              <FilaAutoeval key={a.numero} a={a} estado={autoeval[a.numero]} onElegir={opcion => elegirAutoeval(a, opcion)} />
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9rem', opacity: 0.75, marginBottom: '0.5rem' }}>Los amigos que conociste en el camino:</p>
          <p style={{ fontSize: '1.8rem', margin: 0 }}>🐫⛄🐸🟢🐕🐬🐇🐐🐟</p>
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(46,16,101,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#2e1065' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#6d28d9' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '🎉 ¡Completaste la Misión Final del 4.º de Primaria! 🏆'
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

// Ejemplo resuelto de referencia ("Cómo se hace") — no se evalúa, es solo
// para que el chico vea el proceso de 3 pasos antes de resolver los suyos.
function EjemploResuelto() {
  return (
    <div style={{
      background: '#f5f3ff', border: '3px dashed #a78bfa', borderRadius: 18, padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.3rem' }}>💡</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, color: '#2e1065' }}>Cómo se hace</p>
        <BotonEscuchar
          texto="Un terreno de 10 por 5 se cerca en todo el borde. ¿Cuánta valla se necesita? Primero, ¿qué me preguntan? Cuánta valla, o sea el perímetro. Segundo, la cuenta: diez más cinco es quince, por dos es treinta. Tercero, la respuesta: treinta bloques de valla."
          tamano={32}
        />
      </div>
      <p style={{ fontSize: '0.85rem', margin: '0 0 0.6rem', color: '#2e1065', overflowWrap: 'break-word' }}>
        Un terreno de 10 por 5 se cerca en todo el borde. ¿Cuánta valla se necesita?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: '#4c1d95' }}>
        <p style={{ margin: 0 }}><strong>① ¿Qué me preguntan?</strong> Cuánta valla — es el perímetro.</p>
        <p style={{ margin: 0 }}><strong>② Cuenta:</strong> (10 + 5) × 2 = 30</p>
        <p style={{ margin: 0 }}><strong>③ Respuesta:</strong> 30 bloques de valla.</p>
      </div>
    </div>
  )
}

function TarjetaProblema({ p, color, respuestas, onCambiar, onComprobar, onExplicarEstado }: {
  p: Problema
  color: string
  respuestas: Record<string, EstadoPregunta>
  onCambiar: (id: string, valor: string) => void
  onComprobar: (r: Respuesta) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  return (
    <div style={{
      background: 'white', border: `3px solid ${color}`, boxShadow: `0 4px 0 ${color}55`,
      borderRadius: 18, padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.emoji}</span>
        <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0, color: '#2e1065' }}>{p.titulo}</p>
        <BotonEscuchar texto={p.lectura} tamano={32} />
      </div>

      <p style={{ fontSize: '0.9rem', margin: '0 0 0.7rem', fontWeight: 600, color: '#2e1065', overflowWrap: 'break-word' }}>{p.enunciado}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {p.respuestas.map(r => (
          <FilaRespuesta key={r.etiqueta} etiqueta={r.etiqueta} explicacion={r.explicacion}
            estado={respuestas[idResp(p.numero, r.etiqueta)]}
            onCambiar={valor => onCambiar(idResp(p.numero, r.etiqueta), valor)}
            onComprobar={() => onComprobar(r)} onExplicarEstado={onExplicarEstado} />
        ))}
      </div>
    </div>
  )
}

function FilaRespuesta({ etiqueta, explicacion, estado, onCambiar, onComprobar, onExplicarEstado }: {
  etiqueta: string
  explicacion: string
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#ddd6fe'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
      padding: '0.5rem', borderRadius: 12, border: `2px solid ${borde}`, background: '#f5f3ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2e1065', flexShrink: 0 }}>{etiqueta}:</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="?"
        style={{
          flex: 1, minWidth: 0, width: '100%', padding: '0.5rem', borderRadius: 10, border: '2px solid #ddd6fe',
          background: 'white', color: '#2e1065', fontSize: '1.05rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      {!estado.evaluado ? (
        <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
          padding: '0.5rem 0.8rem', borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
          boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1rem',
          opacity: estado.valor.trim() === '' ? 0.7 : 1,
        }}>
          ✓
        </button>
      ) : (
        <>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, flexShrink: 0, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅' : '❌'}
          </span>
          <BotonExplicar texto={explicacion} onEstadoCambia={onExplicarEstado} />
        </>
      )}
    </div>
  )
}

function FilaAutoeval({ a, estado, onElegir }: {
  a: Autoeval
  estado: EstadoAutoeval
  onElegir: (opcion: string) => void
}) {
  const OPCIONES = [
    { valor: 'Sí', color: '#22c55e' },
    { valor: 'Casi', color: '#f59e0b' },
    { valor: 'Todavía no', color: '#ef4444' },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.6rem', borderRadius: 12, border: '2px solid #ddd6fe', background: '#f5f3ff',
    }}>
      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#2e1065', flex: '1 1 200px' }}>{a.numero}. {a.texto}</span>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        {OPCIONES.map(o => {
          const esElegida = estado.seleccion === o.valor
          return (
            <button key={o.valor} onClick={() => onElegir(o.valor)} disabled={estado.evaluado} style={{
              padding: '0.4rem 0.6rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 800,
              border: `2px solid ${esElegida ? o.color : '#ddd6fe'}`,
              background: esElegida ? `${o.color}22` : 'white',
              color: esElegida ? o.color : '#2e1065',
              cursor: estado.evaluado ? 'default' : 'pointer',
            }}>
              {o.valor}
            </button>
          )
        })}
      </div>
    </div>
  )
}
