'use client'

import { useRouter } from 'next/navigation'
import { fuenteJuego } from '@/lib/fuenteJuego'
import { reproducirCorrecto } from '@/lib/guiaAudio'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'
import { useAuth } from '@/contexts/AuthContext'
import { esGradoGratis } from '@/lib/platform'

// Mensaje cálido y sin sonar a venta — el gancho de "gratis" baja la
// fricción de que la otra persona lo pruebe de una. La URL se agrega
// aparte (no acá adentro) porque navigator.share la maneja como campo
// propio; el fallback a WhatsApp sí la concatena al texto.
const MENSAJE_COMPARTIR = '¡Hola! 👋 Sé que tenés niños en edad escolar y pensé en vos — te comparto RickyMath, una app para que practiquen matemáticas jugando (temática de bloques). Primero y Tablas son gratis, ¡probala!'

async function compartirApp() {
  const url = window.location.origin
  if (navigator.share) {
    try {
      await navigator.share({ title: 'RickyMath', text: MENSAJE_COMPARTIR, url })
    } catch {
      // El usuario canceló el selector — no hace falta avisar nada.
    }
    return
  }
  // Sin Web Share API (la mayoría de navegadores de escritorio) — directo
  // a WhatsApp, el canal que de verdad usa esta audiencia.
  window.open(`https://wa.me/?text=${encodeURIComponent(`${MENSAJE_COMPARTIR} ${url}`)}`, '_blank')
}

function BotonCompartir() {
  return (
    <button
      onClick={compartirApp}
      className="gj-boton-3d"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.85rem 1.5rem', borderRadius: 999, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(180deg, #22c55e, #14532d)', color: 'white',
        fontFamily: 'inherit', fontWeight: 800, fontSize: '1rem',
        ['--gj-sombra' as string]: '#14532d', boxShadow: '0 5px 0 #14532d',
      }}
    >
      📤 Compartir RickyMath
    </button>
  )
}

// Hub de nivel superior — arriba de primero-menu/segundo-menu/tercero-menu.
// El botón de cada grado es un número gigante con relieve 3D (texto
// apilado en capas de sombra, no blur — el mismo truco "de bloque" que un
// ícono pixelado) y se balancea en loop con un delay escalonado por índice,
// para que el conjunto se vea como una ola en vez de todos rebotando juntos.
interface GradoInfo {
  numero: number
  slug: string
  nombre: string
  emoji: string
  color: string
  colorOscuro: string
  // Reemplaza el número gigante por un símbolo — solo lo usa la tarjeta
  // bonus, que no representa un grado numerado.
  simbolo?: string
}

const GRADOS: GradoInfo[] = [
  { numero: 1, slug: 'primero-menu', nombre: 'Primero', emoji: '🌱', color: '#22c55e', colorOscuro: '#14532d' },
  { numero: 2, slug: 'segundo-menu', nombre: 'Segundo', emoji: '🌊', color: '#0891b2', colorOscuro: '#0c4a6e' },
  { numero: 3, slug: 'tercero-menu', nombre: 'Tercero', emoji: '💎', color: '#7c3aed', colorOscuro: '#1e1b4b' },
  { numero: 4, slug: 'cuarto-menu', nombre: 'Cuarto', emoji: '🏆', color: '#b45309', colorOscuro: '#78350f' },
  { numero: 5, slug: 'quinto-menu', nombre: 'Quinto', emoji: '👑', color: '#ca8a04', colorOscuro: '#713f12' },
  { numero: 6, slug: 'tablas-menu', nombre: 'Bonus', emoji: '✖️', color: '#db2777', colorOscuro: '#831843', simbolo: '★' },
  { numero: 7, slug: 'problemas-menu', nombre: 'Problemas', emoji: '🧩', color: '#16a34a', colorOscuro: '#14532d', simbolo: '?' },
]

// Apila sombras de 1px en 1px (sin blur) para simular una extrusión 3D
// sólida detrás del número — un solo text-shadow con offset grande deja un
// hueco hollow, esto lo rellena como una escalerita.
function sombraTexto3D(color: string, profundidad: number) {
  return Array.from({ length: profundidad }, (_, i) => `${i + 1}px ${i + 1}px 0 ${color}`).join(', ')
}

// Textura de una cara — imagen fuente chica (8x8, generada a mano con
// ruido de píxel estilo Minecraft) repetida en mosaico y escalada sin
// suavizar (image-rendering: pixelated), igual que un pack de texturas real
// en vez de una foto de alta resolución estirada.
function fondoPixelado(url: string, escalaPx: number): React.CSSProperties {
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: `${escalaPx}px ${escalaPx}px`,
    backgroundRepeat: 'repeat',
    imageRendering: 'pixelated',
  }
}

// Una cara del cubo — si `pasto`, agrega la franja de pasto sobre la
// textura base (tierra), como el bloque de césped de Minecraft.
function CaraCubo({ transform, textura, escala, pasto, oscurecer }: {
  transform: string; textura: string; escala: number; pasto?: boolean; oscurecer?: boolean
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, transform, overflow: 'hidden', filter: oscurecer ? 'brightness(0.8)' : undefined }}>
      {pasto && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '16%', ...fondoPixelado('/textures/pasto_top.png', escala) }} />
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: pasto ? '16%' : 0, ...fondoPixelado(textura, escala) }} />
    </div>
  )
}

// Cubo 3D real (transform-style: preserve-3d + 3 caras), no un truco 2D con
// clip-path — así la iluminación de cada cara (arriba más clara, derecha
// más oscura) queda consistente en cualquier tamaño. `pasto` agrega una
// franja de pasto arriba de las caras laterales para el look de bloque de
// césped de Minecraft (pasto arriba, tierra abajo).
function Cubo3D({ tam, texturaTop, texturaFrente, texturaLado, pasto, rotY = 35, rotX = -18 }: {
  tam: number
  texturaTop: string
  texturaFrente: string
  texturaLado: string
  pasto?: boolean
  rotY?: number
  rotX?: number
}) {
  const mitad = tam / 2
  const escala = Math.max(6, Math.round(tam / 7))
  return (
    <div style={{
      width: tam, height: tam, position: 'relative',
      transformStyle: 'preserve-3d', transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
    }}>
      <CaraCubo transform={`translateZ(${mitad}px)`} textura={texturaFrente} escala={escala} pasto={pasto} />
      <CaraCubo transform={`rotateY(-90deg) translateZ(${mitad}px)`} textura={texturaLado} escala={escala} pasto={pasto} oscurecer />
      <div style={{ position: 'absolute', inset: 0, transform: `rotateX(90deg) translateZ(${mitad}px)`, ...fondoPixelado(texturaTop, escala) }} />
    </div>
  )
}

// Piedra flotante decorativa — mismo cubo, sin pasto, chica, con su propio
// flote y giro independiente (delay/duración distintos por instancia para
// que no se muevan todas en sincronía).
function PiedraFlotante({ tam, top, left, duracion, delay }: {
  tam: number; top: string; left: string; duracion: number; delay: number
}) {
  return (
    <div style={{
      position: 'absolute', top, left, perspective: 500,
      animation: `gj-piedra-flota ${duracion}s ease-in-out ${delay}s infinite`,
      opacity: 0.85, zIndex: 1,
    }}>
      <Cubo3D tam={tam} texturaTop="/textures/piedra.png" texturaFrente="/textures/piedra.png" texturaLado="/textures/piedra.png"
        rotY={25 + delay * 10} rotX={-15} />
    </div>
  )
}

export default function Grados() {
  const router = useRouter()
  const { tenantData } = useAuth()
  const esPremium = tenantData?.plan === 'premium'

  // Ya no bloquea la entrada al grado premium — se puede navegar y ver
  // los módulos y las preguntas (el candado real está en cada pregunta,
  // ver CandadoPremium), esto solo deja la marca "🔒" como aviso.
  function irAGrado(g: GradoInfo) {
    reproducirCorrecto()
    setTimeout(() => router.push(`/${g.slug}`), 220)
  }

  return (
    <div className={fuenteJuego.className} style={{
      position: 'relative', minHeight: '100vh', overflowX: 'hidden',
      background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 20%, #0c4a6e 45%, #15803d 78%, #14532d 100%)',
      color: 'white', paddingBottom: '3rem',
    }}>
      <EstilosJuego />
      <style>{`
        @keyframes gj-ola {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-14px); }
        }
        .gj-grado-boton {
          animation: gj-ola 2.2s ease-in-out infinite;
        }
        .gj-grado-boton:active {
          animation-play-state: paused;
          filter: brightness(0.92);
        }
        @keyframes gj-isla-flota {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes gj-isla-sombra {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.35; }
          50% { transform: translateX(-50%) scale(0.85); opacity: 0.22; }
        }
        @keyframes gj-piedra-flota {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(8deg); }
        }
        @keyframes gj-nube {
          0% { transform: translateX(0); }
          100% { transform: translateX(40px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gj-grado-boton, .gj-isla-flota, .gj-piedra-flota, .gj-nube { animation: none !important; }
        }
      `}</style>

      <Nube top="6%" left="8%" tam={0.8} duracion={7} />
      <Nube top="12%" left="70%" tam={1.1} duracion={9} />
      <Nube top="3%" left="45%" tam={0.65} duracion={6} />

      <div style={{ textAlign: 'center', padding: '2rem 1rem 0', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ position: 'relative', height: 'clamp(250px, 60vw, 320px)' }}>
          <PiedraFlotante tam={34} top="8%" left="14%" duracion={4.5} delay={0} />
          <PiedraFlotante tam={22} top="28%" left="78%" duracion={5.2} delay={0.6} />
          <PiedraFlotante tam={26} top="4%" left="82%" duracion={4} delay={1.1} />
          <PiedraFlotante tam={18} top="40%" left="10%" duracion={5.6} delay={1.6} />

          {/* Sombra de contacto — se achica/agranda en contrafase al flote de
              la isla, para reforzar la sensación de que está suspendida. */}
          <div style={{
            position: 'absolute', bottom: '10%', left: '50%', width: 130, height: 24,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.4), transparent 72%)',
            filter: 'blur(1px)', animation: 'gj-isla-sombra 3.6s ease-in-out infinite', zIndex: 1,
          }} />

          {/* Isla flotante: cubo de pasto (perspectiva 3D real) con Ricky
              parado encima — mismo mascot de siempre, ahora sobre un bloque
              en vez de flotar suelto en pantalla. Bloque achicado y bajado
              respecto a la primera versión para dejarle aire arriba a la
              cabeza/mano de Ricky. */}
          <div style={{
            position: 'absolute', bottom: '10%', left: '39%', transform: 'translateX(-50%)',
            animation: 'gj-isla-flota 3.6s ease-in-out infinite', zIndex: 2,
            perspective: 900,
          }}>
            <div style={{ position: 'relative' }}>
              <Ricky mood="waving" loop size={108} alt="Ricky, dando la bienvenida"
                style={{ position: 'absolute', bottom: '70%', left: '65%', transform: 'translateX(-50%)', zIndex: 2 }} />
              <Cubo3D tam={132} texturaTop="/textures/pasto_top.png" texturaFrente="/textures/tierra.png" texturaLado="/textures/tierra.png" pasto />
            </div>
          </div>
        </div>

        <h1 style={{
          fontSize: 'clamp(1.5rem, 6vw, 2.6rem)', fontWeight: 800, margin: 0,
          textShadow: '3px 3px 0 #0c4a6e',
        }}>
          ¿En qué grado estás?
        </h1>
        <p style={{ opacity: 0.85, marginTop: '0.5rem', fontSize: '1.05rem', fontWeight: 600 }}>
          Matemáticas en el Mundo de los Bloques — elegí tu grado para jugar
        </p>
      </div>

      <div style={{
        maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem 0',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem',
      }}>
        {GRADOS.map((g, i) => (
          <BotonGrado
            key={g.numero} g={g} indice={i}
            bloqueado={!esPremium && !esGradoGratis(g.slug.replace('-menu', ''))}
            onClick={() => irAGrado(g)}
          />
        ))}
      </div>

      <div style={{ textAlign: 'center', padding: '2rem 1rem 0' }}>
        <BotonCompartir />
      </div>
    </div>
  )
}

// Nube pixelada — un bloque base más un par de "orejas" hechas con
// box-shadow, sin bordes redondeados, para que combine con la estética de
// bloques del resto de la escena en vez de una nube con forma orgánica.
function Nube({ top, left, tam, duracion }: { top: string; left: string; tam: number; duracion: number }) {
  const base = 46 * tam
  return (
    <div style={{
      position: 'absolute', top, left, width: base, height: base * 0.4,
      background: 'rgba(255,255,255,0.9)',
      boxShadow: `
        ${base * 0.5}px ${-base * 0.35}px 0 0 rgba(255,255,255,0.9),
        ${base * 0.95}px 0 0 0 rgba(255,255,255,0.9),
        ${-base * 0.35}px ${-base * 0.15}px 0 0 rgba(255,255,255,0.75)
      `,
      animation: `gj-nube ${duracion}s ease-in-out infinite alternate`,
      zIndex: 0, pointerEvents: 'none',
    }} />
  )
}

function BotonGrado({ g, indice, bloqueado, onClick }: { g: GradoInfo; indice: number; bloqueado: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="gj-grado-boton"
      style={{
        position: 'relative',
        animationDelay: `${indice * 0.18}s`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
        padding: '1.5rem 1rem 1.2rem', borderRadius: 28, border: 'none', cursor: 'pointer',
        background: `linear-gradient(180deg, ${g.color}, ${g.colorOscuro})`,
        boxShadow: `0 8px 0 ${g.colorOscuro}, 0 8px 18px rgba(0,0,0,0.35)`,
        color: 'white', opacity: bloqueado ? 0.7 : 1,
      }}
    >
      {bloqueado && (
        <span style={{
          position: 'absolute', top: -10, right: -10, width: 40, height: 40, borderRadius: '50%',
          background: '#fbbf24', border: '3px solid white', boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', zIndex: 1,
        }}>
          🔒
        </span>
      )}
      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{g.emoji}</span>
      <span style={{
        fontSize: 'clamp(3.2rem, 12vw, 4.5rem)', fontWeight: 900, lineHeight: 1,
        color: 'white', WebkitTextStroke: `2px ${g.colorOscuro}`,
        textShadow: sombraTexto3D(g.colorOscuro, 7),
        margin: '0.2rem 0',
      }}>
        {g.simbolo ?? g.numero}
      </span>
      <span style={{
        fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
        textShadow: `2px 2px 0 ${g.colorOscuro}`,
      }}>
        {g.nombre}
      </span>
    </button>
  )
}
