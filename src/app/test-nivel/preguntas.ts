export interface Pregunta {
  texto: string
  opciones: string[]
  correcta: number
  habilidad: string
}

export interface GradoInfo {
  numero: number
  nombre: string
  emoji: string
  color: string
  colorOscuro: string
}

export const GRADOS: GradoInfo[] = [
  { numero: 1, nombre: 'Primero', emoji: '🌱', color: '#22c55e', colorOscuro: '#14532d' },
  { numero: 2, nombre: 'Segundo', emoji: '🌊', color: '#0891b2', colorOscuro: '#0c4a6e' },
  { numero: 3, nombre: 'Tercero', emoji: '💎', color: '#7c3aed', colorOscuro: '#1e1b4b' },
  { numero: 4, nombre: 'Cuarto', emoji: '🏆', color: '#b45309', colorOscuro: '#78350f' },
  { numero: 5, nombre: 'Quinto', emoji: '👑', color: '#ca8a04', colorOscuro: '#713f12' },
]

// 6 preguntas por grado, mezclando fundamentos del grado anterior (para
// detectar huecos de años previos) con lo propio del grado actual —
// curriculum aproximado de primaria en Honduras. Cada una etiquetada con
// su habilidad, para poder señalar puntualmente qué reforzar al final.
export const PREGUNTAS_POR_GRADO: Record<number, Pregunta[]> = {
  1: [
    { texto: '5 + 3 = ?', opciones: ['7', '8', '9', '6'], correcta: 1, habilidad: 'Sumas' },
    { texto: '9 − 4 = ?', opciones: ['4', '5', '6', '3'], correcta: 1, habilidad: 'Restas' },
    { texto: '¿Cuál número es más grande?', opciones: ['8', '12', '5', '10'], correcta: 1, habilidad: 'Números' },
    { texto: '7 + 6 = ?', opciones: ['12', '13', '14', '11'], correcta: 1, habilidad: 'Sumas' },
    { texto: 'Tenés 10 lápices y regalás 3. ¿Cuántos te quedan?', opciones: ['6', '7', '8', '5'], correcta: 1, habilidad: 'Restas' },
    { texto: '15 − 7 = ?', opciones: ['7', '8', '9', '6'], correcta: 1, habilidad: 'Restas' },
  ],
  2: [
    { texto: '24 + 18 = ?', opciones: ['40', '41', '42', '43'], correcta: 2, habilidad: 'Sumas' },
    { texto: '45 − 27 = ?', opciones: ['16', '17', '18', '19'], correcta: 2, habilidad: 'Restas' },
    { texto: '2 × 4 = ?', opciones: ['6', '8', '10', '12'], correcta: 1, habilidad: 'Multiplicación' },
    { texto: '5 × 3 = ?', opciones: ['10', '15', '20', '8'], correcta: 1, habilidad: 'Multiplicación' },
    { texto: '100 − 45 = ?', opciones: ['55', '45', '65', '50'], correcta: 0, habilidad: 'Restas' },
    { texto: 'Cada caja tiene 10 galletas. Hay 4 cajas. ¿Cuántas galletas hay en total?', opciones: ['14', '40', '44', '400'], correcta: 1, habilidad: 'Problemas' },
  ],
  3: [
    { texto: '7 × 8 = ?', opciones: ['54', '56', '58', '64'], correcta: 1, habilidad: 'Multiplicación' },
    { texto: '45 ÷ 9 = ?', opciones: ['4', '5', '6', '9'], correcta: 1, habilidad: 'División' },
    { texto: '236 + 148 = ?', opciones: ['374', '384', '394', '364'], correcta: 1, habilidad: 'Sumas' },
    { texto: '9 × 6 = ?', opciones: ['45', '52', '54', '56'], correcta: 2, habilidad: 'Multiplicación' },
    { texto: '63 ÷ 7 = ?', opciones: ['7', '8', '9', '6'], correcta: 2, habilidad: 'División' },
    { texto: '500 − 275 = ?', opciones: ['215', '225', '235', '245'], correcta: 1, habilidad: 'Restas' },
  ],
  4: [
    { texto: '23 × 4 = ?', opciones: ['82', '92', '88', '86'], correcta: 1, habilidad: 'Multiplicación' },
    { texto: '57 ÷ 6 = 9 y sobran…', opciones: ['1', '2', '3', '4'], correcta: 2, habilidad: 'División' },
    { texto: '¿Cuál fracción es más grande?', opciones: ['1/2', '1/3', '1/4', '1/5'], correcta: 0, habilidad: 'Fracciones' },
    { texto: '125 × 3 = ?', opciones: ['355', '365', '375', '385'], correcta: 2, habilidad: 'Multiplicación' },
    { texto: '3/4 + 1/4 = ?', opciones: ['1/2', '1', '4/8', '2'], correcta: 1, habilidad: 'Fracciones' },
    { texto: 'Repartís 50 caramelos entre 6 niños en partes iguales. ¿Cuántos le tocan a cada uno?', opciones: ['7', '8', '9', '6'], correcta: 1, habilidad: 'Problemas' },
  ],
  5: [
    { texto: '3.5 + 2.75 = ?', opciones: ['6', '6.25', '6.5', '5.75'], correcta: 1, habilidad: 'Decimales' },
    { texto: '¿Cuánto es el 50% de 80?', opciones: ['30', '35', '40', '45'], correcta: 2, habilidad: 'Porcentajes' },
    { texto: '2/3 × 3 = ?', opciones: ['1', '2', '3', '6'], correcta: 1, habilidad: 'Fracciones' },
    { texto: '1250 ÷ 25 = ?', opciones: ['40', '45', '50', '55'], correcta: 2, habilidad: 'División' },
    { texto: '0.75 − 0.4 = ?', opciones: ['0.25', '0.35', '0.45', '0.5'], correcta: 1, habilidad: 'Decimales' },
    { texto: 'Un artículo cuesta L. 200 y tiene 25% de descuento. ¿Cuánto pagás?', opciones: ['150', '160', '170', '175'], correcta: 0, habilidad: 'Porcentajes' },
  ],
}
