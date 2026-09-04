/* Acciones sobre `categories`. La colección vive en `data-slice`.

   `createCategory` DEVUELVE la categoría creada: `CategoryPicker` la necesita
   para dejarla seleccionada, y así el id lo sigue generando el caso de uso y no
   el componente. Es la excepción a "las acciones devuelven void", y está
   justificada: la alternativa era `uid()` dentro del render. */

import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRIO } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import type { Category, NewCategory } from '../../../shared/domain/types';
import { createCategory } from '../application/create-category';

export type CategoriesSlice = {
  createCategory: (input: NewCategory) => Category;
};

export const createCategoriesSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], CategoriesSlice> =>
  (set, get) => ({
    createCategory: (input) => {
      const result = runRIO(createCategory(get().categories, input), deps);
      set({ categories: result.categories, toast: result.toast });
      return result.category;
    },
  });
