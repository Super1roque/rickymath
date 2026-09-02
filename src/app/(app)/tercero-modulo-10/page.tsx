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
import CandadoPremium from '@/components/guia/CandadoPremium'

// ── Datos de la actividad (basados en la hoja "Actividad 10 - Misión Final: Resolución de Problemas") ──
// A diferencia de fracciones/ángulos/gráficos, acá la clave sale entera del
// enunciado (no depende de leer ningún dibujo), así que no hizo falta
// pedirle confirmación al usuario.

interface Respuesta { etiqueta: string; valor: number; explicacion: string }

interface Problema {
  numero: number
  emoji: string
  enunciado: string
  lectura: string
  respuestas: Respuesta[]
}

const PROBLEMAS: Problema[] = [
  {
    numero: 1, emoji: '🐑',
    enunciado: 'En la granja hay 8 corrales con 7 ovejas en cada uno. Escapan 15 ovejas. ¿Cuántas quedan?',
    lectura: 'En la granja hay ocho corrales con siete ovejas en cada uno. Escapan quince ovejas. ¿Cuántas quedan?',
    respuestas: [{
      etiqueta: 'Respuesta', valor: 41,
      explicacion: 'Primero cuento el total de ovejas: 8 corrales por 7 ovejas es 56. Después resto las que escaparon: 56 menos 15 es 41.',
    }],
  },
  {
    numero: 2, emoji: '🐷',
    enunciado: 'Un piglin vende 5 espadas de oro a 14 esmeraldas cada una. ¿Cuántas esmeraldas recibe en total?',
    lectura: 'Un piglin vende cinco espadas de oro a catorce esmeraldas cada una. ¿Cuántas esmeraldas recibe en total?',
    respuestas: [{
      etiqueta: 'Respuesta', valor: 70,
      explicacion: 'Multiplico la cantidad de espadas por el precio de cada una: 5 por 14 es 70.',
    }],
  },
  {
    numero: 3, emoji: '🧱',
    enunciado: 'Steve guarda 96 bloques de piedra en 8 cofres. ¿Cuántos bloques hay en cada cofre?',
    lectura: 'Steve guarda noventa y seis bloques de piedra en ocho cofres. ¿Cuántos bloques hay en cada cofre?',
    respuestas: [{
      etiqueta: 'Respuesta', valor: 12,
      explicacion: 'Divido el total de bloques entre la cantidad de cofres: 96 dividido 8 es 12.',
    }],
  },
  {
    numero: 4, emoji: '🚧',
    enunciado: 'El terreno es cuadrado y cada lado mide 9 bloques. ¿Cuál es el perímetro? Si cada valla cubre 3 bloques, ¿cuántas vallas se necesitan?',
    lectura: 'El terreno es cuadrado y cada lado mide nueve bloques. ¿Cuál es el perímetro? Y si cada valla cubre tres bloques, ¿cuántas vallas se necesitan?',
    respuestas: [
      {
        etiqueta: 'Perímetro', valor: 36,
        explicacion: 'Como es un cuadrado de lado 9, sumo los 4 lados: 9 más 9 más 9 más 9 es 36. También podés multiplicar 9 por 4.',
      },
      {
        etiqueta: 'Vallas', valor: 12,
        explicacion: 'Cada valla cubre 3 bloques, y el perímetro es 36. Divido 36 entre 3 y me da 12 vallas.',
      },
    ],
  },
]

interface PreguntaCompleta {
  numero: number
  antes: string
  despues: string
  // aceptables: null = respuesta libre, no hay una única correcta.
  aceptables: string[] | null
  lectura: string
  explicacion: string
}

const COMPLETAR: PreguntaCompleta[] = [
  {
    numero: 1,
    antes: 'Antes de calcular, leo el problema',
    despues: 'veces.',
    aceptables: ['dos', '2'],
    lectura: '¿Cuántas veces conviene leer el problema antes de calcular?',
    explicacion: 'Leer el problema más de una vez ayuda a entender bien qué te preguntan antes de calcular — por eso conviene leerlo dos veces.',
  },
  {
    numero: 2,
    antes: 'Si un problema tiene dos pasos, resuelvo primero el',
    despues: '.',
    aceptables: null,
    lectura: 'Si un problema tiene dos pasos, ¿qué resolvés primero?',
    explicacion: 'Cuando un problema tiene dos pasos, conviene resolver primero la parte que ya tenés todos los datos, y usar ese resultado para el segundo paso.',
  },
]

function idResp(numeroProblema: number, etiqueta: string): string {
  return `${numeroProblema}_${etiqueta}`
}

const TOTAL_RESPUESTAS = PROBLEMAS.reduce((s, p) => s + p.respuestas.length, 0)
const TOTAL_PREGUNTAS = TOTAL_RESPUESTAS + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

export default function TerceroModulo10() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [respuestas, setRespuestas] = useState<Record<string, EstadoPregunta>>(() =>
    Object.fromEntries(PROBLEMAS.flatMap(p => p.respuestas.map(r => [idResp(p.numero, r.etiqueta), { ...ESTADO_INICIAL }]))),
  )
  const [completa, setCompleta] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_INICIAL }])),
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
    const cResp = Object.values(respuestas).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cResp + cCompleta
  }, [respuestas, completa])

  const totalEvaluadas = useMemo(() => {
    const eResp = Object.values(respuestas).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eResp + eCompleta
  }, [respuestas, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'tercero-modulo-10', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  // Se lee el estado actual del closure (no la forma funcional de setState)
  // porque acá SÍ importa ejecutar el sonido una sola vez, exactamente
  // cuando el usuario hace clic — dentro de un updater de setState el efecto
  // de sonido podría dispararse más de una vez (p. ej. en modo estricto de
  // desarrollo, que invoca los updaters dos veces).
  function comprobarRespuesta(p: Problema, r: Respuesta) {
    const id = idResp(p.numero, r.etiqueta)
    const actual = respuestas[id]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === r.valor
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setRespuestas(prev => ({ ...prev, [id]: { ...prev[id], evaluado: true, correcto } }))
  }

  function comprobarCompleta(p: PreguntaCompleta) {
    const actual = completa[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = p.aceptables === null || p.aceptables.map(normalizarTexto).includes(normalizarTexto(actual.valor))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompleta(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setRespuestas(Object.fromEntries(PROBLEMAS.flatMap(p => p.respuestas.map(r => [idResp(p.numero, r.etiqueta), { ...ESTADO_INICIAL }]))))
    setCompleta(Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #818cf8 0%, #c7d2fe 35%, #fef9c3 100%)',
      color: '#1e1b4b', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #4338ca, #3730a3)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #1e1b4b', borderBottom: '4px solid #1e1b4b',
      }}>
        <BotonMenu />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🏆💎</div>
        <h1 style={{
          fontSize: 'clamp(1.1rem, 4.2vw, 2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #1e1b4b', margin: 0, color: 'white',
        }}>
          ¡Misión final!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Leé, planificá y resolvé — mostrá todos tus pasos
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#4338ca" />
          </div>
        </div>

        <EjemploResuelto />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.1rem', marginBottom: '2rem' }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} color={COLORES[i % COLORES.length]}
              respuestas={respuestas}
              onCambiar={(id, valor) => setRespuestas(prev => ({ ...prev, [id]: { ...prev[id], valor } }))}
              onComprobar={r => comprobarRespuesta(p, r)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #a5b4fc', boxShadow: '0 4px 0 rgba(30,27,75,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e1b4b' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(30,27,75,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#1e1b4b' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#4338ca' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '🎉 ¡Completaste la Misión Final del 3.º de Primaria! 🏆'
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

// Ejemplo resuelto de referencia ("Cómo se hace") — no se evalúa, es solo
// para que el chico vea el proceso de 3 pasos antes de resolver los suyos.
function EjemploResuelto() {
  return (
    <div style={{
      background: '#eef2ff', border: '3px dashed #818cf8', borderRadius: 18, padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.3rem' }}>💡</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, color: '#1e1b4b' }}>Cómo se hace</p>
        <BotonEscuchar
          texto="Alex tiene seis cofres con doce diamantes cada uno. Regala veinte diamantes. ¿Cuántos le quedan? Primero, ¿qué me preguntan? Cuántos diamantes le quedan. Segundo, la cuenta: seis por doce es setenta y dos, setenta y dos menos veinte es cincuenta y dos. Tercero, la respuesta: cincuenta y dos diamantes."
          tamano={32}
        />
      </div>
      <p style={{ fontSize: '0.85rem', margin: '0 0 0.6rem', color: '#1e1b4b', overflowWrap: 'break-word' }}>
        Alex tiene 6 cofres con 12 diamantes cada uno. Regala 20 diamantes. ¿Cuántos le quedan?
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: '#312e81' }}>
        <p style={{ margin: 0 }}><strong>① ¿Qué me preguntan?</strong> Cuántos diamantes le quedan.</p>
        <p style={{ margin: 0 }}><strong>② Cuenta:</strong> 6×12=72, 72−20=52</p>
        <p style={{ margin: 0 }}><strong>③ Respuesta:</strong> 52 diamantes.</p>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.emoji}</span>
        <p style={{ fontSize: '0.9rem', margin: 0, flex: 1, minWidth: 0, fontWeight: 600, color: '#1e1b4b', overflowWrap: 'break-word' }}>{p.enunciado}</p>
        <BotonEscuchar texto={p.lectura} tamano={32} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {p.respuestas.map(r => (
          <FilaRespuesta key={r.etiqueta} id={idResp(p.numero, r.etiqueta)} etiqueta={r.etiqueta} valorCorrecto={r.valor} explicacion={r.explicacion}
            estado={respuestas[idResp(p.numero, r.etiqueta)]}
            onCambiar={valor => onCambiar(idResp(p.numero, r.etiqueta), valor)}
            onComprobar={() => onComprobar(r)} onExplicarEstado={onExplicarEstado} />
        ))}
      </div>
    </div>
  )
}

function FilaRespuesta({ etiqueta, valorCorrecto, explicacion, estado, onCambiar, onComprobar, onExplicarEstado }: {
  id: string
  etiqueta: string
  valorCorrecto: number
  explicacion: string
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#c7d2fe'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
      padding: '0.5rem', borderRadius: 12, border: `2px solid ${borde}`, background: '#eef2ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e1b4b', flexShrink: 0 }}>{etiqueta}:</span>
      <input
        type="number"
        inputMode="numeric"
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="?"
        style={{
          flex: 1, minWidth: 0, width: '100%', padding: '0.5rem', borderRadius: 10, border: '2px solid #c7d2fe',
          background: 'white', color: '#1e1b4b', fontSize: '1.15rem', fontWeight: 700, textAlign: 'center',
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${valorCorrecto}`}
          </span>
          <BotonExplicar texto={explicacion} onEstadoCambia={onExplicarEstado} />
        </>
      )}
    </div>
  )
}

function FilaCompleta({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaCompleta
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#a5b4fc'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#eef2ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#1e1b4b' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #a5b4fc',
          background: 'white', color: '#1e1b4b', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e1b4b' }}>{p.despues}</span>
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
            {estado.correcto ? '✅' : p.aceptables ? `❌ (${p.aceptables[0]})` : '✅'}
          </span>
          <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
        </>
      )}
    </div>
  )
}
