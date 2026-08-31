import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tabla del 2',
  description: 'Aprendé la tabla de multiplicar del 2 y practicá, temática Minecraft.',
}

export default function TablasModulo02Layout({ children }: { children: React.ReactNode }) {
  return children
}
