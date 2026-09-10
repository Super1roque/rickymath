'use client'

import { useEffect } from 'react'

export default function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').then(registration => {
      // Sin este .update() explícito, Chrome puede tardar hasta 24h en
      // darse cuenta de que hay una versión nueva del sw.js en el servidor
      // (es un límite del navegador, no depende del Cache-Control del
      // archivo) — quedaría corriendo la versión vieja todo ese tiempo.
      registration.update().catch(() => {})
    }).catch(() => {})
  }, [])
  return null
}
