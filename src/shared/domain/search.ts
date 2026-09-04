/* Coincidencia de texto para los buscadores: sin distinción de mayúsculas ni
   acentos ("nomina" encuentra "Nómina"). Query vacío = todo pasa. Compartido
   por el buscador de cuentas y el del historial. */

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

export function normalizeForSearch(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '');
}

export function accountNameMatches(name: string | null | undefined, query: string | null | undefined): boolean {
  const q = normalizeForSearch(query).trim();
  return !q || normalizeForSearch(name).includes(q);
}
