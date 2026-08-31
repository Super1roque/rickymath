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

// ── Datos de la actividad (basados en la hoja "Actividad 9 - Gráficos de Barras") ──
// Alturas de barra confirmadas a mano por el usuario mirando la hoja
// original (gráfico 3, miércoles corregido a 5) — igual que en fracciones,
// perímetro y ángulos, no hay forma de derivarlas del enunciado solamente.

interface Categoria { nombre: string; valor: number; emoji: string }

interface SubPregunta {
  letra: string
  texto: string
  aceptables: string[]
  lectura: string
  explicacion: string
}

interface Grafico {
  numero: number
  titulo: string
  emoji: string
  ejeMax: number
  categorias: Categoria[]
  preguntas: SubPregunta[]
}

const GRAFICOS: Grafico[] = [
  {
    numero: 1, titulo: 'Minerales de la mina', emoji: '⛏️', ejeMax: 10,
    categorias: [
      { nombre: 'Carbón', valor: 9, emoji: '⬛' },
      { nombre: 'Hierro', valor: 6, emoji: '⚙️' },
      { nombre: 'Oro', valor: 4, emoji: '🟨' },
      { nombre: 'Diamante', valor: 3, emoji: '💎' },
    ],
    preguntas: [
      { letra: 'a', texto: '¿Qué mineral tiene más bloques?', aceptables: ['carbon'], lectura: '¿Qué mineral tiene más bloques?', explicacion: 'Miro las barras y busco la más alta. El carbón tiene 9 bloques, la barra más alta del gráfico — por eso tiene más.' },
      { letra: 'b', texto: '¿Qué mineral tiene menos bloques?', aceptables: ['diamante'], lectura: '¿Qué mineral tiene menos bloques?', explicacion: 'Miro las barras y busco la más baja. El diamante tiene 3 bloques, la barra más chica — por eso tiene menos.' },
      { letra: 'c', texto: '¿Cuántos bloques de hierro hay?', aceptables: ['6'], lectura: '¿Cuántos bloques de hierro hay?', explicacion: 'Busco la barra del hierro y leo hasta dónde llega en el eje: llega hasta el 6.' },
      { letra: 'd', texto: '¿Cuántos bloques hay en total?', aceptables: ['22'], lectura: 'Sumando todos los minerales, ¿cuántos bloques hay en total?', explicacion: 'Sumo todas las barras: 9 más 6 más 4 más 3 es 22.' },
    ],
  },
  {
    numero: 2, titulo: 'Animales de la granja', emoji: '🐄', ejeMax: 10,
    categorias: [
      { nombre: 'Ovejas', valor: 3, emoji: '🐑' },
      { nombre: 'Vacas', valor: 5, emoji: '🐄' },
      { nombre: 'Cerdos', valor: 7, emoji: '🐷' },
      { nombre: 'Gallinas', valor: 6, emoji: '🐔' },
    ],
    preguntas: [
      { letra: 'a', texto: '¿Qué animal tiene menos bloques?', aceptables: ['ovejas'], lectura: '¿Qué animal tiene menos bloques?', explicacion: 'Busco la barra más baja. Las ovejas tienen 3 bloques, la barra más chica — por eso tienen menos.' },
      { letra: 'b', texto: '¿Qué animal tiene más bloques?', aceptables: ['cerdos'], lectura: '¿Qué animal tiene más bloques?', explicacion: 'Busco la barra más alta. Los cerdos tienen 7 bloques, la barra más alta — por eso tienen más.' },
      { letra: 'c', texto: '¿Cuántos bloques tienen las ovejas?', aceptables: ['3'], lectura: '¿Cuántos bloques tienen las ovejas?', explicacion: 'Busco la barra de las ovejas y leo hasta dónde llega: llega hasta el 3.' },
      { letra: 'd', texto: '¿Cuántos bloques hay en total?', aceptables: ['21'], lectura: 'Sumando todos los animales, ¿cuántos bloques hay en total?', explicacion: 'Sumo todas las barras: 3 más 5 más 7 más 6 es 21.' },
    ],
  },
  {
    numero: 3, titulo: 'Bloques colocados por día', emoji: '📅', ejeMax: 25,
    categorias: [
      { nombre: 'Lunes', valor: 10, emoji: '🟩' },
      { nombre: 'Martes', valor: 15, emoji: '🟩' },
      { nombre: 'Miércoles', valor: 5, emoji: '🟩' },
      { nombre: 'Jueves', valor: 20, emoji: '🟩' },
    ],
    preguntas: [
      { letra: 'a', texto: '¿Qué día se colocaron más bloques?', aceptables: ['jueves'], lectura: '¿Qué día se colocaron más bloques?', explicacion: 'Busco la barra más alta. El jueves se colocaron 20 bloques, la barra más alta — por eso fue el día con más.' },
      { letra: 'b', texto: '¿Qué día se colocaron menos bloques?', aceptables: ['miercoles'], lectura: '¿Qué día se colocaron menos bloques?', explicacion: 'Busco la barra más baja. El miércoles se colocaron 5 bloques, la barra más chica — por eso fue el día con menos.' },
      { letra: 'c', texto: '¿Cuántos bloques se colocaron el martes?', aceptables: ['15'], lectura: '¿Cuántos bloques se colocaron el martes?', explicacion: 'Busco la barra del martes y leo hasta dónde llega: llega hasta el 15.' },
      { letra: 'd', texto: '¿Cuántos bloques hay en total?', aceptables: ['50'], lectura: 'Sumando los cuatro días, ¿cuántos bloques hay en total?', explicacion: 'Sumo los cuatro días: 10 más 15 más 5 más 20 es 50.' },
    ],
  },
]

interface BarraObjetivo { nombre: string; emoji: string; objetivo: number }
const OBJETIVOS: BarraObjetivo[] = [
  { nombre: 'Esmeraldas', emoji: '💚', objetivo: 4 },
  { nombre: 'Rubíes', emoji: '❤️', objetivo: 7 },
  { nombre: 'Amatistas', emoji: '💜', objetivo: 5 },
]
const EJE_MAX_DIBUJO = 10

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
    numero: 1,
    antes: 'La barra más alta es la que tiene',
    despues: '(más / menos).',
    aceptables: ['mas'],
    lectura: 'La barra más alta, ¿es la que tiene más o menos?',
    explicacion: 'La barra más alta siempre representa la cantidad más grande — por eso decimos que tiene más.',
  },
  {
    numero: 2,
    antes: 'El eje de abajo muestra las',
    despues: '.',
    aceptables: ['categorias', 'nombres'],
    lectura: '¿Qué muestra el eje de abajo de un gráfico de barras?',
    explicacion: 'El eje de abajo muestra las categorías: los nombres de cada grupo que se está comparando, como los minerales o los animales.',
  },
  {
    numero: 3,
    antes: 'En el gráfico de la mina hay',
    despues: 'minerales en total.',
    aceptables: ['4'],
    lectura: '¿Cuántos tipos de minerales distintos hay en el gráfico de la mina?',
    explicacion: 'En el gráfico de la mina hay 4 barras: carbón, hierro, oro y diamante — 4 tipos de minerales en total.',
  },
]

// Cada gráfico son 4 sub-preguntas + el ejercicio de dibujar (1) = 13, más
// las 3 de Completa.
const TOTAL_PREGUNTAS = GRAFICOS.reduce((s, g) => s + g.preguntas.length, 0) + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoPregunta {
  valor: string
  evaluado: boolean
  correcto: boolean
}

const ESTADO_INICIAL: EstadoPregunta = { valor: '', evaluado: false, correcto: false }

function idSub(numeroGrafico: number, letra: string): string {
  return `${numeroGrafico}${letra}`
}

export default function TerceroModulo09() {
  const [subs, setSubs] = useState<Record<string, EstadoPregunta>>(() =>
    Object.fromEntries(GRAFICOS.flatMap(g => g.preguntas.map(p => [idSub(g.numero, p.letra), { ...ESTADO_INICIAL }]))),
  )
  const [completa, setCompleta] = useState<Record<number, EstadoPregunta>>(() =>
    Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_INICIAL }])),
  )
  const [valoresDibujo, setValoresDibujo] = useState<Record<string, number>>(() =>
    Object.fromEntries(OBJETIVOS.map(o => [o.nombre, 0])),
  )
  const [dibujoEvaluado, setDibujoEvaluado] = useState(false)
  const [dibujoCorrecto, setDibujoCorrecto] = useState(false)

  const fanfarriaSonada = useRef(false)
  const [puntos, setPuntos] = useState(0)
  const [racha, setRacha] = useState(0)
  const [mejorRacha, setMejorRacha] = useState(0)

  // Ricky: UNA sola presencia en pantalla (regla del handoff de diseño —
  // nunca dos Rickys a la vez). Saluda al entrar (Wave ×2), después queda
  // respirando (Breathe/Idle) hasta que hay algo que reaccionar: rebota
  // feliz en un acierto, hace un pequeño Shake (confundido) en un error, piensa mientras
  // carga un "Explicar", y termina festejando (Bounce en loop) si el
  // módulo se completó perfecto.
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
    const cSubs = Object.values(subs).filter(e => e.evaluado && e.correcto).length
    const cCompleta = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    const cDibujo = dibujoEvaluado && dibujoCorrecto ? 1 : 0
    return cSubs + cCompleta + cDibujo
  }, [subs, completa, dibujoEvaluado, dibujoCorrecto])

  const totalEvaluadas = useMemo(() => {
    const eSubs = Object.values(subs).filter(e => e.evaluado).length
    const eCompleta = Object.values(completa).filter(e => e.evaluado).length
    return eSubs + eCompleta + (dibujoEvaluado ? 1 : 0)
  }, [subs, completa, dibujoEvaluado])

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

  // Se lee el estado actual del closure (no la forma funcional de setState)
  // porque acá SÍ importa ejecutar el sonido una sola vez, exactamente
  // cuando el usuario hace clic — dentro de un updater de setState el efecto
  // de sonido podría dispararse más de una vez (p. ej. en modo estricto de
  // desarrollo, que invoca los updaters dos veces).
  function comprobarSub(g: Grafico, p: SubPregunta) {
    const id = idSub(g.numero, p.letra)
    const actual = subs[id]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = p.aceptables.map(normalizarTexto).includes(normalizarTexto(actual.valor))
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setSubs(prev => ({ ...prev, [id]: { ...prev[id], evaluado: true, correcto } }))
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

  function comprobarDibujo() {
    if (dibujoEvaluado) return
    const correcto = OBJETIVOS.every(o => valoresDibujo[o.nombre] === o.objetivo)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setDibujoEvaluado(true)
    setDibujoCorrecto(correcto)
  }

  function reiniciar() {
    setSubs(Object.fromEntries(GRAFICOS.flatMap(g => g.preguntas.map(p => [idSub(g.numero, p.letra), { ...ESTADO_INICIAL }]))))
    setCompleta(Object.fromEntries(COMPLETAR.map(p => [p.numero, { ...ESTADO_INICIAL }])))
    setValoresDibujo(Object.fromEntries(OBJETIVOS.map(o => [o.nombre, 0])))
    setDibujoEvaluado(false)
    setDibujoCorrecto(false)
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #f87171 0%, #fecaca 35%, #fef9c3 100%)',
      color: '#7f1d1d', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #ef4444, #dc2626)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #7f1d1d', borderBottom: '4px solid #7f1d1d',
      }}>
        <BotonMenu />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>📊📚</div>
        <h1 style={{
          fontSize: 'clamp(1.2rem, 4.5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #7f1d1d', margin: 0, color: 'white',
        }}>
          ¡Gráficos de barras!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Leé cada gráfico y respondé las preguntas
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '2rem' }}>
          {GRAFICOS.map((g, i) => (
            <TarjetaGrafico key={g.numero} g={g} color={COLORES[i % COLORES.length]}
              subs={subs} onCambiar={(id, valor) => setSubs(prev => ({ ...prev, [id]: { ...prev[id], valor } }))}
              onComprobar={p => comprobarSub(g, p)} onExplicarEstado={reaccionarRickyExplicar} />
          ))}

          <TarjetaDibujar
            color={COLORES[GRAFICOS.length % COLORES.length]}
            valores={valoresDibujo}
            evaluado={dibujoEvaluado}
            correcto={dibujoCorrecto}
            onCambiar={(nombre, valor) => setValoresDibujo(prev => ({ ...prev, [nombre]: valor }))}
            onComprobar={comprobarDibujo}
          />
        </div>

        <div style={{
          background: 'white', border: '3px solid #fca5a5', boxShadow: '0 4px 0 rgba(127,29,29,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7f1d1d' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(127,29,29,0.15))' }}
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
                ? '¡Perfecto! Dominás los gráficos de barras 🎮'
                : totalCorrectas >= TOTAL_PREGUNTAS - 2
                ? '¡Muy bien! Ya casi los dominás.'
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

// Barras de solo lectura (los tres gráficos 1-3) — alto proporcional al
// valor sobre el eje máximo de ESE gráfico.
function GraficoBarras({ categorias, ejeMax, color }: { categorias: Categoria[]; ejeMax: number; color: string }) {
  const ALTURA_MAX = 110
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '0.3rem', padding: '0.5rem 0' }}>
      {categorias.map((c, i) => {
        const h = Math.max(6, (c.valor / ejeMax) * ALTURA_MAX)
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: 2 }}>{c.valor}</span>
            <div style={{ width: '65%', height: h, background: color, borderRadius: '6px 6px 0 0', transition: 'height 0.3s' }} />
            <span style={{ fontSize: '1rem', marginTop: 3 }}>{c.emoji}</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, textAlign: 'center', marginTop: 1, overflowWrap: 'break-word' }}>{c.nombre}</span>
          </div>
        )
      })}
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con un gráfico y categorías distintas
// a los 3 de la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const categorias: Categoria[] = [
    { nombre: 'Manzanas', valor: 4, emoji: '🍎' },
    { nombre: 'Peras', valor: 7, emoji: '🍐' },
    { nombre: 'Uvas', valor: 2, emoji: '🍇' },
  ]

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🧺</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, minWidth: 0, color: '#7f1d1d' }}>Frutas del huerto</p>
        <BotonEscuchar texto={`Ejemplo: frutas del huerto: manzanas, 4. Peras, 7. Uvas, 2. ¿Qué fruta tiene más bloques? Busco la barra más alta. Las peras tienen 7 bloques, la barra más alta — por eso tienen más.`} tamano={32} />
      </div>

      <GraficoBarras categorias={categorias} ejeMax={10} color={color} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem',
        padding: '0.5rem', borderRadius: 10, border: '2px solid #22c55e', background: '#f0fdf4',
      }}>
        <span style={{ fontSize: '0.85rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#7f1d1d', flex: '1 1 auto' }}>
          a) ¿Qué fruta tiene más bloques?
        </span>
        <span style={{
          padding: '0.3rem 0.6rem', borderRadius: 8, border: '2px solid #22c55e', background: 'white',
          color: '#16a34a', fontSize: '0.9rem', fontWeight: 800,
        }}>
          Peras
        </span>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}>✅</span>
      </div>
      <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', textAlign: 'center', color: '#7f1d1d', opacity: 0.85 }}>
        Busco la barra más alta. Las peras tienen 7 bloques, la barra más alta del gráfico — por eso tienen más.
      </p>
    </div>
  )
}

function TarjetaGrafico({ g, color, subs, onCambiar, onComprobar, onExplicarEstado }: {
  g: Grafico
  color: string
  subs: Record<string, EstadoPregunta>
  onCambiar: (id: string, valor: string) => void
  onComprobar: (p: SubPregunta) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const lecturaCompleta = `${g.titulo}: ` + g.categorias.map(c => `${c.nombre}, ${c.valor}`).join('. ')

  return (
    <div style={{
      background: 'white', border: `3px solid ${color}`, boxShadow: `0 4px 0 ${color}55`,
      borderRadius: 18, padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          {g.numero}
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{g.emoji}</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, minWidth: 0, color: '#7f1d1d', overflowWrap: 'break-word' }}>{g.titulo}</p>
        <BotonEscuchar texto={lecturaCompleta} tamano={32} />
      </div>

      <GraficoBarras categorias={g.categorias} ejeMax={g.ejeMax} color={color} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
        {g.preguntas.map(p => (
          <FilaSubPregunta key={p.letra} g={g} p={p} color={color}
            estado={subs[idSub(g.numero, p.letra)]}
            onCambiar={valor => onCambiar(idSub(g.numero, p.letra), valor)}
            onComprobar={() => onComprobar(p)} onExplicarEstado={onExplicarEstado} />
        ))}
      </div>
    </div>
  )
}

function FilaSubPregunta({ p, color, estado, onCambiar, onComprobar, onExplicarEstado }: {
  g: Grafico
  p: SubPregunta
  color: string
  estado: EstadoPregunta
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : `${color}33`

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap',
      padding: '0.5rem', borderRadius: 10, border: `2px solid ${borde}`, background: '#fef2f2',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} tamano={28} />
      <span style={{ fontSize: '0.85rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#7f1d1d', flex: '1 1 auto' }}>
        {p.letra}) {p.texto}
      </span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 74, padding: '0.3rem 0.4rem', borderRadius: 8, border: '2px solid #fca5a5',
          background: 'white', color: '#7f1d1d', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center', flexShrink: 0,
        }}
      />
      {!estado.evaluado ? (
        <button onClick={onComprobar} disabled={estado.valor.trim() === ''} style={{
          padding: '0.35rem 0.6rem', borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: estado.valor.trim() === '' ? '#e2e8f0' : '#22c55e',
          boxShadow: estado.valor.trim() === '' ? 'none' : '0 2px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '0.85rem',
          opacity: estado.valor.trim() === '' ? 0.7 : 1,
        }}>
          ✓
        </button>
      ) : (
        <>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, flexShrink: 0, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅' : `❌ (${p.aceptables[0]})`}
          </span>
          <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
        </>
      )}
    </div>
  )
}

// Ejercicio "Dibuja las barras": el chico ajusta 3 barras con +/- hasta
// que coincidan con el dato dado (Esmeraldas 4, Rubíes 7, Amatistas 5) —
// traduce el "dibujá la barra" del papel a algo que sí se puede evaluar en
// pantalla, en vez de una respuesta de texto suelta.
function TarjetaDibujar({ color, valores, evaluado, correcto, onCambiar, onComprobar }: {
  color: string
  valores: Record<string, number>
  evaluado: boolean
  correcto: boolean
  onCambiar: (nombre: string, valor: number) => void
  onComprobar: () => void
}) {
  const ALTURA_MAX = 100
  const todosListos = OBJETIVOS.every(o => valores[o.nombre] > 0)
  const lectura = '¿Podés armar las barras según los datos? ' + OBJETIVOS.map(o => `${o.nombre}, ${o.objetivo}`).join('. ')

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${evaluado ? (correcto ? '#22c55e' : '#ef4444') : color}`,
      boxShadow: `0 4px 0 ${evaluado ? (correcto ? '#22c55e' : '#ef4444') : color}55`,
      borderRadius: 18, padding: '1rem',
      animation: evaluado ? (correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {evaluado && correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: color, color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          4
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🏗️</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, minWidth: 0, color: '#7f1d1d', overflowWrap: 'break-word' }}>
          Completá el gráfico
        </p>
        <BotonEscuchar texto={lectura} tamano={32} />
      </div>

      <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: '0 0 0.75rem', fontWeight: 600 }}>
        Ajustá las barras con + y − hasta que coincidan con el dato de cada mineral.
      </p>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '0.4rem' }}>
        {OBJETIVOS.map(o => {
          const valor = valores[o.nombre]
          const h = Math.max(4, (valor / EJE_MAX_DIBUJO) * ALTURA_MAX)
          return (
            <div key={o.nombre} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: 0 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, marginBottom: 4 }}>{valor} / {o.objetivo}</span>
              <div style={{
                width: '70%', height: ALTURA_MAX + 10, display: 'flex', alignItems: 'flex-end',
                background: '#fef2f2', borderRadius: 6, overflow: 'hidden',
              }}>
                <div style={{ width: '100%', height: h, background: color, transition: 'height 0.2s' }} />
              </div>
              <span style={{ fontSize: '1.1rem', marginTop: 4 }}>{o.emoji}</span>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textAlign: 'center', overflowWrap: 'break-word' }}>{o.nombre}</span>
              <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.4rem' }}>
                <button onClick={() => onCambiar(o.nombre, Math.max(0, valor - 1))} disabled={evaluado} style={{
                  width: 26, height: 26, borderRadius: 8, border: 'none', cursor: evaluado ? 'default' : 'pointer',
                  background: '#fecaca', color: '#7f1d1d', fontWeight: 800, opacity: evaluado ? 0.5 : 1,
                }}>
                  −
                </button>
                <button onClick={() => onCambiar(o.nombre, Math.min(EJE_MAX_DIBUJO, valor + 1))} disabled={evaluado} style={{
                  width: 26, height: 26, borderRadius: 8, border: 'none', cursor: evaluado ? 'default' : 'pointer',
                  background: '#bbf7d0', color: '#14532d', fontWeight: 800, opacity: evaluado ? 0.5 : 1,
                }}>
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {!evaluado ? (
        <button onClick={onComprobar} disabled={!todosListos} style={{
          width: '100%', marginTop: '0.85rem', padding: '0.6rem', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: !todosListos ? '#e2e8f0' : '#22c55e',
          boxShadow: !todosListos ? 'none' : '0 3px 0 #15803d',
          color: 'white', fontWeight: 800, fontSize: '1rem',
          opacity: !todosListos ? 0.7 : 1,
        }}>
          Comprobar ✓
        </button>
      ) : (
        <p style={{ marginTop: '0.75rem', fontSize: '1rem', textAlign: 'center', fontWeight: 800, color: correcto ? '#16a34a' : '#dc2626' }}>
          {correcto ? '✅ ¡Correcto!' : '❌ Alguna barra no coincide — mirá los números de arriba'}
        </p>
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#fca5a5'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fef2f2',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#7f1d1d' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #fca5a5',
          background: 'white', color: '#7f1d1d', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#7f1d1d' }}>{p.despues}</span>
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
