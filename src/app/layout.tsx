import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/contexts/AuthContext'
import './globals.css'

const DESCRIPCION = 'Matemáticas en el Mundo de los Bloques — guías interactivas de primero a quinto grado, tablas de multiplicar y problemas, temática Minecraft con Ricky.'

export const metadata: Metadata = {
  title: 'RickyMath',
  description: DESCRIPCION,
  openGraph: {
    title: 'RickyMath',
    description: DESCRIPCION,
    siteName: 'RickyMath',
    locale: 'es_HN',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#22c55e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
