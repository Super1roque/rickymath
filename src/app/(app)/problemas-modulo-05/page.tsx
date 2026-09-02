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

// ── Datos de la actividad (basados en la hoja "Misión 05 - El mercado de
// esmeraldas", serie "Problemas"). Todos los ítems son de dos pasos:
// empezás con una cantidad, comprás algo (restás el precio) y después
// pasa algo más (ganás o perdés esmeraldas). La numeración sigue de la
// misión 4 (41 a 50).

interface Problema {
  numero: number
  emoji: string
  enunciado: string
  lectura: string
  resultado: number
  explicacion: string
}

const PROBLEMAS: Problema[] = [
  {
    numero: 41, emoji: '🟩', resultado: 16,
    enunciado: 'Tenés 18 esmeraldas. Comprás el objeto de la derecha (precio: 9). Luego le vendés un objeto a la aldea y ganás 7 esmeraldas más. ¿Cuántas esmeraldas te quedan?',
    lectura: 'Tenés dieciocho esmeraldas. Comprás un objeto que cuesta nueve. Luego le vendés un objeto a la aldea y ganás siete esmeraldas más. ¿Cuántas esmeraldas te quedan?',
    explicacion: 'Empiezo con 18. Compro por 9: 18 − 9 = 9. Después vendo un objeto y gano 7: 9 + 7 = 16.',
  },
  {
    numero: 42, emoji: '🍎', resultado: 30,
    enunciado: 'Tenés 32 esmeraldas. Comprás el objeto de la derecha (precio: 17). Después, ganás 15 esmeraldas al completar una misión. ¿Cuántas esmeraldas tenés ahora?',
    lectura: 'Tenés treinta y dos esmeraldas. Comprás un objeto que cuesta diecisiete. Después ganás quince esmeraldas al completar una misión. ¿Cuántas esmeraldas tenés ahora?',
    explicacion: 'Empiezo con 32. Compro por 17: 32 − 17 = 15. Después gano 15: 15 + 15 = 30.',
  },
  {
    numero: 43, emoji: '📖', resultado: 22,
    enunciado: 'Tenés 25 esmeraldas. Comprás el objeto de la derecha (precio: 13). Luego le vendés un objeto a otro jugador del pueblo y ganás 10 esmeraldas. ¿Cuántas esmeraldas te quedan?',
    lectura: 'Tenés veinticinco esmeraldas. Comprás un objeto que cuesta trece. Luego le vendés un objeto a otro jugador del pueblo y ganás diez esmeraldas. ¿Cuántas esmeraldas te quedan?',
    explicacion: 'Empiezo con 25. Compro por 13: 25 − 13 = 12. Después vendo un objeto y gano 10: 12 + 10 = 22.',
  },
  {
    numero: 44, emoji: '🤖', resultado: 11,
    enunciado: 'Tenés 40 esmeraldas. Comprás el objeto de la derecha (precio: 21). Después, perdés 8 esmeraldas en una apuesta en los juegos de la feria. ¿Cuántas esmeraldas te quedan?',
    lectura: 'Tenés cuarenta esmeraldas. Comprás un objeto que cuesta veintiuno. Después perdés ocho esmeraldas en una apuesta en los juegos de la feria. ¿Cuántas esmeraldas te quedan?',
    explicacion: 'Empiezo con 40. Compro por 21: 40 − 21 = 19. Después pierdo 8: 19 − 8 = 11.',
  },
  {
    numero: 45, emoji: '🗺️', resultado: 7,
    enunciado: 'Tenés 27 esmeraldas. Comprás el objeto de la derecha (precio: 14). Luego comprás un mapa por 6 esmeraldas más. ¿Cuántas esmeraldas te quedan?',
    lectura: 'Tenés veintisiete esmeraldas. Comprás un objeto que cuesta catorce. Luego comprás un mapa por seis esmeraldas más. ¿Cuántas esmeraldas te quedan?',
    explicacion: 'Empiezo con 27. Compro por 14: 27 − 14 = 13. Después compro el mapa por 6: 13 − 6 = 7.',
  },
  {
    numero: 46, emoji: '🏮', resultado: 23,
    enunciado: 'Tenés 19 esmeraldas. Comprás el objeto de la derecha (precio: 8). Después, le vendés un objeto a la aldea y ganás 12 esmeraldas más. ¿Cuántas esmeraldas te quedan?',
    lectura: 'Tenés diecinueve esmeraldas. Comprás un objeto que cuesta ocho. Después le vendés un objeto a la aldea y ganás doce esmeraldas más. ¿Cuántas esmeraldas te quedan?',
    explicacion: 'Empiezo con 19. Compro por 8: 19 − 8 = 11. Después vendo un objeto y gano 12: 11 + 12 = 23.',
  },
  {
    numero: 47, emoji: '⚔️', resultado: 23,
    enunciado: 'Tenés 36 esmeraldas. Comprás el objeto de la derecha (precio: 22). Luego ganás 9 esmeraldas al ayudar en la granja. ¿Cuántas esmeraldas tenés ahora?',
    lectura: 'Tenés treinta y seis esmeraldas. Comprás un objeto que cuesta veintidós. Luego ganás nueve esmeraldas al ayudar en la granja. ¿Cuántas esmeraldas tenés ahora?',
    explicacion: 'Empiezo con 36. Compro por 22: 36 − 22 = 14. Después gano 9: 14 + 9 = 23.',
  },
  {
    numero: 48, emoji: '🪨', resultado: 7,
    enunciado: 'Tenés 23 esmeraldas. Comprás el objeto de la derecha (precio: 11). Luego perdés 5 esmeraldas al caer en una trampa. ¿Cuántas esmeraldas te quedan?',
    lectura: 'Tenés veintitrés esmeraldas. Comprás un objeto que cuesta once. Luego perdés cinco esmeraldas al caer en una trampa. ¿Cuántas esmeraldas te quedan?',
    explicacion: 'Empiezo con 23. Compro por 11: 23 − 11 = 12. Después pierdo 5: 12 − 5 = 7.',
  },
  {
    numero: 49, emoji: '🟥', resultado: 28,
    enunciado: 'Tenés 30 esmeraldas. Comprás el objeto de la derecha (precio: 16). Luego le vendés un objeto a un comerciante del pueblo y ganás 14 esmeraldas. ¿Cuántas esmeraldas te quedan?',
    lectura: 'Tenés treinta esmeraldas. Comprás un objeto que cuesta dieciséis. Luego le vendés un objeto a un comerciante del pueblo y ganás catorce esmeraldas. ¿Cuántas esmeraldas te quedan?',
    explicacion: 'Empiezo con 30. Compro por 16: 30 − 16 = 14. Después vendo un objeto y gano 14: 14 + 14 = 28.',
  },
  {
    numero: 50, emoji: '🟪', resultado: 20,
    enunciado: 'Tenés 28 esmeraldas. Comprás el objeto de la derecha (precio: 15). Después, ganás 7 esmeraldas en un desafío de construcción. ¿Cuántas esmeraldas tenés ahora?',
    lectura: 'Tenés veintiocho esmeraldas. Comprás un objeto que cuesta quince. Después ganás siete esmeraldas en un desafío de construcción. ¿Cuántas esmeraldas tenés ahora?',
    explicacion: 'Empiezo con 28. Compro por 15: 28 − 15 = 13. Después gano 7: 13 + 7 = 20.',
  },
]

const TOTAL_PREGUNTAS = PROBLEMAS.length

// ── Bloque de estado ──

interface EstadoItem { valor: string; evaluado: boolean; correcto: boolean }

export default function ProblemasModulo05() {
  const { user, tenantData } = useAuth()
  const { perfilActivo } = usePerfil()
  const [items, setItems] = useState<Record<number, EstadoItem>>(() =>
    Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])),
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
    guardarProgresoModulo(user.uid, perfilActivo.id, 'problemas-modulo-05', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarItem(p: Problema) {
    const actual = items[p.numero]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = Number(actual.valor.trim()) === p.resultado
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], evaluado: true, correcto } }))
  }

  function reiniciar() {
    setItems(Object.fromEntries(PROBLEMAS.map(p => [p.numero, { valor: '', evaluado: false, correcto: false }])))
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #059669 0%, #6ee7b7 35%, #ecfdf5 100%)',
      color: '#064e3b', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #059669, #064e3b)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #064e3b', borderBottom: '4px solid #064e3b',
      }}>
        <BotonMenu href="/problemas-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🦙💎</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.1rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #064e3b', margin: 0, color: 'white',
        }}>
          Misión 05: El mercado de esmeraldas
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Compra, vende y no te dejes engañar.
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#059669" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem',
        }}>
          {PROBLEMAS.map((p, i) => (
            <TarjetaProblema key={p.numero} p={p} estado={items[p.numero]} color={COLORES[i % COLORES.length]}
              onCambiar={valor => setItems(prev => ({ ...prev, [p.numero]: { ...prev[p.numero], valor } }))}
              onComprobar={() => comprobarItem(p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}
        </div>

        {!terminado && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(6,78,59,0.15))' }}
          >
            <Ricky mood={rickyMood} loop={rickyMood === 'confused' ? 2 : undefined} size={140} />
          </div>
        )}

        {terminado && (
          <div style={{
            marginTop: '2rem', textAlign: 'center', background: 'white',
            border: '3px solid #059669', boxShadow: '0 5px 0 rgba(5,150,105,0.2)', borderRadius: 20, padding: '1.75rem 1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
              <Ricky mood={rickyMood} loop={rickyMood === 'celebrating'} size={160} />
            </div>
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#064e3b' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#059669' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '🎉 ¡Misión completada! Negociaste sin dejarte engañar 🏆'
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

// Ejemplo resuelto — poción de un vendedor distinto, con números y objeto
// diferentes a los 10 ítems reales para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#0ea5e9'
  const enunciado = 'Tenés 15 esmeraldas. Comprás una poción por 6 esmeraldas. Después, ganás 4 esmeraldas por una tarea. ¿Cuántas esmeraldas tenés ahora?'
  const resultado = 13

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
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🧪</span>
        <p style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#0c4a6e', flex: 1 }}>Ejemplo resuelto</p>
        <BotonEscuchar texto="Ejemplo: tenés quince esmeraldas. Comprás una poción por seis esmeraldas. Después ganás cuatro esmeraldas por una tarea. ¿Cuántas esmeraldas tenés ahora? Primero resto 15 menos 6, que es 9. Después sumo 4, que es 13." tamano={32} />
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
        Primero resto: 15 − 6 = 9. Después sumo: 9 + 4 = 13.
      </p>
    </div>
  )
}

function TarjetaProblema({ p, estado, color, onCambiar, onComprobar, onExplicarEstado }: {
  p: Problema
  estado: EstadoItem
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

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.8rem', color: '#064e3b', fontWeight: 600 }}>{p.enunciado}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#064e3b' }}>R:</span>
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
            background: '#ecfdf5', color: '#064e3b', fontSize: '1.15rem', fontWeight: 800, textAlign: 'center',
          }}
        />
        {!estado.evaluado && (
          <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
            padding: '0.5rem 0.9rem', borderRadius: 10, border: 'none', cursor: estado.valor.trim() === '' ? 'default' : 'pointer',
            background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
            boxShadow: estado.valor.trim() === '' ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '1rem', opacity: estado.valor.trim() === '' ? 0.7 : 1,
          }}>
            ✓
          </button>
        )}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : `❌ Era ${p.resultado}`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}
