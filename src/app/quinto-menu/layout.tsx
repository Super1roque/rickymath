import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grado Quinto — Menú',
  description: 'Elegí una actividad de matemáticas de 5to grado, temática Minecraft.',
}

export default function QuintoMenuLayout({ children }: { children: React.ReactNode }) {
  return children
}
