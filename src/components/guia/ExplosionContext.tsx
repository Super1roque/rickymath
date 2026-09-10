'use client'

import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react'
import Explosion, { type ExplosionHandle } from './Explosion'

// Un solo <Explosion> montado UNA vez en toda la app (ver layout.tsx), y
// expuesto acá vía Context — así CUALQUIER botón de CUALQUIER módulo puede
// disparar la explosión llamando a useExplosion() sin que cada componente
// tenga que recibir un ref por props (eso obligaría a enhebrarlo manualmente
// por cada tarjeta/botón de cada módulo, algo que no escala).
const ExplosionContext = createContext<((texto: string, origen: DOMRect) => void) | null>(null)

export function ExplosionProvider({ children }: { children: ReactNode }) {
  const explosionRef = useRef<ExplosionHandle>(null)
  // Función estable (no cambia entre renders) que reenvía al ref real —
  // así el valor del Context nunca varía, aunque el ref recién se complete
  // después del primer render (los consumidores solo lo LEEN al hacer
  // click, nunca antes).
  const disparar = useCallback((texto: string, origen: DOMRect) => {
    explosionRef.current?.disparar(texto, origen)
  }, [])

  return (
    <ExplosionContext.Provider value={disparar}>
      {children}
      <Explosion ref={explosionRef} />
    </ExplosionContext.Provider>
  )
}

// Hook que usa cualquier botón/tarjeta para festejar al tocarse. Fuera del
// Provider (no debería pasar) devuelve una función vacía, para no romper
// nada si algún componente se usa de forma aislada.
export function useExplosion(): (texto: string, origen: DOMRect) => void {
  const ctx = useContext(ExplosionContext)
  return ctx ?? (() => {})
}
