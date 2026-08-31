'use client'

import type { CSSProperties } from 'react'

// Mascota "Ricky" — sistema de avatares con 10 moods, recreado a partir del
// handoff de diseño (design_handoff_ricky_avatar/README.md). Los PNG viven
// en public/ricky/*.png (assets de producción, se copiaron tal cual).

export type RickyMood =
  | 'idle' | 'happy' | 'thinking' | 'celebrating' | 'confused'
  | 'oops' | 'waiting' | 'sleepy' | 'waving' | 'encouraging' | 'sixseven'

export type RickyMotion = 'breathe' | 'bounce' | 'wave' | 'pop' | 'shake' | 'drift'

// El archivo se llama "sleeping.png" pero el mood se expone como "sleepy"
// (mismatch documentado a propósito en el handoff).
const ARCHIVO: Record<RickyMood, string> = {
  idle: 'idle', happy: 'happy', thinking: 'thinking', celebrating: 'celebrating',
  confused: 'confused', oops: 'oops', waiting: 'waiting', sleepy: 'sleeping',
  waving: 'waving', encouraging: 'encouraging', sixseven: 'sixseven',
}

const ALT_POR_MOOD: Record<RickyMood, string> = {
  idle: 'Ricky, tranquilo', happy: 'Ricky, sonriendo', thinking: 'Ricky, pensando',
  celebrating: 'Ricky, festejando', confused: 'Ricky, confundido', oops: 'Ricky, con un problema',
  waiting: 'Ricky, esperando', sleepy: 'Ricky, dormido', waving: 'Ricky, saludando',
  encouraging: 'Ricky, dando ánimo', sixseven: 'Ricky, haciendo six seven',
}

// Motion por defecto de cada mood (tabla del handoff). null = se queda
// quieto — "oops" nunca se anima, un error no es motivo de gracia.
const MOTION_POR_DEFECTO: Record<RickyMood, RickyMotion | null> = {
  idle: 'breathe', happy: 'bounce', thinking: 'breathe', celebrating: 'bounce',
  confused: 'shake', oops: null, waiting: 'drift', sleepy: 'breathe',
  waving: 'wave', encouraging: 'pop', sixseven: 'drift',
}

const DURACION: Record<RickyMotion, string> = {
  breathe: '3.6s', bounce: '1.1s', wave: '2.4s', pop: '320ms', shake: '500ms', drift: '2.2s',
}
const EASING: Record<RickyMotion, string> = {
  breathe: 'ease-in-out', bounce: 'cubic-bezier(.34,1.56,.64,1)', wave: 'ease-in-out',
  pop: 'cubic-bezier(.34,1.56,.64,1)', shake: 'ease-out', drift: 'ease-in-out',
}
// Loop por defecto — Breathe y Drift se repiten mientras el estado persiste;
// Pop, Bounce y Shake se reproducen una sola vez (overridable con la prop `loop`,
// p. ej. para el Bounce en loop de un modal de celebración).
const LOOP_POR_DEFECTO: Record<RickyMotion, boolean> = {
  breathe: true, bounce: false, wave: false, pop: false, shake: false, drift: true,
}
const ORIGEN: Record<RickyMotion, string> = {
  breathe: '50% 100%', bounce: '50% 100%', wave: '50% 90%', pop: '50% 100%',
  shake: '50% 50%', drift: '50% 50%',
}
const KEYFRAME: Record<RickyMotion, string> = {
  breathe: 'r-breathe', bounce: 'r-bounce', wave: 'r-wave', pop: 'r-pop', shake: 'r-shake', drift: 'r-drift',
}

export default function Ricky({
  mood, motion, size = 120, crop, loop, alt, className, style,
}: {
  mood: RickyMood
  /** Si se omite, usa el motion por defecto de la tabla de diseño. Pasar `null` lo deja quieto. */
  motion?: RickyMotion | null
  /** Alto en px para cuerpo completo, o lado del círculo en el recorte de cabeza. */
  size?: number
  /** Por defecto: "head" debajo de 64px (la ropa/zapatillas dejan de leerse), "full" en adelante. */
  crop?: 'full' | 'head'
  /** `true` = loop infinito, `false` = una vez, o un número de repeticiones (p. ej. 2 para el Shake de una respuesta incorrecta). */
  loop?: boolean | number
  alt?: string
  className?: string
  style?: CSSProperties
}) {
  const motivo = motion !== undefined ? motion : MOTION_POR_DEFECTO[mood]
  const repite = loop !== undefined ? loop : (motivo ? LOOP_POR_DEFECTO[motivo] : false)
  const iteraciones = repite === true ? 'infinite' : repite === false ? '1' : String(repite)
  const recorte = crop ?? (size < 64 ? 'head' : 'full')
  const textoAlt = alt ?? ALT_POR_MOOD[mood]

  const imagen = (
    <img
      src={`/ricky/${ARCHIVO[mood]}.png`}
      alt={recorte === 'full' ? textoAlt : ''}
      className="ricky-anim"
      style={{
        display: 'block',
        width: recorte === 'head' ? '210%' : '100%',
        height: recorte === 'head' ? undefined : '100%',
        maxWidth: recorte === 'head' ? 'none' : '100%',
        objectFit: 'contain',
        position: recorte === 'head' ? 'absolute' : undefined,
        left: recorte === 'head' ? '-55%' : undefined,
        top: recorte === 'head' ? '-6%' : undefined,
        animation: motivo ? `${KEYFRAME[motivo]} ${DURACION[motivo]} ${EASING[motivo]} ${iteraciones}` : undefined,
        transformOrigin: motivo ? ORIGEN[motivo] : undefined,
      }}
    />
  )

  return (
    <div
      className={className}
      role="img"
      aria-label={recorte === 'head' ? textoAlt : undefined}
      aria-live="polite"
      style={{
        display: 'inline-block', width: size, height: size, position: 'relative',
        borderRadius: recorte === 'head' ? '50%' : undefined,
        overflow: recorte === 'head' ? 'hidden' : undefined,
        ...style,
      }}
    >
      {imagen}
    </div>
  )
}
