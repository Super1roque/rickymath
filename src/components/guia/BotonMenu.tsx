'use client'

import Link from 'next/link'

// Enlace de vuelta al selector de actividades — se posiciona absoluto
// dentro del banner de cabecera de cada módulo (que ya usa position:
// relative para esto). Comparte estilo en todas las guías, de cualquier
// grado — el grado por defecto es tercero porque fue el primero en existir.
export default function BotonMenu({ href = '/tercero-menu' }: { href?: string }) {
  return (
    <Link href={href} style={{
      position: 'absolute', top: '0.9rem', left: '0.9rem',
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      background: 'rgba(0,0,0,0.25)', color: 'white', textDecoration: 'none',
      padding: '0.4rem 0.7rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700,
      zIndex: 2,
    }}>
      ← Menú
    </Link>
  )
}
