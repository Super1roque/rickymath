'use client'

import Link from 'next/link'
import { PRECIO_PREMIUM } from '@/lib/platform'

// Overlay de pago — se ve el módulo completo detrás (semi-transparente,
// no oculto), así el padre puede ver qué tipo de ejercicio es antes de
// pagar, pero no puede tocar ni escribir nada debajo (position: fixed +
// pointer-events por defecto en 'auto' tapa todo clic/tecla).
export default function CandadoPremium() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 70,
      background: 'rgba(15, 23, 42, 0.35)', backdropFilter: 'blur(0.5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: '2rem 1.75rem', maxWidth: 340, width: '100%',
        textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.4rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem' }}>
          Módulo Premium
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600, margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          Desbloqueá este y todos los módulos con un pago único de L. {PRECIO_PREMIUM}
        </p>
        <Link href="/desbloquear" style={{
          display: 'block', padding: '0.85rem 1rem', borderRadius: 14, fontWeight: 800, fontSize: '0.95rem',
          background: 'linear-gradient(180deg, #22c55e, #14532d)', color: 'white', textDecoration: 'none',
          boxShadow: '0 4px 0 #14532d', marginBottom: '0.85rem',
        }}>
          Desbloquear ahora
        </Link>
        <Link href="/grados" style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, textDecoration: 'underline' }}>
          ← Volver a los grados
        </Link>
      </div>
    </div>
  )
}
