/* Caso de uso: crear una categoría desde el alta inline de `CategoryPicker`.

   Las categorías no tienen pantalla propia — se crean al vuelo desde el
   formulario de movimiento, el de plan MSI y el picker de planes. Por eso la
   feature es mínima: un caso de uso y una acción. */

import type { ReaderIO } from 'fp-ts/ReaderIO';
import type { Deps } from '../../../app/dependencies';
import type { Category, NewCategory } from '../../../shared/domain/types';

export type CreateCategoryResult = {
  categories: Category[];
  /** La creada: quien la pidió necesita su id para seleccionarla. */
  category: Category;
  toast: string;
};

export const createCategory =
  (categories: Category[], input: NewCategory): ReaderIO<Deps, CreateCategoryResult> =>
  (deps) =>
  () => {
    // Sin `createdAt`, igual que antes del refactor: el alta inline nunca lo
    // puso. No estorba porque `recordStamp` usa `updatedAt` primero, pero es una
    // asimetría con los planes (que sí lo traen) que conviene corregir aparte —
    // hacerlo aquí sería cambiar comportamiento dentro de un refactor.
    const category: Category = { ...input, id: deps.idGenerator('cat'), updatedAt: deps.clock() };
    return {
      categories: [...categories, category],
      category,
      toast: 'Categoría creada',
    };
  };
