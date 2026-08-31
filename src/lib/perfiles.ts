import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface Perfil {
  id: string
  nombre: string
  cara: string
}

// Caritas a elección — set curado de emoji, sin necesidad de subir assets
// nuevos. Cada perfil de hijo/a elige una para identificarse en el
// selector y en el resto de la app.
export const CARITAS_DISPONIBLES = [
  '🦸', '🦸‍♀️', '🧙', '🐱', '🐶', '🦁', '🐯', '🦄',
  '🐉', '🚀', '⭐', '🎮', '🦖', '🐼', '🦊', '🐸',
]

function perfilesRef(uid: string) {
  return collection(db, 'usuarios', uid, 'perfiles')
}

export function suscribirsePerfiles(uid: string, onChange: (perfiles: Perfil[]) => void): () => void {
  const q = query(perfilesRef(uid), orderBy('creadoEn', 'asc'))
  return onSnapshot(q, snap => {
    onChange(snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre, cara: d.data().cara })))
  })
}

export async function crearPerfil(uid: string, nombre: string, cara: string): Promise<void> {
  await addDoc(perfilesRef(uid), { nombre: nombre.trim(), cara, creadoEn: serverTimestamp() })
}

export async function actualizarPerfil(uid: string, perfilId: string, nombre: string, cara: string): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid, 'perfiles', perfilId), { nombre: nombre.trim(), cara })
}

export async function eliminarPerfil(uid: string, perfilId: string): Promise<void> {
  await deleteDoc(doc(db, 'usuarios', uid, 'perfiles', perfilId))
}
