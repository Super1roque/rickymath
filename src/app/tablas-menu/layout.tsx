import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tablas de Multiplicar — Menú',
  description: 'Elegí una tabla de multiplicar para practicar, temática Minecraft.',
}

export default function TablasMenuLayout({ children }: { children: React.ReactNode }) {
  return children
}
