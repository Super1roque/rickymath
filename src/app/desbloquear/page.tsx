'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { PRECIO_PREMIUM, DATOS_PAGO } from '@/lib/platform'
import { fuenteJuego } from '@/lib/fuenteJuego'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'

function waEncode(texto: string): string {
  return encodeURIComponent(texto)
}

export default function DesbloquearPage() {
  const { user, tenantData, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#22c55e',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      </div>
    )
  }

  if (tenantData?.plan === 'premium') {
    return (
      <div className={fuenteJuego.className} style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
        background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 20%, #0c4a6e 60%, #14532d 100%)',
        color: 'white', textAlign: 'center',
      }}>
        <div>
          <Ricky mood="celebrating" loop size={110} />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.5rem 0 1rem' }}>¡Ya tenés todo desbloqueado!</h1>
          <Link href="/grados" style={{
            display: 'inline-block', padding: '0.8rem 1.6rem', borderRadius: 999, fontWeight: 800,
            background: 'rgba(255,255,255,0.15)', color: 'white', textDecoration: 'none',
          }}>
            Ir a los grados
          </Link>
        </div>
      </div>
    )
  }

  const mensaje = tenantData?.nombre
    ? `Hola, soy ${tenantData.nombre} y ya transferí los L. ${PRECIO_PREMIUM} para desbloquear RickyMath (cuenta: ${tenantData.email}).`
    : `Hola, ya transferí los L. ${PRECIO_PREMIUM} para desbloquear RickyMath (cuenta: ${user.email}).`
  const waUrl = `https://wa.me/${DATOS_PAGO.whatsapp}?text=${waEncode(mensaje)}`

  return (
    <div className={fuenteJuego.className} style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 20%, #0c4a6e 60%, #14532d 100%)',
      color: 'white',
    }}>
      <EstilosJuego />
      <div style={{
        width: '100%', maxWidth: 420, background: 'rgba(15, 23, 42, 0.55)',
        borderRadius: 28, padding: '2rem 1.75rem', boxShadow: '0 12px 0 rgba(0,0,0,0.25), 0 20px 40px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)', textAlign: 'center',
      }}>
        <Ricky mood="encouraging" loop size={100} />
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0.5rem 0 0.25rem', textShadow: '2px 2px 0 #0c4a6e' }}>
          Desbloqueá todo RickyMath
        </h1>
        <p style={{ opacity: 0.85, fontSize: '0.92rem', fontWeight: 600, margin: '0 0 1.25rem' }}>
          Segundo, Tercero, Cuarto, Quinto y Problemas — con un solo pago, para siempre
        </p>

        <div style={{
          fontSize: '2.2rem', fontWeight: 900, margin: '0 0 0.25rem',
          textShadow: '2px 2px 0 #14532d',
        }}>
          L. {PRECIO_PREMIUM}
        </div>
        <p style={{ opacity: 0.7, fontSize: '0.8rem', fontWeight: 600, margin: '0 0 1.5rem' }}>
          Pago único — nada de suscripciones
        </p>

        <div style={{
          background: 'rgba(0,0,0,0.2)', borderRadius: 18, padding: '1.1rem', textAlign: 'left',
          marginBottom: '1.25rem', fontSize: '0.88rem', lineHeight: 1.7,
        }}>
          <p style={{ margin: 0, opacity: 0.7, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Transferí a
          </p>
          <p style={{ margin: 0 }}><strong>{DATOS_PAGO.banco}</strong></p>
          <p style={{ margin: 0 }}>Cuenta: <strong>{DATOS_PAGO.cuenta}</strong></p>
          <p style={{ margin: 0 }}>Titular: <strong>{DATOS_PAGO.titular}</strong></p>
        </div>

        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="gj-boton-3d"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            padding: '0.9rem 1rem', borderRadius: 16, border: 'none', cursor: 'pointer', textDecoration: 'none',
            fontFamily: 'inherit', fontSize: '1rem', fontWeight: 800, color: 'white', width: '100%',
            background: 'linear-gradient(180deg, #22c55e, #14532d)',
            ['--gj-sombra' as string]: '#14532d', boxShadow: '0 6px 0 #14532d',
            boxSizing: 'border-box',
          }}
        >
          ✅ Ya transferí, avisar por WhatsApp
        </a>

        <Link href="/grados" style={{
          display: 'inline-block', marginTop: '1.25rem', fontSize: '0.85rem', fontWeight: 700,
          color: 'rgba(255,255,255,0.7)', textDecoration: 'underline',
        }}>
          Volver (Primero y Tablas siguen gratis)
        </Link>
      </div>
    </div>
  )
}
