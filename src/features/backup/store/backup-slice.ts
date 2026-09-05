/* Acciones de respaldo: bajar, copiar, leer un archivo y restaurar.

   Único punto de la feature que corre una mónada y hace `match` del `Either`.
   Lo que cruza a la UI son datos planos, nunca un `Either`.

   Igual que en `sync`, el fallo NO sale como toast: el mensaje habla del
   archivo que el usuario acaba de elegir y va dentro de la hoja, debajo del
   botón. `restoreBackup` sí deja toast, porque para cuando aparece la hoja ya
   se cerró. */

import { pipe } from 'fp-ts/function';
import * as E from 'fp-ts/Either';
import type { StateCreator } from 'zustand';
import type { Deps } from '../../../app/dependencies';
import { runR, runRT, runRTE } from '../../../app/run';
import type { HiloStore } from '../../../app/store';
import { selectDataState } from '../../../app/store/data-slice';
import { messageFor } from '../../../shared/domain/errors';
import type { HiloError } from '../../../shared/domain/errors';
import type { DataState } from '../../../shared/domain/types';
import { backupText, buildBackup } from '../application/build-backup';
import { readBackup } from '../application/read-backup';
import { replaceDataState } from '../domain/replace';

export type BackupOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Leer sale con el respaldo en la mano: la hoja lo retiene hasta que el
 *  usuario confirma, así que el valor tiene que cruzar a la UI. */
export type ReadBackupOutcome =
  | { readonly ok: true; readonly backup: DataState }
  | { readonly ok: false; readonly message: string };

export type BackupSlice = {
  /** Baja el JSON completo al disco. */
  downloadBackup: () => void;
  /** Copia el respaldo como texto; falla si el navegador no deja. */
  copyBackup: () => Promise<BackupOutcome>;
  /** Lee un archivo y devuelve lo que trae, sin aplicarlo todavía. */
  readBackupFile: (file: File) => Promise<ReadBackupOutcome>;
  /** Reemplaza TODO por el respaldo. Es lo que la confirmación protege. */
  restoreBackup: (backup: DataState) => void;
};

export const createBackupSlice =
  (deps: Deps): StateCreator<HiloStore, [], [], BackupSlice> =>
  (set, get) => ({
    downloadBackup: () => {
      const { payload, fileName } = runR(buildBackup(selectDataState(get())), deps);
      deps.downloadGateway.json(payload, fileName);
    },

    copyBackup: async () => {
      const text = await runRT(backupText(selectDataState(get())), deps);
      if (text === null) return { ok: false, message: 'No se pudo copiar.' };
      try {
        await deps.clipboardGateway.writeText(text);
        return { ok: true };
      } catch {
        return { ok: false, message: 'No se pudo copiar.' };
      }
    },

    readBackupFile: async (file) => {
      const result = await runRTE(readBackup(file), deps);
      return pipe(
        result,
        E.match(
          (error: HiloError): ReadBackupOutcome => ({ ok: false, message: messageFor(error) }),
          (backup): ReadBackupOutcome => ({ ok: true, backup }),
        ),
      );
    },

    /* Transformación pura del dominio, sin caso de uso: no toca IO ni necesita
       reloj. Lo que se pierde aquí no deja lápidas a propósito — esto no es un
       borrado que haya que propagar, es otro dataset. */
    restoreBackup: (backup) => {
      set({ ...replaceDataState(backup), toast: 'Respaldo restaurado' });
    },
  });
