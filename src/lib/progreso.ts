import { doc, runTransaction, serverTimestamp, collection, onSnapshot, type Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface ProgresoModulo {
  correctas: number
  total: number
  puntos: number
  mejorRacha: number
  mejorPuntaje: number
  mejorRachaHistorica: number
  intentos: number
  actualizadoEn: Timestamp | null
}

// Se guarda un doc por módulo (no un historial completo) — la última
// jugada más los "mejores" históricos alcanzan para que el padre vea cómo
// va sin necesitar una subcolección de intentos. Transacción para que
// "mejorPuntaje"/"mejorRachaHistorica" sean máximos reales entre intentos,
// no el último valor pisando al anterior.
export async function guardarProgresoModulo(
  uid: string, perfilId: string, moduloId: string,
  datos: { correctas: number; total: number; puntos: number; mejorRacha: number },
): Promise<void> {
  const ref = doc(db, 'usuarios', uid, 'perfiles', perfilId, 'progreso', moduloId)
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const previo = snap.exists() ? (snap.data() as Partial<ProgresoModulo>) : null
    tx.set(ref, {
      correctas: datos.correctas,
      total: datos.total,
      puntos: datos.puntos,
      mejorRacha: datos.mejorRacha,
      mejorPuntaje: Math.max(datos.puntos, previo?.mejorPuntaje ?? 0),
      mejorRachaHistorica: Math.max(datos.mejorRacha, previo?.mejorRachaHistorica ?? 0),
      intentos: (previo?.intentos ?? 0) + 1,
      actualizadoEn: serverTimestamp(),
    })
  })
}

export function suscribirseProgreso(
  uid: string, perfilId: string, onChange: (progreso: Record<string, ProgresoModulo>) => void,
): () => void {
  const ref = collection(db, 'usuarios', uid, 'perfiles', perfilId, 'progreso')
  return onSnapshot(ref, snap => {
    const mapa: Record<string, ProgresoModulo> = {}
    snap.docs.forEach(d => { mapa[d.id] = d.data() as ProgresoModulo })
    onChange(mapa)
  })
}
