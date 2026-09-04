/* Fechas en español de México. Las fechas del dominio son strings ISO
   `YYYY-MM-DD` (no `Date`) porque las vistas por mes filtran con prefix match. */

/** Hoy en ISO local — ojo: local, no UTC, para que "hoy" sea el del usuario. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `YYYY-MM`: la clave con la que se filtra un mes. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(d: Date): string {
  const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "Hoy" / "Ayer" / "3 de marzo" (con año si es de otro año). */
export function formatDateLabel(iso: string): string {
  // El cast preserva el comportamiento original ante un ISO malformado (una
  // fecha inválida), en vez de inventar defaults que lo volverían válido.
  const parts = iso.split('-').map(Number) as [number, number, number];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.getTime() === today.getTime()) return 'Hoy';
  if (d.getTime() === yesterday.getTime()) return 'Ayer';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== today.getFullYear()) opts.year = 'numeric';
  const label = d.toLocaleDateString('es-MX', opts);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
