import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Actividad 9 — Contar y marcar',
  description: 'Contá los bloques de cada fila y coloreá una casilla por cada uno, temática Minecraft.',
}

export default function PrimeroModulo09Layout({ children }: { children: React.ReactNode }) {
  return children
}
