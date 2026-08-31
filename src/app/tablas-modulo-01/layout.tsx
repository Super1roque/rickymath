import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tabla del 1',
  description: 'Aprendé la tabla de multiplicar del 1 y practicá, temática Minecraft.',
}

export default function TablasModulo01Layout({ children }: { children: React.ReactNode }) {
  return children
}
