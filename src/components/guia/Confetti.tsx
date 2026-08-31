'use client'

const PARTICULAS = ['🎉', '✨', '⭐', '💥', '🟡']

// Ráfaga de partículas que salen disparadas desde el centro y se
// desvanecen — se monta una sola vez (el llamador la renderiza
// condicionalmente cuando la respuesta queda marcada correcta, y como el
// estado de esa pregunta se congela, nunca se vuelve a montar).
export default function Confetti() {
  const items = Array.from({ length: 10 }, (_, i) => {
    const angulo = (i / 10) * Math.PI * 2 + Math.random() * 0.3
    const dist = 34 + Math.random() * 22
    return {
      emoji: PARTICULAS[i % PARTICULAS.length],
      dx: Math.cos(angulo) * dist,
      dy: Math.sin(angulo) * dist,
      delay: Math.random() * 0.08,
    }
  })

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 5 }}>
      {items.map((it, i) => (
        <span
          key={i}
          style={{
            position: 'absolute', left: '50%', top: '38%', fontSize: '1rem',
            ['--gj-dx' as string]: `${it.dx}px`,
            ['--gj-dy' as string]: `${it.dy}px`,
            animation: `gj-confetti 0.7s ease-out ${it.delay}s forwards`,
          } as React.CSSProperties}
        >
          {it.emoji}
        </span>
      ))}
    </div>
  )
}
