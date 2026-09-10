import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/contexts/AuthContext'
import { PerfilProvider } from '@/contexts/PerfilContext'
import RegisterServiceWorker from '@/components/RegisterServiceWorker'
import MetaPixel from '@/components/MetaPixel'
import './globals.css'

const DESCRIPCION = 'Matemáticas en el Mundo de los Bloques — guías interactivas de primero a quinto grado, tablas de multiplicar y problemas, temática Minecraft con Ricky.'

export const metadata: Metadata = {
  metadataBase: new URL('https://rickymath.com'),
  title: 'RickyMath',
  description: DESCRIPCION,
  openGraph: {
    title: 'RickyMath',
    description: DESCRIPCION,
    url: 'https://rickymath.com',
    siteName: 'RickyMath',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    locale: 'es_HN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RickyMath',
    description: DESCRIPCION,
    images: ['/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RickyMath',
  },
}

export const viewport: Viewport = {
  themeColor: '#22c55e',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          <PerfilProvider>{children}</PerfilProvider>
        </AuthProvider>
        <RegisterServiceWorker />
        <MetaPixel />
      </body>
    </html>
  )
}
