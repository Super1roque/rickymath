import {
  doc, setDoc, updateDoc, getDoc, onSnapshot, collection, query, orderBy, serverTimestamp, getCountFromServer, type Timestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'

export type EstadoTenant = 'active' | 'suspended'
export type EstadoPlan = 'free' | 'premium'

export interface Tenant {
  uid: string
  nombre: string
  email: string
  telefono: string
  status: EstadoTenant
  plan: EstadoPlan
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
    plan: 'free',
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

// Lo activa el superadmin a mano una vez que confirma la transferencia
// por WhatsApp — mismo criterio que registrarPagoPlataforma en pos-saas,
// pago único acá en vez de suscripción mensual.
export async function cambiarPlanTenant(uid: string, plan: EstadoPlan): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), { plan })
}

export async function obtenerCantidadPerfiles(uid: string): Promise<number> {
  const snap = await getCountFromServer(collection(db, 'usuarios', uid, 'perfiles'))
  return snap.data().count
}

export async function esSuperAdmin(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'superadmins', uid))
  return snap.exists()
}

// Crea usuarios/{uid} para cuentas de Auth que nunca lo tuvieron (se
// registraron antes de que existiera el doc) — vía Cloud Function porque
// hace falta el Admin SDK para listar TODOS los usuarios de Auth, algo
// que el cliente no puede hacer. Solo la puede llamar un superadmin (la
// función lo revisa de nuevo del lado del servidor).
export async function backfillTenants(): Promise<number> {
  const llamar = httpsCallable<void, { creados: number }>(functions, 'backfillTenants')
  const res = await llamar()
  return res.data.creados
}
