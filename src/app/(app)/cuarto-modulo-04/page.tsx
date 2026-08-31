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

// ── Datos de la actividad (basados en la hoja "Actividad 4 - Divisores").
// La hoja trae las listas de divisores ya impresas — igual que en
// operaciones combinadas, se convierten en chips en blanco que el chico
// marca (1..N) y la app corrige contra el conjunto real de divisores, en
// vez de mostrarlas ya resueltas.

interface ItemDivisor {
  numero: number
  valor: number
}

const ITEMS: ItemDivisor[] = [
  { numero: 1, valor: 12 },
  { numero: 2, valor: 8 },
  { numero: 3, valor: 15 },
  { numero: 4, valor: 20 },
  { numero: 5, valor: 7 },
  { numero: 6, valor: 18 },
  { numero: 7, valor: 9 },
  { numero: 8, valor: 24 },
  { numero: 9, valor: 11 },
]

function divisoresDe(n: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d)
  return out
}

function esPrimo(n: number): boolean {
  return divisoresDe(n).length === 2
}

function explicacionItem(n: number): string {
  const divisores = divisoresDe(n)
  const primo = esPrimo(n)
  return `Los divisores de ${n} son: ${divisores.join(', ')}.` + (primo ? ` Como ${n} solo tiene 2 divisores (el 1 y él mismo), es un número primo.` : '')
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
    numero: 1, antes: 'Todo número tiene como divisores al 1 y a', despues: 'mismo.',
    aceptables: ['si'],
    lectura: 'Todo número tiene como divisores al uno y a... ¿a quién mismo?',
    explicacion: 'Cualquier número siempre es divisible por 1 y por sí mismo — esos dos son sus divisores "obligatorios", aunque tenga otros más.',
  },
  {
    numero: 2, antes: 'Un número que solo tiene 2 divisores se llama', despues: '.',
    aceptables: ['primo'],
    lectura: 'Un número que solo tiene dos divisores, ¿cómo se llama?',
    explicacion: 'Un número con exactamente 2 divisores (el 1 y él mismo, y ningún otro) se llama número primo — como el 7 y el 11 de esta hoja.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length + 1

// ── Bloque de estado ──

interface EstadoItem { marcados: boolean[]; evaluado: boolean; correcto: boolean }
interface EstadoCompleta { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoLista { valor: string; evaluado: boolean; correcto: boolean }

export default function CuartoModulo04() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { marcados: Array.from({ length: p.valor }, () => false), evaluado: false, correcto: false }])),
  )
  const [completa, setCompleta] = useState<Record<number, EstadoCompleta>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
  )
  const [lista12, setLista12] = useState<EstadoLista>({ valor: '', evaluado: false, correcto: false })
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
    const c = lista12.evaluado && lista12.correcto ? 1 : 0
    return a + b + c
  }, [items, completa, lista12])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(items).filter(e => e.evaluado).length
    const b = Object.values(completa).filter(e => e.evaluado).length
    const c = lista12.evaluado ? 1 : 0
    return a + b + c
  }, [items, completa, lista12])

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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'cuarto-modulo-04', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: ItemDivisor) {
    const actual = items[p.numero]
    if (actual.evaluado) return
    const correcto = actual.marcados.every((m, i) => m === (p.valor % (i + 1) === 0))
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

  function comprobarLista12() {
    if (lista12.evaluado || lista12.valor.trim() === '') return
    const numeros = lista12.valor.split(/[^0-9]+/).filter(Boolean).map(Number).sort((a, b) => a - b)
    const esperados = divisoresDe(12)
    const correcto = numeros.length === esperados.length && numeros.every((n, i) => n === esperados[i])
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setLista12(prev => ({ ...prev, evaluado: true, correcto }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { marcados: Array.from({ length: p.valor }, () => false), evaluado: false, correcto: false }])))
    setCompleta(Object.fromEntries(COMPLETAR.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
    setLista12({ valor: '', evaluado: false, correcto: false })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #16a34a 0%, #86efac 35%, #f0fdf4 100%)',
      color: '#14532d', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #22c55e, #16a34a)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #14532d', borderBottom: '4px solid #14532d',
      }}>
        <BotonMenu href="/cuarto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🟢➗</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #14532d', margin: 0, color: 'white',
        }}>
          ¡Divisores!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          El slime se parte en grupos iguales — marcá todos los divisores
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

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaDivisor key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onToggle={idx => setItems(prev => {
                if (prev[p.numero].evaluado) return prev
                const marcados = [...prev[p.numero].marcados]
                marcados[idx] = !marcados[idx]
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
            {COMPLETAR.map(p => (
              <FilaCompleta key={p.numero} p={p} estado={completa[p.numero]}
                onCambiar={valor => setCompleta(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
                onComprobar={() => comprobarCompleta(p)} onExplicarEstado={reaccionarRickyExplicar} />
            ))}
            <FilaListaDivisores estado={lista12} onCambiar={valor => setLista12(prev => ({ ...prev, valor }))}
              onComprobar={comprobarLista12} onExplicarEstado={reaccionarRickyExplicar} />
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
                ? '¡Perfecto! Dominás los divisores 🎮'
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

function ChipDivisor({ n, marcado, evaluado, esperado, color, onClick }: {
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
      width: 40, height: 34, borderRadius: 10, border: `2px solid ${borde}`,
      background: bg, color: textColor, fontWeight: 800, fontSize: '0.85rem',
      cursor: evaluado ? 'default' : 'pointer', flexShrink: 0,
    }}>
      {n}{icono}
    </button>
  )
}

// Ejemplo resuelto — no interactivo, con un número distinto (10) a los 9 de
// la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const valor = 10
  const divisores = divisoresDe(valor)

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
        <span style={{ fontSize: '1.3rem' }}>🟢</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#1e3a8a' }}>Divisores de 10</p>
        <BotonEscuchar texto={explicacionItem(valor)} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        {Array.from({ length: valor }, (_, i) => i + 1).map(n => {
          const esperado = valor % n === 0
          return (
            <span key={n} style={{
              width: 40, height: 34, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: '0.85rem',
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
        Los divisores de 10 son {divisores.join(', ')} — los únicos números que reparten al 10 en grupos iguales sin que sobre nada.
      </p>
    </div>
  )
}

function TarjetaDivisor({ p, estado, color, onToggle, onComprobar, onExplicarEstado }: {
  p: ItemDivisor
  estado: EstadoItem
  color: string
  onToggle: (indice: number) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const primo = esPrimo(p.valor)

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
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d' }}>{p.valor}</span>
        {primo && (
          <span style={{
            marginLeft: '0.2rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: '#fef08a',
            color: '#854d0e', fontSize: '0.7rem', fontWeight: 800, border: '2px solid #facc15',
          }}>
            ⭐ PRIMO
          </span>
        )}
        <span style={{ flex: 1 }} />
        <BotonEscuchar texto={`Marcá todos los divisores de ${p.valor}`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        {Array.from({ length: p.valor }, (_, i) => i + 1).map((n, i) => (
          <ChipDivisor key={n} n={n} marcado={estado.marcados[i]} evaluado={estado.evaluado}
            esperado={p.valor % n === 0} color={color} onClick={() => onToggle(i)} />
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
            <BotonExplicar texto={explicacionItem(p.valor)} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function FilaListaDivisores({ estado, onCambiar, onComprobar, onExplicarEstado }: {
  estado: EstadoLista
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
      <BotonEscuchar texto="¿Cuáles son todos los divisores de doce?" />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#14532d' }}>3. Los divisores de 12 son</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="1, 2, 3..."
        style={{
          width: 160, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #86efac',
          background: 'white', color: '#14532d', fontSize: '1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#14532d' }}>.</span>
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
            {estado.correcto ? '✅' : `❌ (${divisoresDe(12).join(', ')})`}
          </span>
          <BotonExplicar texto={explicacionItem(12)} onEstadoCambia={onExplicarEstado} />
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
