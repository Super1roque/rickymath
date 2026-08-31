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

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Red de seguridad: si onAuthStateChanged nunca dispara (IndexedDB
    // bloqueado, sesión corrupta, etc.) no dejamos el spinner girando para
    // siempre — a los 8s asumimos que no hay sesión.
    const timeoutId = setTimeout(() => setLoading(false), 8000)
    const unsubscribe = onAuthStateChanged(auth, u => {
      clearTimeout(timeoutId)
      setUser(u)
      setLoading(false)
    })
    return () => { clearTimeout(timeoutId); unsubscribe() }
  }, [])

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signup(email: string, password: string) {
    await createUserWithEmailAndPassword(auth, email, password)
  }

  async function loginWithGoogle() {
    await signInWithPopup(auth, new GoogleAuthProvider())
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
