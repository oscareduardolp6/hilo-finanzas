/* Acciones de Ajustes: guardar la config de escaneo y abrir las otras hojas.

   Se llama `settings-actions-slice` y no `settings-slice` porque ese nombre ya
   lo tiene `app/store/settings-slice.ts`, que aporta los CAMPOS. La división es
   la de siempre: `app/store/` tiene el estado agrupado por ciclo de vida,
   `features/<f>/store/` solo acciones sobre él. */

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runRTE } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import type { OcrSettings } from '../../../shared/domain/types';
import { cleanOcrSettings, saveOcrSettings } from '../application/save-ocr-settings';

/** Las tres hojas que se abren DESDE Ajustes. Abrir una cierra Ajustes. */
export type SettingsTool = 'import' | 'sync' | 'backup';

export type SettingsActionsSlice = {
  saveOcrSettings: (input: Partial<OcrSettings>) => Promise<void>;
  /** Cierra Ajustes y abre la hoja pedida, en un solo `set`. */
  openFromSettings: (tool: SettingsTool) => void;
};

export const createSettingsActionsSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], SettingsActionsSlice> =>
  (set) => ({
    saveOcrSettings: async (input) => {
      const clean = cleanOcrSettings(input);
      /* El estado y el toast van ANTES de escribir, igual que antes del
         refactor: la config ya está en efecto en memoria y la escritura es una
         consecuencia. Si falla, el toast de error pisa al de éxito. */
      set({
        ocrSettings: clean,
        toast: clean.apiKey ? 'Config de escaneo guardada' : 'API key eliminada',
      });
      const result = await runRTE(saveOcrSettings(clean), deps);
      /* El mensaje NO es el genérico de `messageFor`: aquí lo que falló es la
         config de escaneo, no un movimiento, y el usuario necesita saber cuál
         de las dos cosas no se guardó. */
      pipe(
        result,
        E.match(
          () => set({ toast: 'No se pudo guardar la config de escaneo' }),
          () => {},
        ),
      );
    },

    openFromSettings: (tool) => {
      set({
        settingsOpen: false,
        importModalOpen: tool === 'import',
        syncModalOpen: tool === 'sync',
        backupModalOpen: tool === 'backup',
      });
    },
  });
