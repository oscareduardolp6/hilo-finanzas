/* Config de OCR, estado de sync y modo privado (ocultar saldos): se
   persisten, pero cada uno bajo su propia clave de IndexedDB y NUNCA dentro
   del blob que viaja en sync / QR / respaldo. Por eso viven aparte del
   `data-slice`. */

import type { StateCreator } from 'zustand';
import type { OcrSettings, SyncState } from '../../shared/domain/types';
import { makeSetter } from './setter';
import type { Setter } from './setter';
import type { HiloStore } from './index';

export type SettingsSlice = {
  ocrSettings: OcrSettings;
  /** `null` hasta que termina la hidratación. */
  syncState: SyncState | null;
  /** Modo privado: oculta saldos y montos con un placeholder. */
  hideBalances: boolean;

  setOcrSettings: Setter<OcrSettings>;
  setSyncState: Setter<SyncState | null>;
  setHideBalances: Setter<boolean>;
};

export const createSettingsSlice: StateCreator<HiloStore, [], [], SettingsSlice> = (set) => ({
  ocrSettings: { apiKey: '', model: '' },
  syncState: null,
  hideBalances: false,

  setOcrSettings: makeSetter<HiloStore, 'ocrSettings'>(set, 'ocrSettings'),
  setSyncState: makeSetter<HiloStore, 'syncState'>(set, 'syncState'),
  setHideBalances: makeSetter<HiloStore, 'hideBalances'>(set, 'hideBalances'),
});
