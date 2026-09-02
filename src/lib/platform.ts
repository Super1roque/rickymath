// Precio y datos de pago para desbloquear el contenido premium — pago
// único (no suscripción), misma cuenta bancaria que ya usás en pos-saas.
export const PRECIO_PREMIUM = 350 // Lempiras, pago único

export const DATOS_PAGO = {
  banco: 'Banco Atlántida',
  cuenta: '14720926485',
  titular: 'Armando Roque Godoy',
  whatsapp: '50496895978',
}

// Grados/series que quedan gratis para siempre — el resto requiere el
// pago único para desbloquearse. "primero" como gancho real (grado
// completo, no un recorte) y "tablas" porque es contenido bonus corto,
// buena muestra sin regalar el catálogo completo.
export const GRADOS_GRATIS = ['primero', 'tablas']

export function esGradoGratis(gradoSlug: string): boolean {
  return GRADOS_GRATIS.includes(gradoSlug)
}

const TODOS_LOS_GRADOS = ['primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'tablas', 'problemas']

// De "/segundo-modulo-03" o "/segundo-menu" saca "segundo" — para poder
// bloquear el acceso directo por URL a rutas premium (no solo el click
// en /grados, que un usuario puede saltarse tipeando la URL o volviendo
// con el botón atrás del navegador).
export function gradoDeRuta(pathname: string): string | null {
  const slug = pathname.replace(/^\//, '').split('/')[0]
  return TODOS_LOS_GRADOS.find(g => slug === `${g}-menu` || slug.startsWith(`${g}-modulo-`)) ?? null
}
