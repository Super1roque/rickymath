import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grado Primero — Menú',
  description: 'Elegí una actividad de matemáticas de 1er grado, temática Minecraft.',
}

export default function PrimeroMenuLayout({ children }: { children: React.ReactNode }) {
  return children
}
