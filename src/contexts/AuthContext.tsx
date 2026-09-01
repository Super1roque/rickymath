'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { crearTenantSiNoExiste, getTenant, type Tenant } from '@/lib/tenants'

interface AuthContextType {
  user: User | null
  tenantData: Tenant | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, nombre: string, telefono: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  refreshTenant: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [tenantData, setTenantData] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Red de seguridad: si onAuthStateChanged nunca dispara (IndexedDB
    // bloqueado, sesión corrupta, etc.) no dejamos el spinner girando para
    // siempre — a los 8s asumimos que no hay sesión.
    const timeoutId = setTimeout(() => setLoading(false), 8000)
    const unsubscribe = onAuthStateChanged(auth, async u => {
      clearTimeout(timeoutId)
      setUser(u)
      if (u) {
        setTenantData(await getTenant(u.uid))
      } else {
        setTenantData(null)
      }
      setLoading(false)
    })
    return () => { clearTimeout(timeoutId); unsubscribe() }
  }, [])

  async function refreshTenant() {
    if (user) setTenantData(await getTenant(user.uid))
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signup(email: string, password: string, nombre: string, telefono: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await crearTenantSiNoExiste(cred.user.uid, { nombre, email, telefono })
    setTenantData(await getTenant(cred.user.uid))
  }

  async function loginWithGoogle() {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    await crearTenantSiNoExiste(cred.user.uid, {
      nombre: cred.user.displayName ?? '',
      email: cred.user.email ?? '',
      telefono: '',
    })
    setTenantData(await getTenant(cred.user.uid))
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, tenantData, loading, login, signup, loginWithGoogle, logout, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
