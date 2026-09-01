import {
  doc, setDoc, updateDoc, getDoc, onSnapshot, collection, query, orderBy, serverTimestamp, getCountFromServer, type Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export type EstadoTenant = 'active' | 'suspended'

export interface Tenant {
  uid: string
  nombre: string
  email: string
  telefono: string
  status: EstadoTenant
  creadoEn: Timestamp | null
}

// Se crea al registrarse (email/contraseña o Google) — "si no existe" para
// no pisar el doc si por lo que sea signup se dispara dos veces, o si un
// usuario de Google ya se había registrado antes con email/contraseña.
export async function crearTenantSiNoExiste(
  uid: string, datos: { nombre: string; email: string; telefono: string },
): Promise<void> {
  const ref = doc(db, 'usuarios', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  await setDoc(ref, {
    nombre: datos.nombre.trim(),
    email: datos.email,
    telefono: datos.telefono.trim(),
    status: 'active',
    creadoEn: serverTimestamp(),
  })
}

export async function getTenant(uid: string): Promise<Tenant | null> {
  const snap = await getDoc(doc(db, 'usuarios', uid))
  if (!snap.exists()) return null
  return { uid, ...(snap.data() as Omit<Tenant, 'uid'>) }
}

export function subscribeTenants(onChange: (tenants: Tenant[]) => void): () => void {
  const q = query(collection(db, 'usuarios'), orderBy('creadoEn', 'desc'))
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<Tenant, 'uid'>) })))
  })
}

export async function actualizarTenant(
  uid: string, datos: Partial<Pick<Tenant, 'nombre' | 'email' | 'telefono'>>,
): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), datos)
}

export async function cambiarStatusTenant(uid: string, status: EstadoTenant): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), { status })
}

export async function obtenerCantidadPerfiles(uid: string): Promise<number> {
  const snap = await getCountFromServer(collection(db, 'usuarios', uid, 'perfiles'))
  return snap.data().count
}

export async function esSuperAdmin(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'superadmins', uid))
  return snap.exists()
}
