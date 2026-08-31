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

// ── Datos de la actividad (basados en la hoja "Actividad 9 - Gráficos").
// Tres puntos confirmados a mano por el usuario, sin una única lectura
// obvia: (3a) "ascendió/descendió" se lee de forma literal sobre el
// gráfico — el valor sube, así que la respuesta es "ascendió", sin entrar
// en la sutileza de que más profundidad es más abajo en el agua; (3c) hay
// tres tramos válidos donde la profundidad sube (día 1-2, día 2-3, día
// 4-5) y se aceptan los tres; (Completa 3) el total de peces usa la tabla
// del ítem 4 (38), no la del ítem 1 (41) — son datasets independientes de
// la hoja, no el mismo arrecife contado dos veces.

interface CategoriaBarra { nombre: string; valor: number; emoji: string }

const PECES_COLOR: CategoriaBarra[] = [
  { nombre: 'Rojo', valor: 12, emoji: '🔴' },
  { nombre: 'Azul', valor: 8, emoji: '🔵' },
  { nombre: 'Amarillo', valor: 15, emoji: '🟡' },
  { nombre: 'Verde', valor: 6, emoji: '🟢' },
]

interface SubPregunta {
  letra: string
  texto: string
  lectura: string
  explicacion: string
  esCorrecta: (valor: string) => boolean
}

function coincide(valor: string, aceptables: string[]): boolean {
  return aceptables.map(normalizarTexto).includes(normalizarTexto(valor))
}

const PREGUNTAS_BARRAS: SubPregunta[] = [
  { letra: 'a', texto: '¿Qué color de pez hay en mayor cantidad?', lectura: '¿Qué color de pez hay en mayor cantidad?', explicacion: 'Busco la barra más alta: el amarillo, con 15 peces.', esCorrecta: v => coincide(v, ['amarillo']) },
  { letra: 'b', texto: '¿Qué color de pez hay en menor cantidad?', lectura: '¿Qué color de pez hay en menor cantidad?', explicacion: 'Busco la barra más baja: el verde, con 6 peces.', esCorrecta: v => coincide(v, ['verde']) },
  { letra: 'c', texto: '¿Cuántos peces rojos y azules hay en total?', lectura: '¿Cuántos peces rojos y azules hay en total?', explicacion: 'Sumo las dos barras: 12 + 8 = 20.', esCorrecta: v => coincide(v, ['20']) },
  { letra: 'd', texto: '¿Cuántos peces amarillos y verdes hay en total?', lectura: '¿Cuántos peces amarillos y verdes hay en total?', explicacion: 'Sumo las dos barras: 15 + 6 = 21.', esCorrecta: v => coincide(v, ['21']) },
]

interface CategoriaPictograma { nombre: string; iconos: number; emoji: string }

const CORALES: CategoriaPictograma[] = [
  { nombre: 'Coral rojo', iconos: 4, emoji: '🔴' },
  { nombre: 'Coral morado', iconos: 3, emoji: '🟣' },
  { nombre: 'Coral azul', iconos: 5, emoji: '🔵' },
  { nombre: 'Coral amarillo', iconos: 2, emoji: '🟡' },
]

const PREGUNTAS_PICTOGRAMA: SubPregunta[] = [
  { letra: 'a', texto: '¿Cuántas unidades hay de coral rojo?', lectura: '¿Cuántas unidades hay de coral rojo?', explicacion: '4 íconos × 5 = 20 unidades.', esCorrecta: v => coincide(v, ['20']) },
  { letra: 'b', texto: '¿Cuántas unidades hay de coral morado?', lectura: '¿Cuántas unidades hay de coral morado?', explicacion: '3 íconos × 5 = 15 unidades.', esCorrecta: v => coincide(v, ['15']) },
  { letra: 'c', texto: '¿Cuántas unidades hay de coral azul?', lectura: '¿Cuántas unidades hay de coral azul?', explicacion: '5 íconos × 5 = 25 unidades.', esCorrecta: v => coincide(v, ['25']) },
  { letra: 'd', texto: '¿Cuántas unidades hay de coral amarillo?', lectura: '¿Cuántas unidades hay de coral amarillo?', explicacion: '2 íconos × 5 = 10 unidades.', esCorrecta: v => coincide(v, ['10']) },
  { letra: 'e', texto: '¿Qué tipo de coral hay en mayor cantidad?', lectura: '¿Qué tipo de coral hay en mayor cantidad?', explicacion: 'El coral azul tiene más íconos (5), así que hay más unidades: 25.', esCorrecta: v => coincide(v, ['azul', 'coral azul']) },
  { letra: 'f', texto: '¿Cuántas unidades de coral hay en total?', lectura: '¿Cuántas unidades de coral hay en total?', explicacion: 'Sumo todos: 20 + 15 + 25 + 10 = 70.', esCorrecta: v => coincide(v, ['70']) },
]

interface PuntoLinea { dia: number; valor: number }

const DELFIN: PuntoLinea[] = [
  { dia: 1, valor: 15 }, { dia: 2, valor: 25 }, { dia: 3, valor: 35 }, { dia: 4, valor: 20 }, { dia: 5, valor: 30 },
]

const PREGUNTAS_LINEA: SubPregunta[] = [
  { letra: 'a', texto: '¿El delfín descendió o ascendió del día 1 al día 3?', lectura: '¿El delfín descendió o ascendió del día uno al día tres?', explicacion: 'La profundidad pasó de 15 a 35 — el valor subió, así que ascendió en el gráfico.', esCorrecta: v => coincide(v, ['ascendio']) },
  { letra: 'b', texto: '¿Qué día alcanzó mayor profundidad?', lectura: '¿Qué día alcanzó mayor profundidad?', explicacion: 'El punto más alto del gráfico es el día 3, con 35 metros.', esCorrecta: v => coincide(v, ['3', 'dia 3', 'el dia 3']) },
  {
    letra: 'c', texto: '¿Entre qué días subió de profundidad? (cualquiera de los tramos vale)', lectura: '¿Entre qué días subió de profundidad?',
    explicacion: 'Subió en tres tramos: del día 1 al 2, del día 2 al 3, y del día 4 al 5 — cualquiera de esos tres es correcto.',
    esCorrecta: v => {
      const n = normalizarTexto(v).replace(/\s+/g, '')
      const tramos = [['1', '2'], ['2', '3'], ['4', '5']]
      return tramos.some(([a, b]) => n.includes(`${a}y${b}`) || n.includes(`${a}-${b}`) || (n.includes(a) && n.includes(b)))
    },
  },
  { letra: 'd', texto: '¿Cuántos metros de profundidad tuvo el delfín el día 4?', lectura: '¿Cuántos metros de profundidad tuvo el delfín el día cuatro?', explicacion: 'Leo el punto del día 4 en el gráfico: 20 metros.', esCorrecta: v => coincide(v, ['20']) },
]

interface EspecieObjetivo { nombre: string; emoji: string; objetivo: number }
const ESPECIES: EspecieObjetivo[] = [
  { nombre: 'Pez payaso', emoji: '🐠', objetivo: 10 },
  { nombre: 'Pez cirujano', emoji: '🐟', objetivo: 14 },
  { nombre: 'Pez ángel', emoji: '🐡', objetivo: 6 },
  { nombre: 'Pez globo', emoji: '🐳', objetivo: 8 },
]
const EJE_MAX_DIBUJO = 16

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
    numero: 1, antes: 'En un pictograma, cada dibujo vale', despues: 'de uno.',
    aceptables: ['mas'],
    lectura: 'En un pictograma, cada dibujo vale más o menos de uno, ¿cuál es?',
    explicacion: 'En un pictograma, cada dibujo puede valer más de una unidad — por eso hay que fijarse siempre en la clave (ej. "cada ícono vale 5").',
  },
  {
    numero: 2, antes: 'Para mostrar cambios en el tiempo uso un gráfico de', despues: '.',
    aceptables: ['lineas'],
    lectura: 'Para mostrar cambios en el tiempo, ¿qué tipo de gráfico conviene usar?',
    explicacion: 'El gráfico de líneas conecta los puntos en orden, así que muestra muy bien cómo sube o baja algo con el tiempo.',
  },
  {
    numero: 3, antes: 'En el arrecife hay', despues: 'peces en total.',
    aceptables: ['38'],
    lectura: '¿Cuántos peces hay en total en el arrecife?',
    explicacion: 'Sumo las 4 especies de la tabla: 10 + 14 + 6 + 8 = 38.',
  },
]

const TOTAL_PREGUNTAS = PREGUNTAS_BARRAS.length + PREGUNTAS_PICTOGRAMA.length + PREGUNTAS_LINEA.length + 1 + 1 + COMPLETAR.length

// ── Bloque de estado ──

interface EstadoSub { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoSimple { valor: string; evaluado: boolean; correcto: boolean }
interface EstadoEleccion { seleccion: string; evaluado: boolean; correcto: boolean }

function idSub(grupo: string, letra: string) {
  return `${grupo}-${letra}`
}

export default function CuartoModulo09() {
  const { user } = useAuth()
  const { perfilActivo } = usePerfil()
  const [subs, setSubs] = useState<Record<string, EstadoSub>>(() => {
    const base: Record<string, EstadoSub> = {}
    for (const p of PREGUNTAS_BARRAS) base[idSub('barras', p.letra)] = { valor: '', evaluado: false, correcto: false }
    for (const p of PREGUNTAS_PICTOGRAMA) base[idSub('picto', p.letra)] = { valor: '', evaluado: false, correcto: false }
    for (const p of PREGUNTAS_LINEA) base[idSub('linea', p.letra)] = { valor: '', evaluado: false, correcto: false }
    return base
  })
  const [dibujo, setDibujo] = useState<Record<string, string>>(() => Object.fromEntries(ESPECIES.map(e => [e.nombre, ''])))
  const [dibujoEvaluado, setDibujoEvaluado] = useState(false)
  const [dibujoCorrecto, setDibujoCorrecto] = useState(false)
  const [tipoGrafico, setTipoGrafico] = useState<EstadoEleccion>({ seleccion: '', evaluado: false, correcto: false })
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
    const a = Object.values(subs).filter(e => e.evaluado && e.correcto).length
    const b = dibujoEvaluado && dibujoCorrecto ? 1 : 0
    const c = tipoGrafico.evaluado && tipoGrafico.correcto ? 1 : 0
    const d = Object.values(completa).filter(e => e.evaluado && e.correcto).length
    return a + b + c + d
  }, [subs, dibujoEvaluado, dibujoCorrecto, tipoGrafico, completa])

  const totalEvaluadas = useMemo(() => {
    const a = Object.values(subs).filter(e => e.evaluado).length
    const b = dibujoEvaluado ? 1 : 0
    const c = tipoGrafico.evaluado ? 1 : 0
    const d = Object.values(completa).filter(e => e.evaluado).length
    return a + b + c + d
  }, [subs, dibujoEvaluado, tipoGrafico, completa])

  const terminado = totalEvaluadas === TOTAL_PREGUNTAS

  if (terminado && !fanfarriaSonada.current) {
    fanfarriaSonada.current = true
    if (totalCorrectas >= TOTAL_PREGUNTAS - 2) setTimeout(reproducirFanfarria, 150)
  }

  useEffect(() => {
    terminadoRef.current = terminado
    if (terminado) {
      setRickyMood(totalCorrectas === TOTAL_PREGUNTAS ? 'celebrating' : totalCorrectas >= TOTAL_PREGUNTAS - 3 ? 'happy' : 'encouraging')
    }
  }, [terminado, totalCorrectas])

  useEffect(() => {
    if (!terminado) { progresoGuardado.current = false; return }
    if (!user || !perfilActivo || progresoGuardado.current) return
    progresoGuardado.current = true
    guardarProgresoModulo(user.uid, perfilActivo.id, 'cuarto-modulo-09', {
      correctas: totalCorrectas, total: TOTAL_PREGUNTAS, puntos, mejorRacha,
    })
  }, [terminado, user, perfilActivo, totalCorrectas, puntos, mejorRacha])


  function comprobarSub(grupo: string, p: SubPregunta) {
    const id = idSub(grupo, p.letra)
    const actual = subs[id]
    if (actual.evaluado || actual.valor.trim() === '') return
    const correcto = p.esCorrecta(actual.valor)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setSubs(prev => ({ ...prev, [id]: { ...prev[id], evaluado: true, correcto } }))
  }

  function comprobarDibujo() {
    if (dibujoEvaluado || ESPECIES.some(e => dibujo[e.nombre].trim() === '')) return
    const correcto = ESPECIES.every(e => Number(dibujo[e.nombre].trim()) === e.objetivo)
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setDibujoEvaluado(true)
    setDibujoCorrecto(correcto)
  }

  function elegirTipoGrafico(opcion: string) {
    if (tipoGrafico.evaluado) return
    const correcto = opcion === 'Líneas'
    if (correcto) reproducirCorrecto(); else reproducirIncorrecto()
    registrarResultado(correcto)
    reaccionarRicky(correcto)
    setTipoGrafico({ seleccion: opcion, evaluado: true, correcto })
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
    setSubs(prev => Object.fromEntries(Object.keys(prev).map(k => [k, { valor: '', evaluado: false, correcto: false }])))
    setDibujo(Object.fromEntries(ESPECIES.map(e => [e.nombre, ''])))
    setDibujoEvaluado(false)
    setDibujoCorrecto(false)
    setTipoGrafico({ seleccion: '', evaluado: false, correcto: false })
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
      minHeight: '100vh', overflowX: 'hidden', background: 'linear-gradient(180deg, #ec4899 0%, #fbcfe8 35%, #fdf2f8 100%)',
      color: '#831843', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <div style={{
        position: 'relative',
        background: 'linear-gradient(135deg, #f472b6, #db2777)', padding: '1.75rem 1rem',
        textAlign: 'center', boxShadow: '0 5px 0 #831843', borderBottom: '4px solid #831843',
      }}>
        <BotonMenu href="/cuarto-menu" />
        <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>🪸📊</div>
        <h1 style={{
          fontSize: 'clamp(1.3rem, 5vw, 2.2rem)', fontWeight: 800, letterSpacing: '0.01em',
          textShadow: '2px 2px 0 #831843', margin: 0, color: 'white',
        }}>
          ¡Gráficos!
        </h1>
        <p style={{ opacity: 0.95, marginTop: '0.5rem', fontSize: '1.05rem', color: 'white', fontWeight: 600 }}>
          Leé los gráficos del arrecife y respondé
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
            <BarraProgreso completadas={totalEvaluadas} total={TOTAL_PREGUNTAS} color="#db2777" />
          </div>
        </div>

        <TarjetaEjemplo />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '2rem' }}>
          <TarjetaGrupo numero={1} titulo="Peces por color" emoji="🐠"
            lecturaCompleta={`Peces por color: ${PECES_COLOR.map(c => `${c.nombre}, ${c.valor}`).join('. ')}`}>
            <GraficoBarras categorias={PECES_COLOR} ejeMax={20} color="#db2777" />
            {PREGUNTAS_BARRAS.map(p => (
              <FilaSubPregunta key={p.letra} p={p} estado={subs[idSub('barras', p.letra)]}
                onCambiar={valor => setSubs(prev => ({ ...prev, [idSub('barras', p.letra)]: { ...prev[idSub('barras', p.letra)], valor } }))}
                onComprobar={() => comprobarSub('barras', p)} onExplicarEstado={reaccionarRickyExplicar} />
            ))}
          </TarjetaGrupo>

          <TarjetaGrupo numero={2} titulo="Coral del arrecife" emoji="🪸"
            lecturaCompleta={`Coral del arrecife, cada ícono vale 5 unidades: ${CORALES.map(c => `${c.nombre}, ${c.iconos} íconos`).join('. ')}`}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.75, margin: '0 0 0.5rem' }}>Cada ícono representa 5 unidades.</p>
            <Pictograma categorias={CORALES} />
            {PREGUNTAS_PICTOGRAMA.map(p => (
              <FilaSubPregunta key={p.letra} p={p} estado={subs[idSub('picto', p.letra)]}
                onCambiar={valor => setSubs(prev => ({ ...prev, [idSub('picto', p.letra)]: { ...prev[idSub('picto', p.letra)], valor } }))}
                onComprobar={() => comprobarSub('picto', p)} onExplicarEstado={reaccionarRickyExplicar} />
            ))}
          </TarjetaGrupo>

          <TarjetaGrupo numero={3} titulo="Profundidad del delfín (metros)" emoji="🐬"
            lecturaCompleta={`Profundidad del delfín: ${DELFIN.map(d => `día ${d.dia}, ${d.valor} metros`).join('. ')}`}>
            <GraficoLineas datos={DELFIN} />
            {PREGUNTAS_LINEA.map(p => (
              <FilaSubPregunta key={p.letra} p={p} estado={subs[idSub('linea', p.letra)]}
                onCambiar={valor => setSubs(prev => ({ ...prev, [idSub('linea', p.letra)]: { ...prev[idSub('linea', p.letra)], valor } }))}
                onComprobar={() => comprobarSub('linea', p)} onExplicarEstado={reaccionarRickyExplicar} />
            ))}
          </TarjetaGrupo>

          <TarjetaDibujar
            evaluado={dibujoEvaluado} correcto={dibujoCorrecto} valores={dibujo}
            onCambiar={(nombre, valor) => setDibujo(prev => ({ ...prev, [nombre]: valor }))}
            onComprobar={comprobarDibujo} onExplicarEstado={reaccionarRickyExplicar}
          />

          <TarjetaTipoGrafico estado={tipoGrafico} onElegir={elegirTipoGrafico} onExplicarEstado={reaccionarRickyExplicar} />
        </div>

        <div style={{
          background: 'white', border: '3px solid #f9a8d4', boxShadow: '0 4px 0 rgba(131,24,67,0.15)',
          borderRadius: 20, padding: '1.25rem 1.25rem 1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#831843' }}>
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
            style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 40, pointerEvents: 'none', filter: 'drop-shadow(0 3px 0 rgba(131,24,67,0.15))' }}
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
            <p style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '0.3rem', color: '#831843' }}>
              {totalCorrectas} de {TOTAL_PREGUNTAS} correctas
            </p>
            <p style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#db2777' }}>
              ⭐ {puntos} pts · 🔥 Mejor racha: {mejorRacha}
            </p>
            <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontSize: '1rem', fontWeight: 600 }}>
              {totalCorrectas === TOTAL_PREGUNTAS
                ? '¡Perfecto! Dominás la lectura de gráficos 🎮'
                : totalCorrectas >= TOTAL_PREGUNTAS - 3
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

function TarjetaGrupo({ numero, titulo, emoji, lecturaCompleta, children }: {
  numero: number; titulo: string; emoji: string; lecturaCompleta: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'white', border: '3px solid #db2777', boxShadow: '0 4px 0 rgba(219,39,119,0.35)',
      borderRadius: 18, padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: '#db2777', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          {numero}
        </span>
        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{emoji}</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, minWidth: 0, color: '#831843', overflowWrap: 'break-word' }}>{titulo}</p>
        <BotonEscuchar texto={lecturaCompleta} tamano={32} />
      </div>
      {children}
    </div>
  )
}

function GraficoBarras({ categorias, ejeMax, color }: { categorias: CategoriaBarra[]; ejeMax: number; color: string }) {
  const ALTURA_MAX = 100
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

function Pictograma({ categorias }: { categorias: CategoriaPictograma[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {categorias.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, width: 100, flexShrink: 0 }}>{c.nombre}</span>
          <span style={{ fontSize: '1.1rem', letterSpacing: '0.1rem' }}>{c.emoji.repeat(c.iconos)}</span>
        </div>
      ))}
    </div>
  )
}

function GraficoLineas({ datos }: { datos: PuntoLinea[] }) {
  const vw = 280, vh = 130, padL = 24, padR = 12, padT = 14, padB = 20
  const maxY = 40
  const plotW = vw - padL - padR
  const plotH = vh - padT - padB
  const n = datos.length
  const puntos = datos.map((d, i) => ({
    x: padL + (i / (n - 1)) * plotW,
    y: padT + plotH - (d.valor / maxY) * plotH,
    ...d,
  }))
  const linea = puntos.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" style={{ maxWidth: 320, display: 'block', margin: '0 auto' }}>
      {[0, 10, 20, 30, 40].map(v => {
        const y = padT + plotH - (v / maxY) * plotH
        return <line key={v} x1={padL} y1={y} x2={vw - padR} y2={y} stroke="#fbcfe8" strokeWidth={1} />
      })}
      <polyline points={linea} fill="none" stroke="#db2777" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#db2777" stroke="white" strokeWidth={1.5} />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fontWeight={800} fill="#831843">{p.valor}</text>
          <text x={p.x} y={vh - 4} textAnchor="middle" fontSize={8} fontWeight={700} fill="#831843">D{p.dia}</text>
        </g>
      ))}
    </svg>
  )
}

function FilaSubPregunta({ p, estado, onCambiar, onComprobar, onExplicarEstado }: {
  p: SubPregunta
  estado: EstadoSub
  onCambiar: (valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onComprobar()
  }

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#f9a8d4'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap',
      padding: '0.5rem', borderRadius: 10, border: `2px solid ${borde}`, background: '#fdf2f8', marginTop: '0.5rem',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} tamano={28} />
      <span style={{ fontSize: '0.85rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#831843', flex: '1 1 auto' }}>
        {p.letra}) {p.texto}
      </span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 90, padding: '0.3rem 0.4rem', borderRadius: 8, border: '2px solid #f9a8d4',
          background: 'white', color: '#831843', fontSize: '0.9rem', fontWeight: 700, textAlign: 'center', flexShrink: 0,
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
            {estado.correcto ? '✅' : '❌'}
          </span>
          <BotonExplicar texto={p.explicacion} onEstadoCambia={onExplicarEstado} />
        </>
      )}
    </div>
  )
}

function TarjetaDibujar({ evaluado, correcto, valores, onCambiar, onComprobar, onExplicarEstado }: {
  evaluado: boolean
  correcto: boolean
  valores: Record<string, string>
  onCambiar: (nombre: string, valor: string) => void
  onComprobar: () => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const bordeColor = evaluado ? (correcto ? '#22c55e' : '#ef4444') : '#db2777'
  const faltan = ESPECIES.some(e => valores[e.nombre].trim() === '')

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem',
      animation: evaluado ? (correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {evaluado && correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: '#db2777', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          4
        </span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: '#831843' }}>Completá el gráfico</p>
        <BotonEscuchar texto={'Mirá la tabla y escribí, para cada especie, cuántos peces hay según la tabla, para armar el gráfico de barras. ' + ESPECIES.map(e => `${e.nombre}, ${e.objetivo}`).join('. ')} tamano={32} />
      </div>

      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#831843', margin: '0 0 0.7rem', opacity: 0.85 }}>
        Mirá la tabla y escribí, en cada casillero, cuántos peces hay de esa especie — así armás el gráfico de barras.
      </p>

      <table style={{ width: '100%', maxWidth: 320, margin: '0 auto 0.9rem', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', background: '#db2777', color: 'white', borderRadius: '8px 0 0 0' }}>ESPECIE</th>
            <th style={{ textAlign: 'center', padding: '0.35rem 0.5rem', background: '#db2777', color: 'white', borderRadius: '0 8px 0 0' }}>N.º DE PECES</th>
          </tr>
        </thead>
        <tbody>
          {ESPECIES.map((e, i) => (
            <tr key={e.nombre} style={{ background: i % 2 === 0 ? '#fdf2f8' : 'white' }}>
              <td style={{ padding: '0.35rem 0.5rem', fontWeight: 700, color: '#831843' }}>{e.emoji} {e.nombre}</td>
              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center', fontWeight: 800, color: '#db2777' }}>{e.objetivo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        {ESPECIES.map(e => (
          <div key={e.nombre} style={{
            flex: '1 1 120px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem',
            padding: '0.4rem 0.6rem', borderRadius: 10, background: '#fdf2f8', border: '2px solid #f9a8d4',
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#831843' }}>{e.emoji} {e.nombre}</span>
            <input
              type="number" inputMode="numeric" value={valores[e.nombre]} disabled={evaluado}
              onChange={ev => onCambiar(e.nombre, ev.target.value)}
              placeholder="?"
              style={{ width: 44, padding: '0.25rem', borderRadius: 6, border: '2px solid #f9a8d4', background: 'white', color: '#831843', fontWeight: 700, textAlign: 'center' }}
            />
          </div>
        ))}
      </div>

      {evaluado && (
        <GraficoBarras categorias={ESPECIES.map(e => ({ nombre: e.nombre, valor: e.objetivo, emoji: e.emoji }))} ejeMax={EJE_MAX_DIBUJO} color="#db2777" />
      )}

      {!evaluado && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={onComprobar} disabled={faltan} style={{
            padding: '0.5rem 1.2rem', borderRadius: 12, border: 'none', cursor: faltan ? 'default' : 'pointer',
            background: faltan ? '#e2e8f0' : '#22c55e',
            boxShadow: faltan ? 'none' : '0 3px 0 #15803d',
            color: 'white', fontWeight: 800, fontSize: '0.95rem', opacity: faltan ? 0.7 : 1,
          }}>
            ✓ Comprobar
          </button>
        </div>
      )}

      {evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: correcto ? '#16a34a' : '#dc2626' }}>
            {correcto ? '✅ ¡Correcto!' : '❌ Revisá los valores contra la tabla'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto={`Copiamos cada valor de la tabla a su barra: ${ESPECIES.map(e => `${e.nombre} ${e.objetivo}`).join(', ')}.`} onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

function TarjetaTipoGrafico({ estado, onElegir, onExplicarEstado }: {
  estado: EstadoEleccion
  onElegir: (opcion: string) => void
  onExplicarEstado: (estado: 'idle' | 'cargando' | 'error') => void
}) {
  const OPCIONES = [
    { valor: 'Barras', emoji: '📊' },
    { valor: 'Líneas', emoji: '📈' },
    { valor: 'Pictograma', emoji: '🪸' },
  ]
  const bordeColor = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#db2777'

  return (
    <div style={{
      position: 'relative',
      background: 'white', border: `3px solid ${bordeColor}`, boxShadow: `0 4px 0 ${bordeColor}55`,
      borderRadius: 18, padding: '1rem',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, background: '#db2777', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0,
        }}>
          5
        </span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, color: '#831843' }}>¿Qué gráfico conviene más para mostrar cambios en el tiempo?</p>
        <BotonEscuchar texto="¿Qué gráfico conviene más para mostrar cambios en el tiempo: barras, líneas, o pictograma?" tamano={32} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {OPCIONES.map(o => {
          const esElegida = estado.seleccion === o.valor
          const esLaCorrecta = estado.evaluado && o.valor === 'Líneas'
          let bg = '#fdf2f8', borde = '#f9a8d4', textColor = '#831843'
          if (estado.evaluado) {
            if (esElegida && estado.correcto) { bg = '#dcfce7'; borde = '#22c55e'; textColor = '#16a34a' }
            else if (esElegida && !estado.correcto) { bg = '#fee2e2'; borde = '#ef4444'; textColor = '#dc2626' }
            else if (esLaCorrecta) { bg = '#dcfce7'; borde = '#86efac'; textColor = '#16a34a' }
          }
          return (
            <button key={o.valor} onClick={() => onElegir(o.valor)} disabled={estado.evaluado} style={{
              padding: '0.6rem 1rem', borderRadius: 12, border: `2px solid ${borde}`,
              background: bg, color: textColor, fontWeight: 800, fontSize: '0.9rem',
              cursor: estado.evaluado ? 'default' : 'pointer',
            }}>
              {o.emoji} {o.valor}
            </button>
          )
        })}
      </div>

      {estado.evaluado && (
        <>
          <p style={{ marginTop: '0.6rem', fontSize: '0.95rem', textAlign: 'center', fontWeight: 800, color: estado.correcto ? '#16a34a' : '#dc2626' }}>
            {estado.correcto ? '✅ ¡Correcto!' : '❌ Era Líneas'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.4rem' }}>
            <BotonExplicar texto="El gráfico de líneas conecta los puntos en orden, así que es el que mejor muestra cómo cambia algo con el tiempo — como la profundidad del delfín." onEstadoCambia={onExplicarEstado} />
          </div>
        </>
      )}
    </div>
  )
}

// Ejemplo resuelto — no interactivo, con un gráfico y datos distintos a los
// 3 de la actividad para no revelar ninguna respuesta.
function TarjetaEjemplo() {
  const color = '#3b82f6'
  const categorias: CategoriaBarra[] = [
    { nombre: 'Anémonas', valor: 5, emoji: '🟠' },
    { nombre: 'Estrellas', valor: 9, emoji: '⭐' },
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 999, background: color, color: 'white', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
        }}>
          EJ
        </span>
        <span style={{ fontSize: '1.3rem' }}>🐚</span>
        <p style={{ fontWeight: 800, fontSize: '1.05rem', margin: 0, flex: 1, color: '#831843' }}>Animales del arrecife</p>
        <BotonEscuchar texto="Ejemplo: anémonas, 5. Estrellas, 9. ¿Cuál hay en mayor cantidad? Busco la barra más alta. Las estrellas tienen 9, la barra más alta — por eso hay más." tamano={32} />
      </div>

      <GraficoBarras categorias={categorias} ejeMax={10} color={color} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem',
        padding: '0.5rem', borderRadius: 10, border: '2px solid #22c55e', background: '#f0fdf4',
      }}>
        <span style={{ fontSize: '0.85rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#1e3a8a', flex: '1 1 auto' }}>
          ¿Cuál hay en mayor cantidad?
        </span>
        <span style={{
          padding: '0.3rem 0.6rem', borderRadius: 8, border: '2px solid #22c55e', background: 'white',
          color: '#16a34a', fontSize: '0.9rem', fontWeight: 800,
        }}>
          Estrellas
        </span>
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#16a34a' }}>✅</span>
      </div>
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

  const borde = estado.evaluado ? (estado.correcto ? '#22c55e' : '#ef4444') : '#f9a8d4'

  return (
    <div style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
      padding: '0.7rem', borderRadius: 14,
      border: `2px solid ${borde}`, background: '#fdf2f8',
      animation: estado.evaluado ? (estado.correcto ? 'gj-pop 0.4s ease' : 'gj-shake 0.4s ease') : undefined,
    }}>
      {estado.evaluado && estado.correcto && <Confetti />}
      <BotonEscuchar texto={p.lectura} />
      <span style={{ fontSize: '1.05rem', minWidth: 0, overflowWrap: 'break-word', fontWeight: 600, color: '#831843' }}>{p.numero}. {p.antes}</span>
      <input
        value={estado.valor}
        disabled={estado.evaluado}
        onChange={e => onCambiar(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 100, padding: '0.4rem 0.6rem', borderRadius: 10, border: '2px solid #f9a8d4',
          background: 'white', color: '#831843', fontSize: '1.1rem', fontWeight: 700, textAlign: 'center',
        }}
      />
      <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#831843' }}>{p.despues}</span>
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
