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

// ── Datos de la actividad (basados en la hoja "Actividad 9 - Media y
// Estadística"). Los ítems 1 y 2 traen el paso a paso ya impreso ("Suma 36
// ÷ 4 = 9") — igual que en el resto de la serie, se oculta y se deja una
// sola casilla final que el chico completa y la app corrige. Los valores
// del gráfico de barras del ítem 3 (Lunes 20, Martes 30, Miércoles 10,
// Jueves 40, Viernes 20) los confirmó el usuario a mano.

interface ItemMedia {
  numero: number
  datos: number[]
  emoji: string
  media: number
}

const MEDIAS: ItemMedia[] = [
  { numero: 1, datos: [6, 8, 10, 12], emoji: '💎', media: 9 },
  { numero: 2, datos: [12, 15, 10, 18, 20], emoji: '🌾', media: 15 },
]

interface DiaGrafico { dia: string; valor: number }

const GRAFICO: DiaGrafico[] = [
  { dia: 'Lunes', valor: 20 },
  { dia: 'Martes', valor: 30 },
  { dia: 'Miércoles', valor: 10 },
  { dia: 'Jueves', valor: 40 },
  { dia: 'Viernes', valor: 20 },
]
const MEDIA_GRAFICO = GRAFICO.reduce((s, d) => s + d.valor, 0) / GRAFICO.length

const DATOS_MODA = [3, 7, 5, 7, 9, 7, 2]
const MODA = 7

const SI_NO = {
  pregunta: 'El promedio de la semana fue 15. ¿Significa que TODOS los días fueron 15?',
  correcta: 'no' as 'si' | 'no',
  explicacion: 'No necesariamente. El promedio puede dar 15 aunque los días sean distintos — por ejemplo, 10 y 20 también promedian 15. El promedio resume los datos, pero no dice que todos sean iguales.',
}

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
    numero: 1, antes: 'Para hallar la media, sumo todo y', despues: 'entre la cantidad de datos.',
    aceptables: ['divido'],
    lectura: 'Para hallar la media, sumo todo y... ¿qué hago entre la cantidad de datos?',
    explicacion: 'Para hallar la media, sumo todos los datos y divido el resultado entre la cantidad de datos.',
  },
  {
    numero: 2, antes: 'La moda es el valor que más se', despues: '.',
    aceptables: ['repite'],
    lectura: 'La moda es el valor que más se... ¿qué?',
    explicacion: 'La moda es el valor que más veces aparece repetido en un conjunto de datos.',
  },
  {
    numero: 3, antes: 'El promedio de 6, 8, 10 y 12 es', despues: '.',
    aceptables: ['9'],
    lectura: '¿Cuál es el promedio de seis, ocho, diez y doce?',
    explicacion: 'Sumo: 6 + 8 + 10 + 12 = 36. Divido entre 4 datos: 36 ÷ 4 = 9.',
  },
]

const TOTAL_PREGUNTAS = MEDIAS.length + 1 + 1 + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoSimple { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoSiNo { seleccion: 'si' | 'no' | null; evaluado: boolean; correcto: boolean }

export default function QuintoModulo09() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [medias, setMedias] = useState<Record<number, EstadoSimple>>(() =>
    Object.fromEntries(MEDIAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const [grafico, setGrafico] = useState<EstadoSimple>({ valor: '', evaluado: false, correcto: false })
  const [moda, setModa] = useState<EstadoSimple>({ valor: '', evaluado: false, correcto: false })
  const [siNo, setSiNo] = useState<EstadoSiNo>({ seleccion: null, evaluado: false, correcto: false })
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
    const a = Object.values(medias).filter(e => e.evaluado && e.correcto).length
    const b = grafico.evaluado && grafico.correcto ? 1 : 0
    const c = moda.evaluado && moda.correcto ? 1 : 0
    const d = siNo.evaluado && siNo.correcto ? 1 : 0
    const e = Object.values(completa).filter(x => x.evaluado && x.correcto).length
    return a + b + c + d + e
  }, [medias, grafico, moda, siNo, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(medias).filter(e => e.evaluado).length
    const b = grafico.evaluado ? 1 : 0
    const c = moda.evaluado ? 1 : 0
    const d = siNo.evaluado ? 1 : 0
    const e = Object.values(completa).filter(x => x.evaluado).length
    return a + b + c + d + e
  }, [medias, grafico, moda, siNo, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'quinto-modulo-09', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarMedia(p: ItemMedia) {
    const actual = medias[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.media
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setMedias(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarGrafico() {
    if (grafico.evaluado || grafico.valor.trim() === '') return
    const correcto = Number(grafico.valor.trim()) === MEDIA_GRAFICO
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setGrafico(prev => ({ ...prev, evaluado: true, correcto }))
  }

  function comprobarModa() {
    if (moda.evaluado || moda.valor.trim() === '') return
    const correcto = Number(moda.valor.trim()) === MODA
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setModa(prev => ({ ...prev, evaluado: true, correcto }))
  }

  function comprobarSiNo() {
    if (siNo.evaluado || siNo.seleccion === null) return
    const correcto = siNo.seleccion === SI_NO.correcta
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setSiNo(prev => ({ ...prev, evaluado: true, correcto }))
  }

  function comprobarCompleta(p: PreguntaCompleta) {
    const actual = completa[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = p.aceptables.map(normalizarTexto).includes(normalizarTexto(actual.valor.trim()))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setCompleta(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setMedias(Object.fromEntries(MEDIAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
    setGrafico({ valor: '', evaluado: false, correcto: false })
    setModa({ valor: '', evaluado: false, correcto: false })
    setSiNo({ seleccion: null, evaluado: false, correcto: false })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #475569 0%, #cbd5e1 35%, #f8fafc 100%)',
      color: '#1e293b', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #475569, #1e293b)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #0f172a', borderBottom: '4px solid #0f172a',
      }}>
        <BotonMenu href="/quinto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>💎📊</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #0f172a', margin: 0, color: 'white',
        }}>
          ¡Media y estadística!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Sumá, repartí en partes iguales y encontrá el promedio
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#475569" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem',
        }}>
          {MEDIAS.map((p, i) => (
            <TarjetaMedia key={p.numero} p={p} estado={medias[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setMedias(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarMedia(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <TarjetaGrafico estado={grafico} color={COLORES[2 % COLORES.length]}
            onCambiar={valor => setGrafico(prev => ({ ...prev, valor }))}
            onComprobar={comprobarGrafico} onExplicarEstado={reaccionarRickyExplicar} />
          <TarjetaModa estado={moda} color={COLORES[3 % COLORES.length]}
            onCambiar={valor => setModa(prev => ({ ...prev, valor }))}
            onComprobar={comprobarModa} onExplicarEstado={reaccionarRickyExplicar} />
          <TarjetaSiNo estado={siNo} color={COLORES[4 % COLORES.length]}
            onSeleccionar={valor => setSiNo(prev => (prev.evaluado ? prev : { ...prev, seleccion: valor }))}
            onComprobar={comprobarSiNo} onExplicarEstado={reaccionarRickyExplicar} />
        </div>

        <div style={{
          background: 'white', border: '3px solid #cbd5e1', boxShadow: '0 4px 0 rgba(15,23,42,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(15,23,42,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#1e293b' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#475569' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás la media y la estadística 🎮'
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

function FilaDatos({ datos, emoji }: { datos: number[]; emoji: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', margin: '0.5rem 0' }}>
      {datos.map((n, i) => (
        <div key={i} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem' }}>{emoji}</div>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{n}</div>
        </div>
      ))}
    </div>
  )
}

// Ejemplo resuelto — 4, 6, 8, distinto a los datos reales para no revelar
// ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const datos = [4, 6, 8]
  const media = datos.reduce((s, n) => s + n, 0) / datos.length

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
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: cuatro, seis y ocho. Sumo: 4 más 6 más 8 es 18. Divido entre 3 datos: 18 entre 3 es 6. La media es 6." tamano={32} />
      </div>

      <FilaDatos datos={datos} emoji="🪨" />

      <p style={{ textAlign: 'center', margin: '0.4rem 0' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e3a8a' }}>Media: </span>
        <span style={{
          padding: '0.2rem 0.7rem', borderRadius: 8, border: '2px solid #22c55e', background: '#dcfce7',
          color: '#16a34a', fontSize: '1.2rem', fontWeight: 800,
        }}>
          {media}
        </span>
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: '0.4rem 0 0' }}>
        Sumo: 4 + 6 + 8 = 18. Divido entre 3 datos: 18 ÷ 3 = 6.
      </p>
    </div>
  )
}

function TarjetaMedia({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemMedia
  estado: EstadoSimple
  color: string
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const suma = p.datos.reduce((s, n) => s + n, 0)

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && estado.valor.trim() !== '') onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s', textAlign: 'center',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <BotonEscuchar texto={`Sumá ${p.datos.join(', ')} y dividí entre ${p.datos.length} para hallar la media.`} tamano={32} />
      </div>

      <FilaDatos datos={p.datos} emoji={p.emoji} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>Media =</span>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 70, padding: '0.4rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
            background: '#f8fafc', color: '#1e293b', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
          }}
        />
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: estado.valor.trim() === '' ? 'default' : 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.media}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Sumo: ${p.datos.join(' + ')} = ${suma}. Divido entre ${p.datos.length} datos: ${suma} ÷ ${p.datos.length} = ${p.media}.`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function GraficoBarras() {
  const ALTURA_MAX = 90
  const EJE_MAX = 40
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '0.4rem', height: ALTURA_MAX + 20, padding: '0.5rem 0' }}>
        {GRAFICO.map((d, i) => {
          const h = (d.valor / EJE_MAX) * ALTURA_MAX
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, marginBottom: 2, color: '#1e293b' }}>{d.valor}</span>
              <div style={{ width: '65%', height: h, background: '#0ea5e9', borderRadius: '4px 4px 0 0' }} />
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textAlign: 'center', marginTop: 3, overflowWrap: 'break-word', color: '#1e293b' }}>{d.dia}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TarjetaGrafico({ estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  estado: EstadoSimple
  color: string
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const suma = GRAFICO.reduce((s, d) => s + d.valor, 0)

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && estado.valor.trim() !== '') onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          3
        </span>
        <p style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '0.95rem', flex: 1 }}>Bloques minados por día — calculá la media</p>
        <BotonEscuchar texto={`Bloques minados por día: ${GRAFICO.map(d => `${d.dia} ${d.valor}`).join(', ')}. Calculá la media.`} tamano={32} />
      </div>

      <GraficoBarras />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>Media =</span>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 70, padding: '0.4rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
            background: '#f8fafc', color: '#1e293b', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
          }}
        />
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: estado.valor.trim() === '' ? 'default' : 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${MEDIA_GRAFICO}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Sumo: ${GRAFICO.map(d => d.valor).join(' + ')} = ${suma}. Divido entre ${GRAFICO.length} días: ${suma} ÷ ${GRAFICO.length} = ${MEDIA_GRAFICO}.`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaModa({ estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  estado: EstadoSimple
  color: string
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && estado.valor.trim() !== '') onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          4
        </span>
        <p style={{ margin: 0, fontWeight: 800, color: '#1e293b', fontSize: '0.95rem', flex: 1 }}>Moda: el valor que más se repite</p>
        <BotonEscuchar texto={`Los valores son: ${DATOS_MODA.join(', ')}. ¿Cuál es la moda, el valor que más se repite?`} tamano={32} />
      </div>

      <FilaDatos datos={DATOS_MODA} emoji="🧑" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>Moda =</span>
        <input
          type="number"
          inputMode="numeric"
          value={estado.valor}
          disabled={estado.evaluado}
          onChange={e => onCambiar(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="?"
          style={{
            width: 70, padding: '0.4rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
            background: '#f8fafc', color: '#1e293b', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
          }}
        />
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: estado.valor.trim() === '' ? 'default' : 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${MODA}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`El ${MODA} aparece 3 veces, más que cualquier otro valor — por eso es la moda.`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaSiNo({ estado, color, onSeleccionar, onComprobar, onExplicarEstado }: {
  estado: EstadoSiNo
  color: string
  onSeleccionar: (valor: 'si' | 'no') => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color

  function boton(valor: 'si' | 'no', etiqueta: string, bg: string) {
    const marcada = estado.seleccion === valor
    let estilo: React.CSSProperties = { background: bg, opacity: marcada ? 1 : 0.55 }
    if (estado.evaluado) {
      if (valor === SI_NO.correcta) estilo = { background: '#22c55e', opacity: 1 }
      else if (marcada) estilo = { background: '#94a3b8', opacity: 0.6 }
      else estilo = { background: bg, opacity: 0.3 }
    }
    return (
      <button disabled={estado.evaluado} onClick={() => onSeleccionar(valor)} style={{
        ...estilo, padding: '0.6rem 1.6rem', borderRadius: 12, border: 'none', cursor: estado.evaluado ? 'default' : 'pointer',
        color: 'white', fontWeight: 800, fontSize: '1.05rem',
      }}>
        {etiqueta}
      </button>
    )
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s', textAlign: 'center',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          5
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🧰</span>
        <p style={{ margin: 0, textAlign: 'left', fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', flex: 1 }}>{SI_NO.pregunta}</p>
        <BotonEscuchar texto={SI_NO.pregunta} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'center', marginTop: '0.5rem' }}>
        {boton('si', 'SÍ', '#22c55e')}
        {boton('no', 'NO', '#ef4444')}
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.8rem' }}>
          <button onClick={onComprobar} disabled={estado.seleccion === null} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: estado.seleccion === null ? 'default' : 'pointer',
            background: estado.seleccion === null ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.seleccion === null ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: estado.seleccion === null ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ La respuesta correcta era NO'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={SI_NO.explicacion} onEstadoCambia={onExplicarEstado} />
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#cbd5e1'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f8fafc',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#1e293b' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 110, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #cbd5e1',
          background: 'white', color: '#1e293b', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b' }}>{p.despues}</span>
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
