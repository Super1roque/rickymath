import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grado Tercero — Menú',
  description: 'Elegí una actividad de matemáticas de 3er grado, temática Minecraft.',
}

export default function TerceroMenuLayout({ children }: { children: React.ReactNode }) {
  return children
}
