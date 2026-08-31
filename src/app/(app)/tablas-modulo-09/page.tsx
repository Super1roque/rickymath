'use client'

import { useEffect, useMemo, useState, useRef, type KeyboardEvent } from 'react'
import { reproducirCorrecto, reproducirIncorrecto, reproducirFanfarria } from '@/lib/guiaAudio'
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

// ── Datos de la actividad (basados en la hoja "Tabla del 9", serie bonus
// "Tablas de Multiplicar"). La hoja trae la tabla completa (9×1 a 9×10) ya
// resuelta como referencia visual — no es una clave a ocultar, es la
// lección en sí. Solo la sección "Ahora tú" (5 cuentas sueltas) es la
// parte que el chico completa y la app corrige.

const BASE = 9
const COLOR = '#dc2626'

const TABLA = Array.from({ length: 10 }, (_, i) => ({ n: i + 1, resultado: BASE * (i + 1) }))

const TRUCO = '¡Magia del 9! Las decenas suben de 1 en 1 y las unidades bajan de 1 en 1: 09, 18, 27, 36... Y los dos dígitos siempre suman 9.'

interface ItemPractica {
  numero: number
  n: number
  resultado: number
}

const PRACTICA: ItemPractica[] = [
  { numero: 1, n: 3, resultado: BASE * 3 },
  { numero: 2, n: 6, resultado: BASE * 6 },
  { numero: 3, n: 8, resultado: BASE * 8 },
  { numero: 4, n: 4, resultado: BASE * 4 },
  { numero: 5, n: 7, resultado: BASE * 7 },
]

const TOTAL_PREGUNTAS = PRACTICA.length

// ── Bloque de estado ──

interface EstadoItem { valor: string; evaluado: boolean; correcto: boolean }

export default function TablasModulo09() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PRACTICA.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
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

  const totalCorrectas = useMemo(() => Object.values(items).filter(e => e.evaluado && e.correcto).length, [items])
  const totalEvaluadas = useMemo(() => Object.values(items).filter(e => e.evaluado).length, [items])
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'tablas-modulo-09', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: ItemPractica) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.resultado
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(PRACTICA.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #dc2626 0%, #fca5a5 35%, #fef2f2 100%)',
      color: '#7f1d1d', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #dc2626, #7f1d1d)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #450a0a', borderBottom: '4px solid #450a0a',
      }}>
        <BotonMenu href="/tablas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🦊9️⃣</div>
        <h1 style={{
          fontSize: 'clamp(1.4rem, 5.5vw, 2.4rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #450a0a', margin: 0, color: 'white',
        }}>
          ¡Tabla del 9!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Aprendé la tabla y después practicá vos
        </p>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1rem' }}>
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#dc2626" />
          </div>
        </div>

        <TablaReferencia />
        <CajaTruco />

        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '1.5rem 0 1rem', textAlign: 'center', color: '#7f1d1d' }}>
          ✏️ Ahora vos
        </h2>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '2rem',
        }}>
          {PRACTICA.map(p => (
            <TarjetaPractica key={p.numero} p={p} estado={items[p.numero]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(69,10,10,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#7f1d1d' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#dc2626' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás la tabla del 9 🎮'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi la dominás.'
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

// Fila de bloques contables — un cuadradito por unidad, hasta 90, para que
// se vea como en la hoja (manzanas con el "9" adentro) sin depender de
// imágenes.
function FilaBloques({ cantidad }: { cantidad: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} style={{
          width: 9, height: 9, borderRadius: 3, background: COLOR, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.36rem', fontWeight: 800,
          border: `1px solid ${COLOR}`, flexShrink: 0,
        }}>
          {BASE}
        </div>
      ))}
    </div>
  )
}

// Tabla de referencia — no se evalúa, es la lección completa (igual que en
// la hoja), con un botón de audio para escuchar toda la tabla.
function TablaReferencia() {
  const lectura = TABLA.map(f => `${BASE} por ${f.n} es ${f.resultado}`).join('. ')
  return (
    <div style={{
      background: 'white', border: `3px solid ${COLOR}`, boxShadow: `0 4px 0 ${COLOR}55`,
      borderRadius: 18, padding: '1rem', marginBottom: '1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{ fontSize: '1.3rem' }}>📖</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, color: '#7f1d1d' }}>La tabla del {BASE}</p>
        <BotonEscuchar texto={lectura} tamano={32} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {TABLA.map(f => (
          <div key={f.n} style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.2rem',
            borderBottom: '1px dashed #fecaca',
          }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#7f1d1d', width: 78, flexShrink: 0 }}>
              {BASE} × {f.n} =
            </span>
            <div style={{ flex: 1, overflowX: 'auto' }}>
              <FilaBloques cantidad={f.resultado} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: COLOR, width: 34, textAlign: 'right', flexShrink: 0 }}>
              {f.resultado}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CajaTruco() {
  return (
    <div style={{
      background: '#fef2f2', border: `3px dashed ${COLOR}`, borderRadius: 18, padding: '1rem',
      marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
    }}>
      <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>💡</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 0.2rem', fontWeight: 800, color: '#7f1d1d', fontSize: '0.95rem' }}>Truco</p>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#7f1d1d', fontWeight: 600 }}>{TRUCO}</p>
      </div>
      <BotonEscuchar texto={TRUCO} tamano={32} />
    </div>
  )
}

function TarjetaPractica({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: ItemPractica
  estado: EstadoItem
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : COLOR

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && estado.valor.trim() !== '') onComprobar()
  }

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '0.85rem', textAlign: 'center',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 0.5rem', color: '#7f1d1d' }}>
        {BASE} × {p.n} =
      </p>

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
          background: '#fef2f2', color: '#7f1d1d', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
        }}
      />

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem' }}>
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.45rem 1rem', borderRadius: 12, border: 'none', cursor: estado.valor.trim() === '' ? 'default' : 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.9rem', opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Bien!' : `❌ Era ${p.resultado}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.3rem' }}>
            <BotonExplicar texto={`${BASE} × ${p.n} = ${p.resultado}. ${TRUCO}`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
