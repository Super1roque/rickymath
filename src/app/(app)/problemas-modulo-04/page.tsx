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
import { useAuth } from '@/contexts/AuthContext'
import { usePerfil } from '@/contexts/PerfilContext'
import { guardarProgresoModulo } from '@/lib/progreso'
import CandadoPremium from '@/components/guia/CandadoPremium'

// ── Datos de la actividad (basados en la hoja "Misión 04 - Repartir el
// botín", serie "Problemas"). Todos los ítems son repartos en partes
// iguales (división). El ítem 40 no es exacto, así que pide dos
// respuestas: cuánto le toca a cada uno y cuánto sobra — igual que en la
// hoja. La numeración sigue de la misión 3 (31 a 40).

interface Problema {
  numero: number
  emoji: string
  enunciado: string
  lectura: string
  resultado: number
  resto?: number
  explicacion: string
}

const PROBLEMAS: Problema[] = [
  {
    numero: 31, emoji: '💎', resultado: 8,
    enunciado: 'Repartí 24 diamantes entre 3 amigos. ¿Cuántos diamantes recibe cada uno?',
    lectura: 'Repartí veinticuatro diamantes entre tres amigos. ¿Cuántos diamantes recibe cada uno?',
    explicacion: 'Divido: 24 ÷ 3 = 8.',
  },
  {
    numero: 32, emoji: '💚', resultado: 9,
    enunciado: 'Repartí 36 esmeraldas entre 4 jugadores. ¿Cuántas esmeraldas recibe cada uno?',
    lectura: 'Repartí treinta y seis esmeraldas entre cuatro jugadores. ¿Cuántas esmeraldas recibe cada uno?',
    explicacion: 'Divido: 36 ÷ 4 = 9.',
  },
  {
    numero: 33, emoji: '🍎', resultado: 8,
    enunciado: 'Repartí 48 manzanas entre 6 jugadores. ¿Cuántas manzanas recibe cada uno?',
    lectura: 'Repartí cuarenta y ocho manzanas entre seis jugadores. ¿Cuántas manzanas recibe cada uno?',
    explicacion: 'Divido: 48 ÷ 6 = 8.',
  },
  {
    numero: 34, emoji: '🔥', resultado: 6,
    enunciado: 'Repartí 60 antorchas entre 10 exploradores. ¿Cuántas antorchas recibe cada uno?',
    lectura: 'Repartí sesenta antorchas entre diez exploradores. ¿Cuántas antorchas recibe cada uno?',
    explicacion: 'Divido: 60 ÷ 10 = 6.',
  },
  {
    numero: 35, emoji: '🍪', resultado: 6,
    enunciado: 'Repartí 54 galletas entre 9 amigos. ¿Cuántas galletas recibe cada uno?',
    lectura: 'Repartí cincuenta y cuatro galletas entre nueve amigos. ¿Cuántas galletas recibe cada uno?',
    explicacion: 'Divido: 54 ÷ 9 = 6.',
  },
  {
    numero: 36, emoji: '🪙', resultado: 9,
    enunciado: 'Repartí 72 lingotes de oro entre 8 cofres. ¿Cuántos lingotes recibe cada cofre?',
    lectura: 'Repartí setenta y dos lingotes de oro entre ocho cofres. ¿Cuántos lingotes recibe cada cofre?',
    explicacion: 'Divido: 72 ÷ 8 = 9.',
  },
  {
    numero: 37, emoji: '🍞', resultado: 9,
    enunciado: 'Repartí 81 panes entre 9 aldeanos. ¿Cuántos panes recibe cada uno?',
    lectura: 'Repartí ochenta y uno panes entre nueve aldeanos. ¿Cuántos panes recibe cada uno?',
    explicacion: 'Divido: 81 ÷ 9 = 9.',
  },
  {
    numero: 38, emoji: '🏹', resultado: 18,
    enunciado: 'Repartí 90 flechas entre 5 arqueros. ¿Cuántas flechas recibe cada uno?',
    lectura: 'Repartí noventa flechas entre cinco arqueros. ¿Cuántas flechas recibe cada uno?',
    explicacion: 'Divido: 90 ÷ 5 = 18.',
  },
  {
    numero: 39, emoji: '⬜', resultado: 8,
    enunciado: 'Repartí 64 bloques de hierro entre 8 constructores. ¿Cuántos bloques recibe cada uno?',
    lectura: 'Repartí sesenta y cuatro bloques de hierro entre ocho constructores. ¿Cuántos bloques recibe cada uno?',
    explicacion: 'Divido: 64 ÷ 8 = 8.',
  },
  {
    numero: 40, emoji: '🟥', resultado: 12, resto: 5,
    enunciado: 'Repartí 77 redstone entre 6 jugadores. ¿Cuánto recibe cada uno y cuánto sobra?',
    lectura: 'Repartí setenta y siete redstone entre seis jugadores. ¿Cuánto recibe cada uno y cuánto sobra?',
    explicacion: 'Divido: 77 ÷ 6 = 12 y sobran 5, porque 12 × 6 = 72 y 77 − 72 = 5.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

// ── Bloque de estado ──

interface EstadoItem { valor: string; valor2: string; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo04() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', valor2: '', evaluado: false, correcto: false }])),
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'problemas-modulo-04', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: Problema) {
    const actual = items[p.numero]
    if (actual.evaluado) return
    if (p.resto !== undefined) {
      if (actual.valor.trim() === '' || actual.valor2.trim() === '') return
      const correcto = Number(actual.valor.trim()) === p.resultado && Number(actual.valor2.trim()) === p.resto
      if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
      registrarResultado(correcto)
      reaccionarRicky(correcto)
      setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
      return
    }
    if (actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.resultado
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', valor2: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #4338ca 0%, #a5b4fc 35%, #eef2ff 100%)',
      color: '#1e1b4b', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #4338ca, #1e1b4b)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #1e1b4b', borderBottom: '4px solid #1e1b4b',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🐺⚖️</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #1e1b4b', margin: 0, color: 'white',
        }}>
          Misión 04: Repartir el botín
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Reparte en partes iguales — ¡sin trampas!
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

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onCambiar2={valor2 => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor2 } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
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
            border: '3px solid #4338ca', boxShadow: '0 5px 0 rgba(67,56,202,0.2)', borderRadius: 20, padding: '1.75rem 1.5rem',
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
                ? '🎉 ¡Misión completada! Repartiste todo el botín sin trampas 🏆'
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

// Ejemplo resuelto — flores y macetas, distinto a los 10 ítems reales
// para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#0ea5e9'
  const enunciado = 'Repartí 20 flores entre 5 macetas. ¿Cuántas flores recibe cada maceta?'
  const resultado = 4

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🌼</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: repartí veinte flores entre cinco macetas. ¿Cuántas flores recibe cada maceta? Divido 20 entre 5, que es 4." tamano={32} />
      </div>

      <p style={{ fontSize: '0.9rem', margin: '0 0 0.7rem', color: '#0c4a6e', fontWeight: 600 }}>{enunciado}</p>

      <p style={{ textAlign: 'center', margin: 0 }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0c4a6e' }}>R: </span>
        <span style={{
          padding: '0.2rem 0.7rem', borderRadius: 8, border: '2px solid #22c55e', background: '#dcfce7',
          color: '#16a34a', fontSize: '1.2rem', fontWeight: 800,
        }}>
          {resultado}
        </span>
      </p>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#0c4a6e', opacity: 0.85, margin: '0.7rem 0 0' }}>
        Divido en partes iguales: 20 ÷ 5 = 4.
      </p>
    </div>
  )
}

function TarjetaProblema({ p, estado, color, onCambiar, onCambiar2, onComprobar, onExplicarEstado }: {
  p: Problema
  estado: EstadoItem
  color: string
  onCambiar: (valor: string) => void
  onCambiar2: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const conResto = p.resto !== undefined
  const listo = conResto ? estado.valor.trim() !== '' && estado.valor2.trim() !== '' : estado.valor.trim() !== ''

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && listo) onComprobar()
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
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem',
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.emoji}</span>
        <BotonEscuchar texto={p.lectura} tamano={32} />
      </div>

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#1e1b4b', fontWeight: 600 }}>{p.enunciado}</p>

      {conResto ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e1b4b', width: 92, textAlign: 'right' }}>Cada uno:</span>
            <input
              type="number"
              inputMode="numeric"
              value={estado.valor}
              disabled={estado.evaluado}
              onChange={e => onCambiar(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 70, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
                background: '#eef2ff', color: '#1e1b4b', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e1b4b', width: 92, textAlign: 'right' }}>Sobran:</span>
            <input
              type="number"
              inputMode="numeric"
              value={estado.valor2}
              disabled={estado.evaluado}
              onChange={e => onCambiar2(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 70, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
                background: '#eef2ff', color: '#1e1b4b', fontSize: '1.1rem', fontWeight: 800, textAlign: 'center',
              }}
            />
            {!estado.evaluado && (
              <button onClick={onComprobar} disabled={!listo} style={{
                padding: '0.5rem 0.9rem', borderRadius: 10, border: 'none', cursor: listo ? 'pointer' : 'default',
                background: listo ? '#22c55e' : '#e2e8f0',
                boxShadow: listo ? '0 3px 0 #15803d' : 'none',
                color: 'white', fontWeight: 800, fontSize: '1rem', opacity: listo ? 1 : 0.7,
              }}>
                ✓
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e1b4b' }}>R:</span>
          <input
            type="number"
            inputMode="numeric"
            value={estado.valor}
            disabled={estado.evaluado}
            onChange={e => onCambiar(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="?"
            style={{
              width: 80, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
              background: '#eef2ff', color: '#1e1b4b', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
            }}
          />
          {!estado.evaluado && (
            <button onClick={onComprobar} disabled={!listo} style={{
              padding: '0.5rem 0.9rem', borderRadius: 10, border: 'none', cursor: listo ? 'pointer' : 'default',
              background: listo ? '#22c55e' : '#e2e8f0',
              boxShadow: listo ? '0 3px 0 #15803d' : 'none',
              color: 'white', fontWeight: 800, fontSize: '1rem', opacity: listo ? 1 : 0.7,
            }}>
              ✓
            </button>
          )}
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto
              ? '✅ ¡Correcto!'
              : conResto
              ? `❌ Era ${p.resultado} y sobran ${p.resto}`
              : `❌ Era ${p.resultado}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
