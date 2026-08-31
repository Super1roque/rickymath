// Manifiesto estático de todas las guías — usado por el panel de progreso
// del padre para saber qué módulos existen y poder mostrar "sin empezar"
// en los que el hijo todavía no jugó, sin depender de que haya datos en
// Firestore para saber que el módulo existe.
export interface GradoManifiesto {
  slug: string
  nombre: string
  emoji: string
  color: string
  totalModulos: number
}

export const GRADOS_MANIFIESTO: GradoManifiesto[] = [
  { slug: 'primero', nombre: 'Primero', emoji: '🌱', color: '#22c55e', totalModulos: 10 },
  { slug: 'segundo', nombre: 'Segundo', emoji: '🌊', color: '#0891b2', totalModulos: 10 },
  { slug: 'tercero', nombre: 'Tercero', emoji: '💎', color: '#7c3aed', totalModulos: 10 },
  { slug: 'cuarto', nombre: 'Cuarto', emoji: '🏆', color: '#b45309', totalModulos: 10 },
  { slug: 'quinto', nombre: 'Quinto', emoji: '👑', color: '#ca8a04', totalModulos: 10 },
  { slug: 'tablas', nombre: 'Tablas de multiplicar', emoji: '✖️', color: '#db2777', totalModulos: 10 },
  { slug: 'problemas', nombre: 'Problemas', emoji: '🧩', color: '#16a34a', totalModulos: 10 },
]

export function moduloId(gradoSlug: string, numero: number): string {
  return `${gradoSlug}-modulo-${String(numero).padStart(2, '0')}`
}
