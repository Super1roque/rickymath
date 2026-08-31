import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Actividad 1 — Contar bloques',
  description: 'Contá bloques, animales y objetos hasta el 9, temática Minecraft.',
}

export default function PrimeroModulo01Layout({ children }: { children: React.ReactNode }) {
  return children
}
