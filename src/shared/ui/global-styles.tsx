/* Las reglas de CSS que Tailwind no cubre: las fuentes, el scrollbar oculto, el
   estilo de los inputs nativos y las dos animaciones de las hojas.

   Se inyecta una vez por árbol (móvil o escritorio) y vive en `shared/ui`
   porque no es de ninguna feature. */

export function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      .font-display { font-family: 'Fraunces', Georgia, serif; }
      .font-mono-custom { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-variant-numeric: tabular-nums; }
      .hilo-scroll::-webkit-scrollbar { display: none; }
      .hilo-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.85); cursor: pointer; }
      input[type="number"]::-webkit-outer-spin-button,
      input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      input[type="number"] { -moz-appearance: textfield; }
      @keyframes hiloSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes hiloFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .hilo-sheet { animation: hiloSlideUp 0.28s cubic-bezier(0.16,1,0.3,1); }
      .hilo-overlay { animation: hiloFadeIn 0.2s ease; }
      @media (prefers-reduced-motion: reduce) {
        .hilo-sheet, .hilo-overlay { animation: none !important; }
      }
    `}</style>
  );
}
