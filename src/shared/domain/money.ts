/** Pesos mexicanos, siempre con dos decimales y el signo por delante del `$`. */
export function formatMoney(n: unknown): string {
  const num = Number(n) || 0;
  const sign = num < 0 ? '-' : '';
  return (
    sign + '$' + Math.abs(num).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}
