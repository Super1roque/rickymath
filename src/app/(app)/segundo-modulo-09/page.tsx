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

// ── Datos de la actividad (basados en la hoja "Actividad 9 - El Reloj y la
// Hora"). Horas confirmadas a mano por el usuario mirando la hoja original:
// 1) Amanecer 3:00  2) Mediodía 12:00  3) Tarde 6:30  4) Atardecer 9:15
// 5) Noche 7:45  6) Madrugada 10:30.

interface PreguntaReloj {
  numero: number
  etiqueta: string
  escena: string
  hora: number
  minuto: number
  explicacion: string
}

const ITEMS: PreguntaReloj[] = [
  { numero: 1, etiqueta: 'Amanecer', escena: '🌅', hora: 3, minuto: 0, explicacion: 'La aguja corta (hora) apunta al 3 y la aguja larga (minutero) apunta al 12 — son las 3:00 en punto.' },
  { numero: 2, etiqueta: 'Mediodía', escena: '☀️', hora: 12, minuto: 0, explicacion: 'Las dos agujas apuntan al 12 — son las 12:00 en punto, el mediodía.' },
  { numero: 3, etiqueta: 'Tarde', escena: '🌇', hora: 6, minuto: 30, explicacion: 'La aguja corta está entre el 6 y el 7, y el minutero apunta al 6 (30 minutos) — son las 6:30.' },
  { numero: 4, etiqueta: 'Atardecer', escena: '🌆', hora: 9, minuto: 15, explicacion: 'La aguja corta está un poco pasado el 9, y el minutero apunta al 3 (15 minutos) — son las 9:15.' },
  { numero: 5, etiqueta: 'Noche', escena: '🌙', hora: 7, minuto: 45, explicacion: 'La aguja corta está casi en el 8, y el minutero apunta al 9 (45 minutos) — son las 7:45.' },
  { numero: 6, etiqueta: 'Madrugada', escena: '✨', hora: 10, minuto: 30, explicacion: 'La aguja corta está entre el 10 y el 11, y el minutero apunta al 6 (30 minutos) — son las 10:30.' },
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
    numero: 1, antes: 'Cuando el minutero está en el 12, la hora es en', despues: '.',
    aceptables: ['punto', 'en punto'],
    lectura: 'Cuando el minutero está en el 12, la hora es en... ¿qué?',
    explicacion: 'Si el minutero apunta al 12, no pasó ningún minuto todavía — por eso decimos que la hora es "en punto".',
  },
  {
    numero: 2, antes: 'Media hora son', despues: 'minutos.',
    aceptables: ['30'],
    lectura: '¿Cuántos minutos son media hora?',
    explicacion: 'Una hora completa tiene 60 minutos, así que la mitad — media hora — son 30 minutos.',
  },
  {
    numero: 3, antes: 'Una hora completa tiene', despues: 'minutos.',
    aceptables: ['60'],
    lectura: '¿Cuántos minutos tiene una hora completa?',
    explicacion: 'El minutero da toda la vuelta al reloj, pasando por los 60 minutitos, para completar una hora.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoPregunta { valor: string; evaluado: boolean; correcto: boolean }

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

function parsearHora(valor: string): { hora: number; minuto: number } | null {
  const m = valor.trim().match(/^(\d{1,2})\s*[:.hH]\s*(\d{1,2})$/)
  if (!m) return null
  const hora = Number(m[1])
  const minuto = Number(m[2])
  if (Number.isNaN(hora) || Number.isNaN(minuto) || minuto > 59) return null
  return { hora, minuto }
}

export default function SegundoModulo09() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])),
  )
  const [completa, setCompleta] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_INICIAL }])),
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
    const cItems = Object.values(items).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return cItems + cCompleta
  }, [items, completa])

  const totalEvaluadas = useMemo(() => {
    const eItems = Object.values(items).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eItems + eCompleta
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'segundo-modulo-09', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: PreguntaReloj) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const leida = parsearHora(actual.valor)
    const correcto = !!leida && leida.hora % 12 === p.hora % 12 && leida.minuto === p.minuto
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { ...ESTADO_INICIAL }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #6366f1 0%, #c7d2fe 35%, #fef9c3 100%)',
      color: '#312e81', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #4f46e5, #3730a3)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #312e81', borderBottom: '4px solid #312e81',
      }}>
        <BotonMenu href="/segundo-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🕐⏰</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #312e81', margin: 0, color: 'white',
        }}>
          ¡El reloj y la hora!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Leé la hora en cada reloj y escribíla
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#4f46e5" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map(p => (
            <TarjetaReloj key={p.numero} p={p} estado={items[p.numero]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #c7d2fe', boxShadow: '0 4px 0 rgba(49,46,129,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#312e81' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(49,46,129,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#312e81' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#4338ca' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Ya sabés leer la hora 🎮'
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

// Reloj analógico dibujado a mano en SVG — los ángulos de las agujas se
// calculan a partir de hora/minuto (igual criterio que un reloj real: la
// aguja corta avanza 0.5° por minuto, no se queda fija en la hora exacta).
function Reloj({ hora, minuto, size = 108 }: { hora: number; minuto: number; size?: number }) {
  const anguloMinutero = minuto * 6
  const anguloHora = (hora % 12) * 30 + minuto * 0.5
  const puntaHora = puntoEnCirculo(anguloHora, 24)
  const puntaMinutero = puntoEnCirculo(anguloMinutero, 36)

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Reloj marcando ${hora}:${String(minuto).padStart(2, '0')}`}>
      <circle cx={50} cy={50} r={46} fill="#fdfaf3" stroke="#1f2937" strokeWidth={4} />
      {Array.from({ length: 12 }, (_, i) => {
        const angulo = i * 30
        const numero = i === 0 ? 12 : i
        const p = puntoEnCirculo(angulo, 37)
        return (
          <text key={i} x={p.x} y={p.y + 3} fontSize={9} fontWeight={800} textAnchor="middle" fill="#1f2937">
            {numero}
          </text>
        )
      })}
      <line x1={50} y1={50} x2={puntaHora.x} y2={puntaHora.y} stroke="#1f2937" strokeWidth={5} strokeLinecap="round" />
      <line x1={50} y1={50} x2={puntaMinutero.x} y2={puntaMinutero.y} stroke="#4f46e5" strokeWidth={3.2} strokeLinecap="round" />
      <circle cx={50} cy={50} r={3.2} fill="#1f2937" />
    </svg>
  )
}

function puntoEnCirculo(anguloGrados: number, radio: number) {
  const rad = ((anguloGrados - 90) * Math.PI) / 180
  return { x: 50 + radio * Math.cos(rad), y: 50 + radio * Math.sin(rad) }
}

// Ejemplo resuelto — no interactivo, con una hora distinta a las 6 de la
// actividad real (5:00, hora del recreo) para no revelar ninguna respuesta.
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
        <BotonEscuchar texto="Ejemplo: hora del recreo. La aguja corta apunta al 5 y el minutero apunta al 12 — son las 5:00 en punto." tamano={32} />
      </div>

      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#1e3a8a', margin: '0 0 0.6rem' }}>🔔 Hora del recreo</p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6rem' }}>
        <Reloj hora={5} minuto={0} />
      </div>

      <p style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.3rem', color: '#1e3a8a', margin: '0 0 0.4rem' }}>5:00</p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: 0 }}>
        La aguja corta apunta al 5 y el minutero apunta al 12 — son las 5:00 en punto.
      </p>
    </div>
  )
}

function TarjetaReloj({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: PreguntaReloj
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#4f46e5'
  const horaTexto = `${p.hora}:${String(p.minuto).padStart(2, '0')}`

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', gap: '0.4rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: '#4f46e5', color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, flex: 1, minWidth: 0, textAlign: 'center', color: '#312e81' }}>
          {p.escena} {p.etiqueta}
        </p>
        <BotonEscuchar texto={`¿Qué hora marca el reloj del ${p.etiqueta.toLowerCase()}?`} tamano={32} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.7rem' }}>
        <Reloj hora={p.hora} minuto={p.minuto} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
        <input
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="h:mm"
          style={{
            width: 80, padding: '0.5rem', borderRadius: 12, border: `2px solid ${bordeColor}55`,
            background: '#eef2ff', color: '#312e81', fontSize: '1.2rem', fontWeight: 700, textAlign: 'center',
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${horaTexto}`}
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
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#eef2ff',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#312e81' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #c7d2fe',
          background: 'white', color: '#312e81', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#312e81' }}>{p.despues}</span>
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
