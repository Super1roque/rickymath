import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grado Segundo — Menú',
  description: 'Elegí una actividad de matemáticas de 2do grado, temática Minecraft.',
}

export default function SegundoMenuLayout({ children }: { children: React.ReactNode }) {
  return children
}
