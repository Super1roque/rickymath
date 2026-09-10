const CACHE_NAME = 'rickymath-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Los assets con hash en el nombre (_next/static) nunca cambian de
  // contenido para la misma URL — cache-first es seguro y rápido, sin
  // riesgo de que quede pegada una versión vieja después de un deploy.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          const copy = response.clone()
          // .catch() silencioso — un fallo al guardar en caché no debe
          // tumbar la respuesta real, que ya se está devolviendo igual.
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}))
          return response
        })
      }),
    )
    return
  }

  // Todo lo demás (páginas, HTML) va primero a la red, para que con
  // internet siempre se vea la versión más nueva — el caché es solo el
  // respaldo para cuando no hay conexión.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy).catch(() => {}))
        return response
      })
      .catch(() =>
        // Si la red falla y esta URL puntual nunca se cacheó (ej. una
        // página nueva, recién desplegada), caer al shell de la app en vez
        // de devolver undefined — respondWith() exige siempre una Response
        // real, si no el navegador tira "Failed to convert value to Response".
        // (Con || esto no funciona: caches.match() devuelve una promesa, que
        // siempre es "truthy" — hay que esperar cada resultado con then().)
        caches.match(request).then((cached) => {
          if (cached) return cached
          return caches.match('/').then((home) => home
            || new Response('Sin conexión a internet', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))
        }),
      ),
  )
})
