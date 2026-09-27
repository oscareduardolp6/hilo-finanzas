/* Config de OCR y modo privado (ocultar saldos): se persisten, pero cada uno
   bajo su propia clave de IndexedDB y NUNCA dentro del blob que viaja a
   Firestore / respaldo. Por eso viven aparte del `data-slice`. */

import type { StateCreator } from 'zustand';
import type { OcrSettings } from '../../shared/domain/types';
import { makeSetter } from './setter';
import type { Setter } from './setter';
import type { HiloStore } from './index';

export type SettingsSlice = {
  ocrSettings: OcrSettings;
  /** Modo privado: oculta saldos y montos con un placeholder. */
  hideBalances: boolean;

  setOcrSettings: Setter<OcrSettings>;
  setHideBalances: Setter<boolean>;
};

export const createSettingsSlice: StateCreator<HiloStore, [], [], SettingsSlice> = (set) => ({
  ocrSettings: { apiKey: '', model: '' },
  hideBalances: false,

  setOcrSettings: makeSetter<HiloStore, 'ocrSettings'>(set, 'ocrSettings'),
  setHideBalances: makeSetter<HiloStore, 'hideBalances'>(set, 'hideBalances'),
});
