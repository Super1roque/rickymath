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

// ── Datos de la actividad (basados en la hoja "Misión 08 - La tienda del
// Nether", serie "Problemas"). Todos los ítems son porcentajes de
// descuento o recargo sobre precios con decimales. El ítem 77 pide dos
// respuestas (precio de venta y ganancia), igual que en la hoja. La
// numeración sigue de la misión 7 (71 a 80). Los resultados ya están
// redondeados a 2 decimales (convención de redondeo comercial: 0,5 hacia
// arriba), con una tolerancia chica en la comprobación por si el
// resultado exacto tiene más decimales.

interface Campo { etiqueta: string; resultado: number }

interface Problema {
  numero: number
  emoji: string
  enunciado: string
  lectura: string
  campos: Campo[]
  explicacion: string
}

const PROBLEMAS: Problema[] = [
  {
    numero: 71, emoji: '🥇',
    enunciado: 'Un lingote de oro cuesta 12,75 esmeraldas. Si tenés un 15% de descuento, ¿cuánto pagarás por el lingote?',
    lectura: 'Un lingote de oro cuesta doce coma setenta y cinco esmeraldas. Si tenés un quince por ciento de descuento, ¿cuánto pagarás por el lingote?',
    campos: [{ etiqueta: 'R', resultado: 10.84 }],
    explicacion: 'Calculo el 15% de 12,75: 12,75 × 0,15 = 1,9125. Resto: 12,75 − 1,9125 = 10,8375, que redondeado son 10,84 esmeraldas.',
  },
  {
    numero: 72, emoji: '📦',
    enunciado: 'Comprás 3 lingotes de oro en 24,60 esmeraldas. Si el piglin aplica un 10% de descuento por cantidad, ¿cuánto pagás en total?',
    lectura: 'Comprás tres lingotes de oro en veinticuatro coma sesenta esmeraldas. Si el piglin aplica un diez por ciento de descuento por cantidad, ¿cuánto pagás en total?',
    campos: [{ etiqueta: 'R', resultado: 22.14 }],
    explicacion: 'Calculo el 10% de 24,60: 24,60 × 0,10 = 2,46. Resto: 24,60 − 2,46 = 22,14 esmeraldas.',
  },
  {
    numero: 73, emoji: '🧪',
    enunciado: 'Una poción de resistencia cuesta 8,40 esmeraldas. Si tenés una oferta del 25% de descuento, ¿cuánto pagarás por la poción?',
    lectura: 'Una poción de resistencia cuesta ocho coma cuarenta esmeraldas. Si tenés una oferta del veinticinco por ciento de descuento, ¿cuánto pagarás por la poción?',
    campos: [{ etiqueta: 'R', resultado: 6.30 }],
    explicacion: 'Calculo el 25% de 8,40: 8,40 × 0,25 = 2,10. Resto: 8,40 − 2,10 = 6,30 esmeraldas.',
  },
  {
    numero: 74, emoji: '🟨',
    enunciado: 'El piglin vende 1,5 bloques de oro por 72,00 esmeraldas. ¿Cuánto cuesta cada bloque de oro?',
    lectura: 'El piglin vende uno coma cinco bloques de oro por setenta y dos esmeraldas. ¿Cuánto cuesta cada bloque de oro?',
    campos: [{ etiqueta: 'R', resultado: 48 }],
    explicacion: 'Divido: 72,00 ÷ 1,5 = 48,00 esmeraldas por bloque.',
  },
  {
    numero: 75, emoji: '📖',
    enunciado: 'Un encantamiento especial cuesta 18,90 esmeraldas. Si solés tener un 20% de descuento con este piglin, ¿cuánto pagarás?',
    lectura: 'Un encantamiento especial cuesta dieciocho coma noventa esmeraldas. Si solés tener un veinte por ciento de descuento con este piglin, ¿cuánto pagarás?',
    campos: [{ etiqueta: 'R', resultado: 15.12 }],
    explicacion: 'Calculo el 20% de 18,90: 18,90 × 0,20 = 3,78. Resto: 18,90 − 3,78 = 15,12 esmeraldas.',
  },
  {
    numero: 76, emoji: '🛡️',
    enunciado: 'Comprás una armadura por 95,00 esmeraldas. El piglin hace un descuento del 12,5%. ¿Cuánto pagarás después del descuento?',
    lectura: 'Comprás una armadura por noventa y cinco esmeraldas. El piglin hace un descuento del doce coma cinco por ciento. ¿Cuánto pagarás después del descuento?',
    campos: [{ etiqueta: 'R', resultado: 83.13 }],
    explicacion: 'Calculo el 12,5% de 95,00: 95,00 × 0,125 = 11,875. Resto: 95,00 − 11,875 = 83,125, que redondeado son 83,13 esmeraldas.',
  },
  {
    numero: 77, emoji: '🔮',
    enunciado: 'Intercambiás 3,2 lingotes de oro y te dan un objeto que vale 60,80 esmeraldas. Si luego lo revendés con una ganancia del 18%, ¿a cuánto lo vendés? ¿Y cuál es la ganancia?',
    lectura: 'Intercambiás tres coma dos lingotes de oro y te dan un objeto que vale sesenta coma ochenta esmeraldas. Si luego lo revendés con una ganancia del dieciocho por ciento, ¿a cuánto lo vendés? ¿Y cuál es la ganancia?',
    campos: [{ etiqueta: 'Precio de venta', resultado: 71.74 }, { etiqueta: 'Ganancia', resultado: 10.94 }],
    explicacion: 'Calculo la ganancia: 60,80 × 0,18 = 10,944, redondeado 10,94. El precio de venta es 60,80 + 10,944 = 71,744, redondeado 71,74 esmeraldas.',
  },
  {
    numero: 78, emoji: '🧪',
    enunciado: 'Un lote de 5 pociones cuesta 39,25 esmeraldas. Si el piglin añade un impuesto del 8%, ¿cuánto pagás en total?',
    lectura: 'Un lote de cinco pociones cuesta treinta y nueve coma veinticinco esmeraldas. Si el piglin añade un impuesto del ocho por ciento, ¿cuánto pagás en total?',
    campos: [{ etiqueta: 'R', resultado: 42.39 }],
    explicacion: 'Calculo el 8% de 39,25: 39,25 × 0,08 = 3,14. Sumo: 39,25 + 3,14 = 42,39 esmeraldas.',
  },
  {
    numero: 79, emoji: '✨',
    enunciado: 'El piglin ofrece un 30% de descuento en todos los bloques brillantes. Si un bloque cuesta 16,80 esmeraldas, ¿cuánto pagarás por 4 bloques?',
    lectura: 'El piglin ofrece un treinta por ciento de descuento en todos los bloques brillantes. Si un bloque cuesta dieciséis coma ochenta esmeraldas, ¿cuánto pagarás por cuatro bloques?',
    campos: [{ etiqueta: 'R', resultado: 47.04 }],
    explicacion: 'Calculo el precio con descuento de un bloque: 16,80 × 0,70 = 11,76. Por 4 bloques: 11,76 × 4 = 47,04 esmeraldas.',
  },
  {
    numero: 80, emoji: '💰',
    enunciado: 'Tenés 50,00 esmeraldas. Gastás el 65% en objetos de la tienda y el resto en pociones. ¿Cuántas esmeraldas usás en pociones?',
    lectura: 'Tenés cincuenta esmeraldas. Gastás el sesenta y cinco por ciento en objetos de la tienda y el resto en pociones. ¿Cuántas esmeraldas usás en pociones?',
    campos: [{ etiqueta: 'R', resultado: 17.50 }],
    explicacion: 'El resto es 100% − 65% = 35%. Calculo el 35% de 50,00: 50,00 × 0,35 = 17,50 esmeraldas.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

function aNumero(texto: string): number {
  return Number(texto.trim().replace(',', '.'))
}

// ── Bloque de estado ──

interface EstadoItem { valores: string[]; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo08() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valores: p.campos.map(() => ''), evaluado: false, correcto: false }])),
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'problemas-modulo-08', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: Problema) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valores.some(v => v.trim() === '')) return
    const correcto = p.campos.every((c, i) => Math.abs(aNumero(actual.valores[i]) - c.resultado) < 0.006)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valores: p.campos.map(() => ''), evaluado: false, correcto: false }])))
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
        textAlign: 'center', boxShadow: '0 5px 0 #7f1d1d', borderBottom: '4px solid #7f1d1d',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>👺🥇</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #7f1d1d', margin: 0, color: 'white',
        }}>
          Misión 08: La tienda del Nether
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          El piglin hace descuentos raros — ¡calculá bien antes de pagar!
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#dc2626" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={(indice, valor) => setItems(prev => {
                const valores = [...prev[p.numero].valores]
                valores[indice] = valor
                return { ...prev, [p.numero]: { ...prev[p.numero], valores } }
              })}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(127,29,29,0.15))' }}
          >
            <Ricky mood={rickyMood} loop={rickyMood === 'confused' ? 2 : undefined} size={140} />
          </div>
        )}

        {terminado && (
          <div style={{
            marginTop: '2rem', textAlign: 'center', background: 'white',
            border: '3px solid #dc2626', boxShadow: '0 5px 0 rgba(220,38,38,0.2)', borderRadius: 20, padding: '1.75rem 1.5rem',
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
                ? '🎉 ¡Misión completada! Negociaste bien con el piglin 🏆'
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

// Ejemplo resuelto — una espada mágica, distinto a los 10 ítems reales
// para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#0ea5e9'
  const enunciado = 'Una espada mágica cuesta 20,00 esmeraldas. Si tenés un 10% de descuento, ¿cuánto pagarás?'
  const resultado = '18,00'

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
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⚔️</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: una espada mágica cuesta veinte esmeraldas. Si tenés un diez por ciento de descuento, ¿cuánto pagarás? El diez por ciento de 20 es 2. Resto 20 menos 2, que es 18." tamano={32} />
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
        Calculo el 10% de 20: 20 × 0,10 = 2. Resto: 20 − 2 = 18.
      </p>
    </div>
  )
}

function TarjetaProblema({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: Problema
  estado: EstadoItem
  color: string
  onCambiar: (indice: number, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : color
  const listo = estado.valores.every(v => v.trim() !== '')

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

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#7f1d1d', fontWeight: 600 }}>{p.enunciado}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
        {p.campos.map((c, i) => (
          <div key={c.etiqueta} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '0.95rem', fontWeight: 800, color: '#7f1d1d',
              width: p.campos.length > 1 ? 116 : 'auto', textAlign: p.campos.length > 1 ? 'right' : 'left',
            }}>
              {p.campos.length > 1 ? `${c.etiqueta}:` : 'R:'}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={estado.valores[i]}
              disabled={estado.evaluado}
              onChange={e => onCambiar(i, e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="?"
              style={{
                width: 84, padding: '0.5rem', borderRadius: 10, border: `2px solid ${bordeColor}55`,
                background: '#fef2f2', color: '#7f1d1d', fontSize: '1.05rem', fontWeight: 800, textAlign: 'center',
              }}
            />
            {i === p.campos.length - 1 && !estado.evaluado && (
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
        ))}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto
              ? '✅ ¡Correcto!'
              : `❌ Era ${p.campos.map(c => `${c.etiqueta}: ${c.resultado}`).join(' · ')}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
