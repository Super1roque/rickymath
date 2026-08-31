'use client'

// Keyframes compartidos por los efectos "gamificados" de las guías (rebote
// al acertar, sacudida al fallar, confetti, pulso de racha). Un solo
// <style> por página alcanza — se monta una vez en el layout de la
// actividad, y los componentes de abajo solo referencian los nombres.
export default function EstilosJuego() {
  return (
    <style>{`
      @keyframes gj-pop {
        0% { transform: scale(1); }
        35% { transform: scale(1.08); }
        65% { transform: scale(0.97); }
        100% { transform: scale(1); }
      }
      @keyframes gj-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-6px); }
        40% { transform: translateX(6px); }
        60% { transform: translateX(-4px); }
        80% { transform: translateX(4px); }
      }
      @keyframes gj-confetti {
        0% { transform: translate(0, 0) scale(1); opacity: 1; }
        100% { transform: translate(var(--gj-dx), var(--gj-dy)) scale(0.4); opacity: 0; }
      }
      @keyframes gj-pulso {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.12); }
      }
      @keyframes gj-entrada {
        0% { opacity: 0; transform: translateY(-6px) scale(0.9); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      /* Botón con relieve 3D — el color del "canto" se pasa por la variable
         --gj-sombra en el style inline de cada botón, así una sola regla
         sirve para cualquier color. Al presionar, el botón baja Y el canto
         se acorta a la vez, para que dé la sensación de hundirse de verdad
         en vez de solo moverse por encima de una sombra fija. */
      .gj-boton-3d {
        transition: transform 0.08s ease, box-shadow 0.08s ease;
      }
      .gj-boton-3d:active {
        transform: translateY(4px);
        box-shadow: 0 2px 0 var(--gj-sombra) !important;
      }

      /* Movimientos del mascota Ricky — verbatim del handoff de diseño
         (design_handoff_ricky_avatar), cubo que se mueve en pasos, nunca
         en curvas suaves. */
      @keyframes r-breathe {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-2%) scale(1.012); }
      }
      @keyframes r-bounce {
        0% { transform: translateY(0) scaleY(1); }
        18% { transform: translateY(0) scaleY(.9) scaleX(1.06); }
        45% { transform: translateY(-22%) scaleY(1.06) scaleX(.96); }
        70% { transform: translateY(0) scaleY(.94) scaleX(1.04); }
        100% { transform: translateY(0) scaleY(1); }
      }
      @keyframes r-wave {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-7deg); }
        75% { transform: rotate(7deg); }
      }
      @keyframes r-pop {
        0% { transform: scale(.4); opacity: 0; }
        60% { transform: scale(1.12); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes r-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-5px); }
        40% { transform: translateX(5px); }
        60% { transform: translateX(-3px); }
        80% { transform: translateX(3px); }
      }
      @keyframes r-drift {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @media (prefers-reduced-motion: reduce) {
        .ricky-anim { animation: none !important; }
      }
    `}</style>
  )
}
