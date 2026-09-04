/* Los setters del store imitan la firma de los de `useState`: aceptan un valor
   o una función actualizadora.

   No es nostalgia — es lo que permite que los 28 handlers de `App` migren al
   store SIN tocar su cuerpo. Un handler que hoy hace

       setTransactions(prev => prev.filter(t => t.id !== id))

   sigue escribiéndose igual cuando `setTransactions` viene del store. Durante
   los pasos 3–12 esos handlers se irán reemplazando por acciones respaldadas
   por casos de uso; mientras tanto, esto mantiene el paso 2 mecánico y con la
   suite de regresión en verde. */

export type Updater<A> = A | ((prev: A) => A);

export type Setter<A> = (next: Updater<A>) => void;

const isUpdaterFn = <A>(next: Updater<A>): next is (prev: A) => A => typeof next === 'function';

/** Resuelve un `Updater` contra el valor previo. */
export const applyUpdate = <A>(next: Updater<A>, prev: A): A =>
  isUpdaterFn(next) ? next(prev) : next;

/** Construye un setter estilo `useState` para un campo del store. */
export const makeSetter =
  <S, K extends keyof S>(
    set: (partial: (state: S) => Partial<S>) => void,
    key: K,
  ): Setter<S[K]> =>
  (next) =>
    set((state) =>
      // TypeScript no reconcilia un objeto de clave computada con `Partial<S>`
      // mientras `K` siga siendo genérico; el doble cast es la salida estándar.
      // La firma de `makeSetter` sí queda bien tipada, que es lo que protege a
      // quien la usa.
      ({ [key]: applyUpdate(next, state[key]) }) as unknown as Partial<S>,
    );
