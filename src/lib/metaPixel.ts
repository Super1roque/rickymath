'use client'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function trackMetaPixel(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.fbq) return
  window.fbq('track', event, params)
}
