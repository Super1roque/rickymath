'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user) {
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

  return (
    <>
      {children}
      <button
        onClick={() => logout().then(() => router.replace('/login'))}
        style={{
          position: 'fixed', top: 12, right: 12, zIndex: 50,
          background: 'rgba(15, 23, 42, 0.55)', color: 'white', border: 'none',
          borderRadius: 999, padding: '0.5rem 0.9rem', fontSize: '0.8rem', fontWeight: 700,
          cursor: 'pointer', backdropFilter: 'blur(4px)',
        }}
      >
        Cerrar sesión
      </button>
    </>
  )
}
