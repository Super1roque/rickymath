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

// ── Datos de la actividad (basados en la hoja "Actividad 3 - Múltiplos").
// La rana salta siempre igual, pero los números bajo los nenúfares mezclan
// saltos reales con "trampas" que no son múltiplos — confirmado a mano con
// el usuario: la tarea es marcar SOLO los números que sí son múltiplos
// (ítem 1 y 3 terminan en 40, que no es múltiplo de 3 ni de 6; ítem 4 mete
// el 29, que no es múltiplo de 9, antes del 27 real). El ítem 5 ("Mixta")
// ya es puros múltiplos de 2 — ahí la tarea es marcar cuáles son TAMBIÉN
// múltiplos de 5.

interface ItemMultiplo {
  numero: number
  titulo: string
  base: number
  numeros: number[]
  color: string
}

const ITEMS: ItemMultiplo[] = [
  { numero: 1, titulo: 'Múltiplos de 3', base: 3, numeros: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 40], color: '#22c55e' },
  { numero: 2, titulo: 'Múltiplos de 4', base: 4, numeros: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40], color: '#a855f7' },
  { numero: 3, titulo: 'Múltiplos de 6', base: 6, numeros: [0, 6, 12, 18, 24, 30, 36, 40], color: '#dc2626' },
  { numero: 4, titulo: 'Múltiplos de 9', base: 9, numeros: [0, 9, 18, 29, 27, 36, 40], color: '#2563eb' },
  { numero: 5, titulo: 'Mixta (múltiplos de 2 y de 5)', base: 5, numeros: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 34, 36, 38, 40], color: '#0d9488' },
]

function instruccion(item: ItemMultiplo): string {
  return item.numero === 5
    ? `Esta fila ya son puros saltos de 2 en 2. Marcá los que TAMBIÉN son múltiplos de 5.`
    : `Marcá solo los números que SÍ son múltiplos de ${item.base} — algunos son trampa.`
}

function explicacionItem(item: ItemMultiplo): string {
  const correctos = item.numeros.filter(n => n % item.base === 0)
  const trampas = item.numeros.filter(n => n % item.base !== 0)
  const base = item.numero === 5 ? 'de 5' : `de ${item.base}`
  const trampaTexto = trampas.length > 0 ? ` ${trampas.join(' y ')} no ${trampas.length > 1 ? 'lo son' : 'lo es'} — ${trampas.length > 1 ? 'son' : 'es'} la trampa.` : ''
  return `Los múltiplos ${base} en esta fila son: ${correctos.join(', ')}.${trampaTexto}`
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
    numero: 2, antes: 'El primer múltiplo de 6 después del 12 es', despues: '.',
    aceptables: ['18'],
    lectura: '¿Cuál es el primer múltiplo de 6 después del doce?',
    explicacion: 'Los múltiplos de 6 son 6, 12, 18, 24... El que sigue justo después del 12 es el 18.',
  },
  {
    numero: 3, antes: 'El 20 es múltiplo de 2 y también de', despues: '.',
    aceptables: ['5'],
    lectura: 'El veinte es múltiplo de dos, ¿y también de qué otro número?',
    explicacion: 'El 20 es múltiplo de 2 (2 × 10 = 20) y también de 5 (5 × 4 = 20) — por eso apareció en la fila mixta de múltiplos de 2 y de 5.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoItem { marcados: boolean[]; evaluado: boolean; correcto: boolean }
interface EstadoCompleta { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoDoble { a: string; b: string; evaluado: boolean; correcto: boolean }

export default function CuartoModulo03() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { marcados: p.numeros.map(() => false), evaluado: false, correcto: false }])),
  )
  const [doble, setDoble] = useState<EstadoDoble>({ a: '', b: '', evaluado: false, correcto: false })
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
    const b = doble.evaluado && doble.correcto ? 1 : 0
    const c = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return a + b + c
  }, [items, doble, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(items).filter(e => e.evaluado).length
    const b = doble.evaluado ? 1 : 0
    const c = Object.values(completa).filter(e => e.evaluado).length
    return a + b + c
  }, [items, doble, completa])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'cuarto-modulo-03', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: ItemMultiplo) {
    const actual = items[p.numero]
    if (actual.evaluado) return
    const correcto = actual.marcados.every((m, i) => m === (p.numeros[i] % p.base === 0))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function comprobarDoble() {
    if (doble.evaluado || doble.a.trim() === '' || doble.b.trim() === '') return
    const aceptables = ['ese numero', 'el mismo numero', 'el numero']
    const correcto = aceptables.includes(normalizarTexto(doble.a)) && aceptables.includes(normalizarTexto(doble.b))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setDoble(prev => ({ ...prev, evaluado: true, correcto }))
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { marcados: p.numeros.map(() => false), evaluado: false, correcto: false }])))
    setDoble({ a: '', b: '', evaluado: false, correcto: false })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #16a34a 0%, #bbf7d0 35%, #ecfccb 100%)',
      color: '#14532d', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #16a34a, #15803d)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #14532d', borderBottom: '4px solid #14532d',
      }}>
        <BotonMenu href="/cuarto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🐸🪷</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #14532d', margin: 0, color: 'white',
        }}>
          ¡Múltiplos!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          La rana salta siempre igual — marcá los múltiplos en su camino
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#16a34a" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {ITEMS.map(p => (
            <TarjetaMultiplo key={p.numero} p={p} estado={items[p.numero]}
              onToggle={i => setItems(prev => {
                if (prev[p.numero].evaluado) return prev
                const marcados = [...prev[p.numero].marcados]
                marcados[i] = !marcados[i]
                return { ...prev, [p.numero]: { ...prev[p.numero], marcados } }
              })}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #86efac', boxShadow: '0 4px 0 rgba(20,83,45,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#14532d' }}>
            📖 Completá
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <FilaCompletaDoble estado={doble}
              onCambiarA={valor => setDoble(prev => ({ ...prev, a: valor }))}
              onCambiarB={valor => setDoble(prev => ({ ...prev, b: valor }))}
              onComprobar={comprobarDoble} onExplicarEstado={reaccionarRickyExplicar} />
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(20,83,45,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#14532d' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#16a34a' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás los múltiplos 🎮'
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

function ChipNumero({ n, marcado, evaluado, esperado, color, onClick }: {
  n: number; marcado: boolean; evaluado: boolean; esperado: boolean; color: string; onClick: () => void
}) {
  let bg = 'white', borde = color, textColor = color
  let icono = ''
  if (!evaluado) {
    if (marcado) { bg = color; textColor = 'white' }
  } else if (esperado && marcado) {
    bg = '#dcfce7'; borde = '#22c55e'; textColor = '#16a34a'; icono = ' ✓'
  } else if (!esperado && !marcado) {
    bg = '#f8fafc'; borde = '#cbd5e1'; textColor = '#94a3b8'
  } else {
    bg = '#fee2e2'; borde = '#ef4444'; textColor = '#dc2626'; icono = ' ✗'
  }

  return (
    <button onClick={onClick} disabled={evaluado} style={{
      padding: '0.4rem 0.7rem', borderRadius: 999, border: `2px solid ${borde}`,
      background: bg, color: textColor, fontWeight: 800, fontSize: '0.9rem',
      cursor: evaluado ? 'default' : 'pointer', flexShrink: 0,
    }}>
      {n}{icono}
    </button>
  )
}

// Ejemplo resuelto — no interactivo, con una tabla distinta (múltiplos de
// 7) a las 5 filas de la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const base = 7
  const numeros = [0, 7, 14, 20, 21, 28, 30]
  const correctos = numeros.filter(n => n % base === 0)
  const trampas = numeros.filter(n => n % base !== 0)

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
        <span style={{ fontSize: '1.3rem' }}>🐸</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>Múltiplos de 7</p>
        <BotonEscuchar texto={`Ejemplo: marcá solo los múltiplos de 7. Los múltiplos de 7 son ${correctos.join(', ')}. ${trampas.join(' y ')} no lo son — son la trampa.`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {numeros.map((n, i) => {
          const esperado = n % base === 0
          return (
            <span key={i} style={{
              padding: '0.4rem 0.7rem', borderRadius: 999, fontWeight: 800, fontSize: '0.9rem',
              border: `2px solid ${esperado ? '#22c55e' : '#cbd5e1'}`,
              background: esperado ? '#dcfce7' : '#f8fafc',
              color: esperado ? '#16a34a' : '#94a3b8',
            }}>
              {n}{esperado ? ' ✓' : ''}
            </span>
          )
        })}
      </div>
      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: 0 }}>
        Los múltiplos de 7 son {correctos.join(', ')}. El {trampas.join(' y el ')} no {trampas.length > 1 ? 'lo son' : 'lo es'} — son la trampa de la rana.
      </p>
    </div>
  )
}

function TarjetaMultiplo({ p, estado, onToggle, onComprobar, onExplicarEstado }: {
  p: ItemMultiplo
  estado: EstadoItem
  onToggle: (indice: number) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : p.color

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
          width: 30, height: 30, borderRadius: 999, background: p.color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🐸</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, minWidth: 0, color: '#14532d' }}>{p.titulo}</p>
        <BotonEscuchar texto={instruccion(p)} tamano={32} />
      </div>

      <p style={{ fontSize: '0.85rem', margin: '0 0 0.6rem', fontWeight: 600, color: '#14532d', opacity: 0.8 }}>{instruccion(p)}</p>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        {p.numeros.map((n, i) => (
          <ChipNumero key={i} n={n} marcado={estado.marcados[i]} evaluado={estado.evaluado}
            esperado={n % p.base === 0} color={p.color} onClick={() => onToggle(i)} />
        ))}
      </div>

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={onComprobar} style={{
            padding: '0.55rem 1.4rem', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: '#22c55e', boxShadow: '0 3px 0 #15803d', color: 'white', fontWeight: 800, fontSize: '1rem',
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ Revisá las marcas'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={explicacionItem(p)} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function FilaCompletaDoble({ estado, onCambiarA, onCambiarB, onComprobar, onExplicarEstado }: {
  estado: EstadoDoble
  onCambiarA: (valor: string) => void
  onCambiarB: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#86efac'
  const listo = estado.a.trim() !== '' && estado.b.trim() !== ''

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0fdf4',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto="Los múltiplos de un número son sus saltos de... ¿de qué en qué?" />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>1. Los múltiplos de un número son sus saltos de</span>
      <input
        value={estado.a}
        disabled={estado.evaluado}
        onChange={e => onCambiarA(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 110, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #86efac',
          background: 'white', color: '#14532d', fontSize: '1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>en</span>
      <input
        value={estado.b}
        disabled={estado.evaluado}
        onChange={e => onCambiarB(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 110, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #86efac',
          background: 'white', color: '#14532d', fontSize: '1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>.</span>
      {!estado.evaluado ? (
        <button onClick={onComprobar} disabled={!listo} style={{
          marginLeft: 'auto', padding: '0.45rem 0.9rem', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: !listo ? '#e2e8f0' : '#22c55e',
          boxShadow: !listo ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1.05rem',
          opacity: !listo ? 0.7 : 1,
        }}>
          ✓
        </button>
      ) : (
        <>
          <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅' : '❌ (ese número)'}
          </span>
          <BotonExplicar texto="Los múltiplos de un número se forman dando saltos de ese número en ese número — por ejemplo, los múltiplos de 3 son saltos de 3 en 3: 0, 3, 6, 9..." onEstadoCambia={onExplicarEstado} />
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#86efac'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#f0fdf4',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#14532d' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #86efac',
          background: 'white', color: '#14532d', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>{p.despues}</span>
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
