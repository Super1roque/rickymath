import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Elegí tu grado',
  description: 'Matemáticas en el Mundo de los Bloques — elegí tu grado para practicar, temática Minecraft.',
}

export default function GradosLayout({ children }: { children: React.ReactNode }) {
  return children
}
