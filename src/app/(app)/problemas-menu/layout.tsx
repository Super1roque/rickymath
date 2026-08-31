import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Problemas — Menú',
  description: 'Elegí una misión de problemas matemáticos para resolver, temática Minecraft.',
}

export default function ProblemasMenuLayout({ children }: { children: React.ReactNode }) {
  return children
}
