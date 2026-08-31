// Sonidos sintetizados (sin archivos externos) y lectura en voz alta para
// las guías interactivas (tercero-modulo-01, 02, ...) — no depende de
// Firebase/auth, son páginas standalone que no forman parte de Mi Ventita.

// Un solo AudioContext reutilizado para toda la página — crear uno nuevo en
// cada sonido (como se hacía antes) los deja todos sin cerrar, y varios
// navegadores (sobre todo Chrome/Android) empiezan a suspender los
// contextos de más silenciosamente después de unos cuantos, sin lanzar
// ningún error: el resto del código sigue corriendo normal, pero el sonido
// simplemente no se escucha.
let audioCtxCompartido: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioCtxCompartido && audioCtxCompartido.state !== 'closed') {
    if (audioCtxCompartido.state === 'suspended') audioCtxCompartido.resume().catch(() => {})
    return audioCtxCompartido
  }
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  audioCtxCompartido = Ctor ? new Ctor() : null
  return audioCtxCompartido
}

export function reproducirCorrecto(): void {
  const ctx = getAudioCtx()
  if (!ctx) return
  const ahora = ctx.currentTime
  ;[523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const inicio = ahora + i * 0.1
    gain.gain.setValueAtTime(0.0001, inicio)
    gain.gain.linearRampToValueAtTime(0.28, inicio + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.28)
    osc.connect(gain).connect(ctx.destination)
    osc.start(inicio)
    osc.stop(inicio + 0.3)
  })
}

export function reproducirIncorrecto(): void {
  const ctx = getAudioCtx()
  if (!ctx) return
  const ahora = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(220, ahora)
  osc.frequency.exponentialRampToValueAtTime(110, ahora + 0.32)
  gain.gain.setValueAtTime(0.22, ahora)
  gain.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.36)
  osc.connect(gain).connect(ctx.destination)
  osc.start(ahora)
  osc.stop(ahora + 0.37)
}

export function reproducirFanfarria(): void {
  const ctx = getAudioCtx()
  if (!ctx) return
  const ahora = ctx.currentTime
  ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const inicio = ahora + i * 0.13
    gain.gain.setValueAtTime(0.0001, inicio)
    gain.gain.linearRampToValueAtTime(0.3, inicio + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start(inicio)
    osc.stop(inicio + 0.42)
  })
}

// Lee un texto en voz alta con audio real generado en el servidor (Deepgram
// Aura-2, voz "olivia") en vez de la voz sintética del navegador — la del
// navegador sonaba mal y, peor, casi nunca hay voces en español instaladas
// en celulares, así que ahí directamente no sonaba nada. Al reproducir un
// MP3 ya generado funciona igual en cualquier dispositivo.
// Cachea por texto exacto (Map en memoria, vive mientras dure la pestaña)
// para no volver a pagarle a Deepgram si el chico toca 🔊 varias veces la
// misma pregunta.
const cacheAudio = new Map<string, string>()
let audioActual: HTMLAudioElement | null = null
// Si se interrumpe un audio en curso (el chico toca otro botón de lectura
// antes de que termine), este resolver deja que la promesa del llamado
// anterior se cierre igual — si no, ese botón se quedaría con el estado
// "cargando" trabado para siempre, porque su evento 'ended' nunca llega.
let resolverAudioActual: (() => void) | null = null

// Se resuelve recién cuando el audio TERMINA de sonar (evento 'ended'), no
// apenas arranca — así el estado "cargando" de los botones (y el mood
// "pensando" de Ricky) dura toda la explicación hablada, no solo el
// fetch al servidor.
export async function leerTexto(texto: string): Promise<void> {
  if (typeof window === 'undefined') return

  if (audioActual) {
    audioActual.pause()
    audioActual = null
    resolverAudioActual?.()
    resolverAudioActual = null
  }

  let url = cacheAudio.get(texto)
  if (!url) {
    const res = await fetch('/api/guia-voz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    })
    if (!res.ok) throw new Error(`guia-voz respondió ${res.status}`)
    const blob = await res.blob()
    url = URL.createObjectURL(blob)
    cacheAudio.set(texto, url)
  }

  const audio = new Audio(url)
  audioActual = audio

  await new Promise<void>((resolve, reject) => {
    const limpiar = () => { resolverAudioActual = null }
    resolverAudioActual = resolve
    audio.addEventListener('ended', () => { limpiar(); resolve() }, { once: true })
    audio.addEventListener('error', () => { limpiar(); reject(new Error('Error reproduciendo el audio')) }, { once: true })
    audio.play().catch(err => { limpiar(); reject(err) })
  })
}

const MARCAS_DIACRITICAS = /[̀-ͯ]/g

export function normalizarTexto(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(MARCAS_DIACRITICAS, '')
}
