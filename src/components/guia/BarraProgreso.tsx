'use client'

export default function BarraProgreso({ completadas, total, color = '#fbbf24' }: {
  completadas: number
  total: number
  color?: string
}) {
  const pct = total > 0 ? Math.min(100, (completadas / total) * 100) : 0
  return (
    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 999, height: 10, overflow: 'hidden', width: '100%' }}>
      <div style={{
        background: `linear-gradient(90deg, ${color}, ${color}cc)`, height: '100%', width: `${pct}%`,
        transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)', borderRadius: 999,
      }} />
    </div>
  )
}
