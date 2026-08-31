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

// ── Datos de la actividad (basados en la hoja "Actividad 1 - Números
// Naturales Grandes"). La tabla de la hoja solo trae 5 columnas (DM, UM, C,
// D, U — hasta 99.999), pero los ítems 3 y 4 son números de 6 cifras
// (108.750 y 240.019). Confirmado con el usuario: para esos dos se agrega
// la columna CM (centena de mil); los ítems 1 y 2 quedan con las 5
// columnas originales.

interface ItemNumero {
  numero: number
  valor: string
  columnas: string[]
  digitos: number[]
  escrito: string
}

const ITEMS: ItemNumero[] = [
  { numero: 1, valor: '12.480', columnas: ['DM', 'UM', 'C', 'D', 'U'], digitos: [1, 2, 4, 8, 0], escrito: 'doce mil cuatrocientos ochenta' },
  { numero: 2, valor: '56.203', columnas: ['DM', 'UM', 'C', 'D', 'U'], digitos: [5, 6, 2, 0, 3], escrito: 'cincuenta y seis mil doscientos tres' },
  { numero: 3, valor: '108.750', columnas: ['CM', 'DM', 'UM', 'C', 'D', 'U'], digitos: [1, 0, 8, 7, 5, 0], escrito: 'ciento ocho mil setecientos cincuenta' },
  { numero: 4, valor: '240.019', columnas: ['CM', 'DM', 'UM', 'C', 'D', 'U'], digitos: [2, 4, 0, 0, 1, 9], escrito: 'doscientos cuarenta mil diecinueve' },
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
    numero: 1, antes: 'En 56.203, el 6 vale', despues: 'unidades.',
    aceptables: ['6000'],
    lectura: 'En cincuenta y seis mil doscientos tres, ¿cuántas unidades vale el 6?',
    explicacion: 'El 6 está en el lugar de las unidades de mil (UM), así que vale 6 por 1000, que es 6000 unidades.',
  },
  {
    numero: 2, antes: 'Diez mil unidades forman una', despues: '.',
    aceptables: ['decena de mil'],
    lectura: 'Diez mil unidades, ¿qué orden forman?',
    explicacion: 'Diez mil unidades (10 × 1000) forman una decena de mil — el siguiente orden hacia arriba de las unidades de mil.',
  },
  {
    numero: 3, antes: 'El número mayor de la ficha es el', despues: '.',
    aceptables: ['240019', '240.019'],
    lectura: 'De los cuatro números de la ficha, ¿cuál es el mayor?',
    explicacion: 'Comparando los cuatro números, 240.019 es el más grande — tiene 6 cifras, una más que los otros tres.',
  },
]

const TOTAL_PREGUNTAS = ITEMS.length + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoItem { digitos: string[]; escrito: string; evaluado: boolean; correcto: boolean }
interface EstadoCompleta { valor: string; evaluado: boolean; correcto: boolean }

export default function CuartoModulo01() {
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(ITEMS.map(p => [p.numero, { digitos: p.digitos.map(() => ''), escrito: '', evaluado: false, correcto: false }])),
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

  function comprobarItem(p: ItemNumero) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.digitos.some(v => v.trim() === '') || actual.escrito.trim() === '') return
    const digitosOk = actual.digitos.every((v, i) => Number(v.trim()) === p.digitos[i])
    const escritoOk = normalizarTexto(actual.escrito) === normalizarTexto(p.escrito)
    const correcto = digitosOk && escritoOk
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
    setItems(Object.fromEntries(ITEMS.map(p => [p.numero, { digitos: p.digitos.map(() => ''), escrito: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #d97706 0%, #fde68a 35%, #fef3c7 100%)',
      color: '#78350f', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      {/* Las casillas de dígito son angostas (34px, hasta 6 por fila en los
          ítems de 6 cifras) — las flechitas nativas del input numérico
          tapan el dígito a ese ancho, así que se ocultan acá. */}
      <style>{`
        .gj-input-digito::-webkit-outer-spin-button,
        .gj-input-digito::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .gj-input-digito { -moz-appearance: textfield; }
      `}</style>
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #b45309, #92400e)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #78350f', borderBottom: '4px solid #78350f',
      }}>
        <BotonMenu href="/cuarto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🏜️🔢</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #78350f', margin: 0, color: 'white',
        }}>
          ¡Números naturales grandes!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Separá cada número en órdenes y escribilo con letras
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#b45309" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {ITEMS.map((p, i) => (
            <TarjetaNumero key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiarDigito={(idx, valor) => setItems(prev => {
                const digitos = [...prev[p.numero].digitos]
                digitos[idx] = valor
                return { ...prev, [p.numero]: { ...prev[p.numero], digitos } }
              })}
              onCambiarEscrito={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], escrito: valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        <div style={{
          background: 'white', border: '3px solid #fcd34d', boxShadow: '0 4px 0 rgba(120,53,15,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#78350f' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(120,53,15,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#78350f' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#b45309' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás los números grandes 🎮'
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

// Torre de bloques por orden — decorativa, solo para el ejemplo, imitando
// la ilustración de la hoja (una barra más alta por cada cifra, de mayor a
// menor orden). No se usa en las tarjetas reales para no sobrecargarlas.
function TorresValorPosicional({ digitos, colores }: { digitos: number[]; colores: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '0.4rem', height: 80, marginBottom: '0.5rem' }}>
      {digitos.map((d, i) => (
        <div key={i} style={{
          width: 22, height: Math.max(8, d * 8), background: colores[i % colores.length],
          borderRadius: '4px 4px 0 0', border: `2px solid ${colores[i % colores.length]}`,
        }} />
      ))}
    </div>
  )
}

// Ejemplo resuelto — el mismo ejemplo que trae la hoja original (34.512),
// así que no hace falta inventar uno nuevo ni hay riesgo de repetir un
// número de los 4 ítems reales.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const valor = '34.512'
  const columnas = ['DM', 'UM', 'C', 'D', 'U']
  const digitos = [3, 4, 5, 1, 2]
  const escrito = 'treinta y cuatro mil quinientos doce'

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
        <BotonEscuchar texto={`Ejemplo: treinta y cuatro mil quinientos doce, separado en órdenes: decena de mil 3, unidad de mil 4, centena 5, decena 1, unidad 2.`} tamano={32} />
      </div>

      <TorresValorPosicional digitos={digitos} colores={['#22c55e', '#06b6d4', '#eab308', '#ef4444', '#94a3b8']} />

      <p style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.5rem', color: '#1e3a8a', margin: '0 0 0.6rem' }}>{valor}</p>

      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', marginBottom: '0.6rem' }}>
        {columnas.map((c, i) => (
          <div key={c} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#1e40af', marginBottom: '0.2rem' }}>{c}</div>
            <div style={{
              width: 34, height: 34, borderRadius: 8, border: '2px solid #93c5fd', background: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.05rem', color: '#1e3a8a',
            }}>
              {digitos[i]}
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '0.85rem', textAlign: 'center', color: '#1e3a8a', opacity: 0.85, margin: 0 }}>
        Escrito con letras: <strong>{escrito}</strong>
      </p>
    </div>
  )
}

function TarjetaNumero({ p, estado, color, onCambiarDigito, onCambiarEscrito, onComprobar, onExplicarEstado }: {
  p: ItemNumero
  estado: EstadoItem
  color: string
  onCambiarDigito: (indice: number, valor: string) => void
  onCambiarEscrito: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const faltanDigitos = estado.digitos.some(v => v.trim() === '')
  const faltaEscrito = estado.escrito.trim() === ''

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !faltanDigitos && !faltaEscrito) onComprobar()
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
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.95rem',
        }}>
          {p.numero}
        </span>
        <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, flex: 1, textAlign: 'center', color: '#78350f' }}>{p.valor}</p>
        <BotonEscuchar texto={`Leé, separá en órdenes y escribí con letras: ${p.valor}`} tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
        {p.columnas.map((c, i) => (
          <div key={c} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#92400e', marginBottom: '0.2rem' }}>{c}</div>
            <input
              type="number"
              inputMode="numeric"
              className="gj-input-digito"
              value={estado.digitos[i]}
              disabled={estado.evaluado}
              onChange={e => onCambiarDigito(i, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 34, padding: '0.35rem', borderRadius: 8, border: `2px solid ${bordeColor}55`,
                background: '#fffbeb', color: '#78350f', fontSize: '1.05rem', fontWeight: 700, textAlign: 'center',
              }}
            />
          </div>
        ))}
      </div>

      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '0.3rem' }}>
        Escrito con letras:
      </label>
      <input
        value={estado.escrito}
        disabled={estado.evaluado}
        onChange={e => onCambiarEscrito(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribí el número con letras"
        style={{
          width: '100%', padding: '0.5rem 0.7rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
          background: '#fffbeb', color: '#78350f', fontSize: '0.95rem', fontWeight: 600,
        }}
      />

      {!estado.evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.7rem' }}>
          <button onClick={onComprobar} disabled={faltanDigitos || faltaEscrito} style={{
            padding: '0.55rem 1.4rem', borderRadius: 12, border: 'none', cursor: (faltanDigitos || faltaEscrito) ? 'default' : 'pointer',
            background: (faltanDigitos || faltaEscrito) ? '#e2e8f0' : '#22c55e',
            boxShadow: (faltanDigitos || faltaEscrito) ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1rem', opacity: (faltanDigitos || faltaEscrito) ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.digitos.join(' | ')} — "${p.escrito}"`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`${p.valor} se separa en ${p.columnas.map((c, i) => `${c} ${p.digitos[i]}`).join(', ')}. Escrito con letras: ${p.escrito}.`} onEstadoCambia={onExplicarEstado} />
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#fcd34d'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fffbeb',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#78350f' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 130, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #fcd34d',
          background: 'white', color: '#78350f', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#78350f' }}>{p.despues}</span>
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
