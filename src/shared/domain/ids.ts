/** Id local: no hay backend que los asigne, así que basta tiempo + azar.
 *  Es la implementación por defecto del puerto `IdGenerator`; los casos de uso
 *  reciben el generador inyectado para poder fijarlo en test. */
export function uid(prefix?: string): string {
  return `${prefix || 'id'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
