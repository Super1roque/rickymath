'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
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
  // true mientras signup()/loginWithGoogle() están creando el doc de
  // tenant con los datos reales (nombre del form, displayName de Google).
  // onAuthStateChanged se dispara casi al mismo tiempo que esas dos
  // funciones — sin esta bandera, su propia lógica de "crear si no
  // existe" (pensada para cuentas viejas sin doc) corría en paralelo con
  // datos vacíos y podía pisar el doc recién creado con el nombre/teléfono
  // correctos, según cuál de las dos terminara última.
  const creandoTenant = useRef(false)

  useEffect(() => {
    // Red de seguridad: si onAuthStateChanged nunca dispara (IndexedDB
    // bloqueado, sesión corrupta, etc.) no dejamos el spinner girando para
    // siempre — a los 8s asumimos que no hay sesión.
    const timeoutId = setTimeout(() => setLoading(false), 8000)
    const unsubscribe = onAuthStateChanged(auth, async u => {
      setUser(u)
      if (creandoTenant.current) {
        // signup()/loginWithGoogle() ya se están encargando de crear y
        // setear tenantData — no duplicar el trabajo acá.
        clearTimeout(timeoutId)
        setLoading(false)
        return
      }
      try {
        if (u) {
          let tenant = await getTenant(u.uid)
          if (!tenant) {
            // Cuentas creadas antes de que existiera este doc (o que por lo
            // que sea nunca lo tuvieron) — se autocompleta con lo que ya
            // sabe Firebase Auth, así no quedan invisibles para el panel de
            // superadmin para siempre.
            await crearTenantSiNoExiste(u.uid, {
              nombre: u.displayName ?? '', email: u.email ?? '', telefono: '',
            })
            tenant = await getTenant(u.uid)
          }
          setTenantData(tenant)
        } else {
          setTenantData(null)
        }
      } catch (e) {
        // Si falla la lectura/creación del tenant (red, permisos, lo que
        // sea) no dejamos al usuario colgado en el spinner para siempre —
        // entra igual, sin datos de tenant, antes que trabado sin poder
        // jugar.
        console.error('Error cargando datos de tenant:', e)
        setTenantData(null)
      } finally {
        clearTimeout(timeoutId)
        setLoading(false)
      }
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
    creandoTenant.current = true
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      await crearTenantSiNoExiste(cred.user.uid, { nombre, email, telefono })
      setTenantData(await getTenant(cred.user.uid))
    } finally {
      creandoTenant.current = false
    }
  }

  async function loginWithGoogle() {
    creandoTenant.current = true
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider())
      await crearTenantSiNoExiste(cred.user.uid, {
        nombre: cred.user.displayName ?? '',
        email: cred.user.email ?? '',
        telefono: '',
      })
      setTenantData(await getTenant(cred.user.uid))
    } finally {
      creandoTenant.current = false
    }
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
