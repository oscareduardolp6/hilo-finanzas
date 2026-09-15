/** Placeholder para un monto oculto en modo privado. */
export const HIDDEN_MONEY_PLACEHOLDER = '$••••';

/** Pesos mexicanos, siempre con dos decimales y el signo por delante del `$`.
 *  Con `hidden` en `true` devuelve un placeholder fijo en vez del monto real. */
export function formatMoney(n: unknown, hidden?: boolean): string {
  if (hidden) return HIDDEN_MONEY_PLACEHOLDER;
  const num = Number(n) || 0;
  const sign = num < 0 ? '-' : '';
  return (
    sign + '$' + Math.abs(num).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
