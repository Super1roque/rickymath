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

// ── Datos de la actividad (basados en la hoja "Actividad 7 - Volumen").
// Las construcciones traen bloques ocultos marcados solo con líneas
// punteadas — contarlos de una imagen isométrica no se puede leer con
// confianza, así que las dimensiones (largo × ancho × alto) de las 6
// construcciones las confirmó el usuario a mano.

interface ItemVolumen {
  numero: number
  largo: number
  ancho: number
  alto: number
}

const ITEMS: ItemVolumen[] = [
  { numero: 1, largo: 5, ancho: 3, alto: 2 },
  { numero: 2, largo: 5, ancho: 4, alto: 3 },
  { numero: 3, largo: 6, ancho: 2, alto: 3 },
  { numero: 4, largo: 5, ancho: 4, alto: 4 },
  { numero: 5, largo: 8, ancho: 3, alto: 3 },
  { numero: 6, largo: 4, ancho: 4, alto: 3 },
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
    numero: 1, antes: 'El volumen se calcula largo × ancho ×', despues: '.',
    aceptables: ['alto'],
    lectura: 'El volumen se calcula largo por ancho por... ¿qué?',
    explicacion: 'El volumen de un prisma rectangular se calcula multiplicando largo × ancho × alto.',
  },
  {
    numero: 2, antes: 'Un cubo de lado 4 tiene', despues: 'bloques.',
    aceptables: ['64'],
    lectura: '¿Cuántos bloques tiene un cubo de lado cuatro?',
    explicacion: 'Un cubo de lado 4 tiene 4 × 4 × 4 = 64 bloques.',
  },
  {
    numero: 3, antes: 'El volumen se mide en unidades', despues: '(cúbicas / cuadradas).',
    aceptables: ['cubicas'],
    lectura: 'El volumen se mide en unidades cúbicas o cuadradas, ¿cuál es?',
    explicacion: 'El volumen ocupa un espacio en tres dimensiones, así que se mide en unidades cúbicas (como bloques³) — las unidades cuadradas son para medir área.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoItem { largo: string; ancho: string; alto: string; volumen: string; evaluado: boolean; correcto: boolean }
interface EstadoCompleta { valor: string; evaluado: boolean; correcto: boolean }

export default function QuintoModulo07() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { largo: '', ancho: '', alto: '', volumen: '', evaluado: false, correcto: false }])),
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'quinto-modulo-07', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: ItemVolumen) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.largo.trim() === '' || actual.ancho.trim() === '' || actual.alto.trim() === '' || actual.volumen.trim() === '') return
    const volumenReal = p.largo * p.ancho * p.alto
    const correcto = Number(actual.largo.trim()) === p.largo && Number(actual.ancho.trim()) === p.ancho
      && Number(actual.alto.trim()) === p.alto && Number(actual.volumen.trim()) === volumenReal
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { largo: '', ancho: '', alto: '', volumen: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #c2410c 0%, #fdba74 35%, #fff7ed 100%)',
      color: '#7c2d12', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <style>{`
        .gj-input-digito::-webkit-outer-spin-button,
        .gj-input-digito::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .gj-input-digito { -moz-appearance: textfield; }
      `}</style>
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #c2410c, #7c2d12)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #431407', borderBottom: '4px solid #431407',
      }}>
        <BotonMenu href="/quinto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🧱📦</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #431407', margin: 0, color: 'white',
        }}>
          ¡Volumen!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Contá los bloques de cada construcción — ¡no olvides los que no se ven!
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#c2410c" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaVolumen key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={(campo, valor) => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], [campo]: valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #fdba74', boxShadow: '0 4px 0 rgba(67,20,7,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7c2d12' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(67,20,7,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#7c2d12' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#c2410c' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás el volumen 🎮'
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

// Construcción isométrica de verdad — tres caras (arriba, frente, lado)
// dibujadas con una transformación afín (matrix), no con clip-path, para
// que la cuadrícula de bloques de cada cara se incline junto con la cara
// y se vea como un cubo real armado con bloques, del mismo tamaño exacto
// que largo × ancho × alto.
function CuboIsometrico({ largo, ancho, alto, color }: { largo: number; ancho: number; alto: number; color: string }) {
  const u = 13
  const L = largo * u, A = ancho * u, H = alto * u, D = A * 0.5
  const anchoContenedor = L + D, altoContenedor = H + D
  const cuadricula = {
    backgroundImage:
      'linear-gradient(to right, rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.3) 1px, transparent 1px)',
    backgroundSize: `${u}px ${u}px`,
  }
  const borde = { border: '1px solid rgba(0,0,0,0.35)' }

  return (
    <div style={{ position: 'relative', width: anchoContenedor, height: altoContenedor, margin: '0.5rem auto' }}>
      {/* cara de arriba */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: L, height: A, background: color,
        ...cuadricula, ...borde, filter: 'brightness(1.35)', transformOrigin: '0 0',
        transform: `matrix(1, 0, 0.5, -0.5, 0, ${D})`,
      }} />
      {/* cara lateral */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: A, height: H, background: color,
        ...cuadricula, ...borde, filter: 'brightness(0.65)', transformOrigin: '0 0',
        transform: `matrix(0.5, -0.5, 0, 1, ${L}, ${D})`,
      }} />
      {/* cara de frente */}
      <div style={{
        position: 'absolute', left: 0, top: D, width: L, height: H, background: color,
        ...cuadricula, ...borde,
      }} />
    </div>
  )
}

// Ejemplo resuelto — 3×2×2, distinto a las 6 construcciones reales para no
// revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const largo = 3, ancho = 2, alto = 2, volumen = largo * ancho * alto

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
        <BotonEscuchar texto="Ejemplo: una construcción de largo 3, ancho 2 y alto 2. El volumen es 3 por 2 por 2, que da 12 bloques cúbicos." tamano={32} />
      </div>

      <CuboIsometrico largo={largo} ancho={ancho} alto={alto} color={color} />

      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: '#1e3a8a', margin: '0.5rem 0 0.3rem' }}>
        largo {largo} × ancho {ancho} × alto {alto}
      </p>
      <p style={{ textAlign: 'center', margin: '0.3rem 0 0' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e3a8a' }}>V = </span>
        <span style={{
          padding: '0.2rem 0.7rem', borderRadius: 8, border: '2px solid #22c55e', background: '#dcfce7',
          color: '#16a34a', fontSize: '1.2rem', fontWeight: 800,
        }}>
          {volumen}
        </span>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e3a8a' }}> bloques³</span>
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: '0.7rem 0 0' }}>
        Volumen = largo × ancho × alto = 3 × 2 × 2 = 12 bloques³.
      </p>
    </div>
  )
}

type CampoItem = 'largo' | 'ancho' | 'alto' | 'volumen'

function TarjetaVolumen({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemVolumen
  estado: EstadoItem
  color: string
  onCambiar: (campo: CampoItem, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const faltan = [estado.largo, estado.ancho, estado.alto, estado.volumen].some(v => v.trim() === '')
  const volumenReal = p.largo * p.ancho * p.alto

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !faltan) onComprobar()
  }

  const campoEstilo = {
    width: 44, padding: '0.3rem', borderRadius: 8, border: `2px solid ${bordeColor}55`,
    background: '#fff7ed', color: '#7c2d12', fontSize: '1rem', fontWeight: 700, textAlign: 'center' as const,
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem', transition: 'border-color 0.2s',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🧱</span>
        <p style={{ margin: 0, flex: 1, fontWeight: 700, color: '#7c2d12', fontSize: '0.9rem' }}>Contá los bloques (¡también los que no se ven!)</p>
        <BotonEscuchar texto="Contá los bloques de esta construcción, incluidos los que no se ven, y calculá el volumen." tamano={32} />
      </div>

      <CuboIsometrico largo={p.largo} ancho={p.ancho} alto={p.alto} color={color} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c2d12' }}>largo</span>
        <input type="number" inputMode="numeric" className="gj-input-digito" value={estado.largo} disabled={estado.evaluado}
          onChange={e => onCambiar('largo', e.target.value)} onKeyDown={handleKeyDown} placeholder="?" style={campoEstilo} />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c2d12' }}>× ancho</span>
        <input type="number" inputMode="numeric" className="gj-input-digito" value={estado.ancho} disabled={estado.evaluado}
          onChange={e => onCambiar('ancho', e.target.value)} onKeyDown={handleKeyDown} placeholder="?" style={campoEstilo} />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c2d12' }}>× alto</span>
        <input type="number" inputMode="numeric" className="gj-input-digito" value={estado.alto} disabled={estado.evaluado}
          onChange={e => onCambiar('alto', e.target.value)} onKeyDown={handleKeyDown} placeholder="?" style={campoEstilo} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#7c2d12' }}>V =</span>
        <input type="number" inputMode="numeric" className="gj-input-digito" value={estado.volumen} disabled={estado.evaluado}
          onChange={e => onCambiar('volumen', e.target.value)} onKeyDown={handleKeyDown} placeholder="?"
          style={{ ...campoEstilo, width: 60 }} />
        <span style={{ fontSize: '1rem', fontWeight: 800, color: '#7c2d12' }}>bloques³</span>
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
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.largo} × ${p.ancho} × ${p.alto} = ${volumenReal}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Las dimensiones son largo ${p.largo}, ancho ${p.ancho}, alto ${p.alto}. Volumen = ${p.largo} × ${p.ancho} × ${p.alto} = ${volumenReal} bloques³.`} onEstadoCambia={onExplicarEstado} />
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#fdba74'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fff7ed',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#7c2d12' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #fdba74',
          background: 'white', color: '#7c2d12', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#7c2d12' }}>{p.despues}</span>
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
