import { Baloo_2 } from 'next/font/google'

// Tipografía redondeada/juguetona compartida por todas las guías
// interactivas — se define una sola vez acá y cada página importa la misma
// instancia, en vez de repetir la llamada a next/font en cada archivo.
export const fuenteJuego = Baloo_2({ weight: ['500', '600', '700', '800'], subsets: ['latin'], display: 'swap' })

// Paleta rotativa para las tarjetas de pregunta — cada guía usa los mismos
// colores (da identidad de "familia" a toda la serie), lo que cambia entre
// módulos es el color del banner de cabecera y el degradé de fondo.
export const COLORES_TARJETAS = [
  '#f97316', '#ec4899', '#8b5cf6', '#0ea5e9', '#22c55e', '#eab308', '#14b8a6', '#f43f5e', '#a855f7',
]
