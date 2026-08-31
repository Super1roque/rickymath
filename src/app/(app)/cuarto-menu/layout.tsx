import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grado Cuarto — Menú',
  description: 'Elegí una actividad de matemáticas de 4to grado, temática Minecraft.',
}

export default function CuartoMenuLayout({ children }: { children: React.ReactNode }) {
  return children
}
