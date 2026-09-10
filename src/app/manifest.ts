import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RickyMath',
    short_name: 'RickyMath',
    description: 'Matemáticas en el Mundo de los Bloques — guías interactivas de primero a quinto grado, tablas de multiplicar y problemas.',
    start_url: '/',
    display: 'standalone',
    background_color: '#14532d',
    theme_color: '#22c55e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
