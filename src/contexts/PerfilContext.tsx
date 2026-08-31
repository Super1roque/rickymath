'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { suscribirsePerfiles, type Perfil } from '@/lib/perfiles'

interface PerfilContextType {
  perfiles: Perfil[]
  perfilActivo: Perfil | null
  cargando: boolean
  seleccionarPerfil: (perfil: Perfil) => void
  cambiarPerfil: () => void
}

const PerfilContext = createContext<PerfilContextType>({} as PerfilContextType)

function claveSesion(uid: string) {
  return `rickymath_perfil_activo_${uid}`
}

export function PerfilProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [perfilActivoId, setPerfilActivoId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  // Se resuscribe cada vez que cambia el usuario (login/logout/switch de
  // cuenta) — sin usuario, no hay perfiles que mostrar.
  useEffect(() => {
    if (!user) {
      setPerfiles([])
      setPerfilActivoId(null)
      setCargando(false)
      return
    }
    setCargando(true)
    const unsubscribe = suscribirsePerfiles(user.uid, lista => {
      setPerfiles(lista)
      setCargando(false)
    })
    return unsubscribe
  }, [user])

  // El perfil activo se guarda en sessionStorage (no localStorage a
  // propósito): sobrevive a un refresh de página dentro de la misma
  // pestaña, pero al cerrar el navegador y volver, se vuelve a preguntar
  // "con qué perfil vas a trabajar" — como el selector de perfiles de
  // Netflix, no queda pegado para siempre.
  useEffect(() => {
    if (!user || typeof window === 'undefined') return
    const guardado = sessionStorage.getItem(claveSesion(user.uid))
    if (guardado) setPerfilActivoId(guardado)
  }, [user])

  function seleccionarPerfil(perfil: Perfil) {
    setPerfilActivoId(perfil.id)
    if (user && typeof window !== 'undefined') {
      sessionStorage.setItem(claveSesion(user.uid), perfil.id)
    }
  }

  function cambiarPerfil() {
    setPerfilActivoId(null)
    if (user && typeof window !== 'undefined') {
      sessionStorage.removeItem(claveSesion(user.uid))
    }
  }

  const perfilActivo = perfiles.find(p => p.id === perfilActivoId) ?? null

  return (
    <PerfilContext.Provider value={{ perfiles, perfilActivo, cargando, seleccionarPerfil, cambiarPerfil }}>
      {children}
    </PerfilContext.Provider>
  )
}

export function usePerfil() {
  return useContext(PerfilContext)
}
