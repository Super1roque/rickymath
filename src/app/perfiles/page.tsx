'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { usePerfil } from '@/contexts/PerfilContext'
import { crearPerfil, actualizarPerfil, eliminarPerfil, CARITAS_DISPONIBLES, type Perfil } from '@/lib/perfiles'
import { fuenteJuego } from '@/lib/fuenteJuego'
import EstilosJuego from '@/components/guia/EstilosJuego'
import Ricky from '@/components/guia/Ricky'

export default function PerfilesPage() {
  const { user, loading: authLoading } = useAuth()
  const { perfiles, cargando, seleccionarPerfil } = usePerfil()
  const router = useRouter()
  const [editando, setEditando] = useState<Perfil | 'nuevo' | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  function elegir(perfil: Perfil) {
    seleccionarPerfil(perfil)
    router.replace('/grados')
  }

  if (authLoading || !user || cargando) {
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
    <div className={fuenteJuego.className} style={{
      minHeight: '100vh', padding: '2.5rem 1.5rem', textAlign: 'center', color: 'white',
      background: 'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 20%, #0c4a6e 60%, #14532d 100%)',
    }}>
      <EstilosJuego />
      <Ricky mood={perfiles.length === 0 ? 'encouraging' : 'waiting'} loop size={100} />
      <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0.75rem 0 0.25rem', textShadow: '2px 2px 0 #0c4a6e' }}>
        {perfiles.length === 0 ? '¡Creá el primer perfil!' : '¿Quién va a jugar?'}
      </h1>
      <p style={{ opacity: 0.85, fontSize: '0.95rem', fontWeight: 600, margin: '0 0 2rem' }}>
        {perfiles.length === 0 ? 'Elegí un nombre y una carita' : 'Elegí tu perfil para empezar'}
      </p>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '1.25rem', justifyContent: 'center',
        maxWidth: 640, margin: '0 auto',
      }}>
        {perfiles.map(p => (
          <TarjetaPerfil key={p.id} perfil={p} onElegir={() => elegir(p)} onEditar={() => setEditando(p)} />
        ))}

        <button
          onClick={() => setEditando('nuevo')}
          className="gj-boton-3d"
          style={{
            width: 128, height: 152, borderRadius: 24, border: '3px dashed rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          }}
        >
          <span style={{ fontSize: '2rem' }}>+</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Agregar perfil</span>
        </button>
      </div>

      {editando && (
        <ModalPerfil
          uid={user.uid}
          perfil={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

function TarjetaPerfil({ perfil, onElegir, onEditar }: { perfil: Perfil; onElegir: () => void; onEditar: () => void }) {
  return (
    <div style={{ position: 'relative', width: 128 }}>
      <button
        onClick={onElegir}
        className="gj-boton-3d"
        style={{
          width: 128, height: 128, borderRadius: 24, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(180deg, #7c3aed, #1e1b4b)', boxShadow: '0 6px 0 #1e1b4b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.2rem',
        }}
      >
        {perfil.cara}
      </button>
      <p style={{ marginTop: '0.5rem', fontWeight: 800, fontSize: '0.95rem', textShadow: '1px 1px 0 #0c4a6e' }}>
        {perfil.nombre}
      </p>
      <button
        onClick={onEditar}
        aria-label={`Editar perfil de ${perfil.nombre}`}
        style={{
          position: 'absolute', top: -6, right: -6, width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(15,23,42,0.75)', border: '2px solid white', color: 'white', cursor: 'pointer',
          fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✏️
      </button>
    </div>
  )
}

function ModalPerfil({ uid, perfil, onCerrar }: { uid: string; perfil: Perfil | null; onCerrar: () => void }) {
  const [nombre, setNombre] = useState(perfil?.nombre ?? '')
  const [cara, setCara] = useState(perfil?.cara ?? CARITAS_DISPONIBLES[0])
  const [guardando, setGuardando] = useState(false)
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false)

  async function guardar() {
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      if (perfil) {
        await actualizarPerfil(uid, perfil.id, nombre, cara)
      } else {
        await crearPerfil(uid, nombre, cara)
      }
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  async function borrar() {
    if (!perfil) return
    setGuardando(true)
    try {
      await eliminarPerfil(uid, perfil.id)
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
    }} onClick={onCerrar}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: '#0f172a', borderRadius: 24, padding: '1.75rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)', textAlign: 'center', color: 'white',
        }}
      >
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 1rem' }}>
          {perfil ? 'Editar perfil' : 'Nuevo perfil'}
        </h2>

        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>{cara}</div>

        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Nombre"
          maxLength={20}
          style={{
            width: '100%', padding: '0.7rem 1rem', borderRadius: 14, border: 'none',
            fontSize: '1rem', fontFamily: 'inherit', fontWeight: 600,
            background: 'rgba(255,255,255,0.92)', color: '#0f172a', outline: 'none',
            marginBottom: '1rem', boxSizing: 'border-box',
          }}
        />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.25rem',
        }}>
          {CARITAS_DISPONIBLES.map(c => (
            <button
              key={c}
              onClick={() => setCara(c)}
              style={{
                fontSize: '1.5rem', padding: '0.5rem', borderRadius: 12, cursor: 'pointer',
                border: c === cara ? '2px solid #22c55e' : '2px solid transparent',
                background: c === cara ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.08)',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        <button
          onClick={guardar}
          disabled={guardando || !nombre.trim()}
          className="gj-boton-3d"
          style={{
            width: '100%', padding: '0.8rem', borderRadius: 14, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 800, color: 'white',
            background: 'linear-gradient(180deg, #22c55e, #14532d)', boxShadow: '0 4px 0 #14532d',
            opacity: guardando || !nombre.trim() ? 0.6 : 1, marginBottom: '0.6rem',
          }}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>

        {perfil && !confirmandoBorrar && (
          <button
            onClick={() => setConfirmandoBorrar(true)}
            style={{
              width: '100%', padding: '0.6rem', borderRadius: 14, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5',
              background: 'transparent', marginBottom: '0.6rem',
            }}
          >
            Eliminar perfil
          </button>
        )}
        {perfil && confirmandoBorrar && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <button onClick={borrar} disabled={guardando} style={{
              flex: 1, padding: '0.6rem', borderRadius: 14, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 800, color: 'white', background: '#dc2626',
            }}>
              Sí, eliminar
            </button>
            <button onClick={() => setConfirmandoBorrar(false)} style={{
              flex: 1, padding: '0.6rem', borderRadius: 14, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, color: 'white',
              background: 'rgba(255,255,255,0.12)',
            }}>
              Cancelar
            </button>
          </div>
        )}

        <button onClick={onCerrar} style={{
          width: '100%', padding: '0.5rem', borderRadius: 14, border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.7)',
          background: 'transparent',
        }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
