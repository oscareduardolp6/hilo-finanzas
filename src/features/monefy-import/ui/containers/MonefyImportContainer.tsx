/* Componente de LÓGICA de la hoja de importar desde Monefy.

   Partido en dos como los de `sync` y `backup`: `MonefyImportSheet` se monta y
   se desmonta con la hoja, así que cerrarla a media revisión y volver a abrir
   arranca otra vez en "subir archivo" — que es lo que hacía cuando el modal se
   montaba condicionalmente.

   Las cuatro pantallas son un `step` local: es navegación dentro de una hoja,
   no estado de la app. Lo que sí sale al store son las tres acciones — leer,
   planear y aplicar —, que son las que tocan reloj, ids y datos. */

import { useState } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import type { AccountDecision, AccountDecisions, MonefyImportPlan } from '../../domain/plan';
import type { MonefyPreview } from '../../domain/preview';
import { MonefyImportModal } from '../components/MonefyImportModal';
import type { MonefyStep } from '../components/MonefyImportModal';

export type MonefyImportContainerProps = {
  desktop?: boolean;
};

export function MonefyImportContainer({ desktop }: MonefyImportContainerProps) {
  const open = useHiloStore((s) => s.importModalOpen);
  if (!open) return null;
  return <MonefyImportSheet desktop={desktop} />;
}

/** Toda cuenta detectada entra por defecto, con el tipo y el nombre sugeridos. */
const defaultDecisions = (preview: MonefyPreview): AccountDecisions => {
  const decisions: AccountDecisions = {};
  for (const acc of preview.accounts) {
    decisions[acc.name] = { include: true, type: acc.suggestedType, name: acc.name };
  }
  return decisions;
};

function MonefyImportSheet({ desktop }: MonefyImportContainerProps) {
  const setOpen = useHiloStore((s) => s.setImportModalOpen);
  const accounts = useHiloStore((s) => s.accounts);
  const readMonefyFile = useHiloStore((s) => s.readMonefyFile);
  const planMonefyImport = useHiloStore((s) => s.planMonefyImport);
  const importMonefy = useHiloStore((s) => s.importMonefy);

  const [step, setStep] = useState<MonefyStep>('upload');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<MonefyPreview | null>(null);
  const [accountDecisions, setAccountDecisions] = useState<AccountDecisions>({});
  const [useOscarConvention, setUseOscarConvention] = useState(true);
  const [result, setResult] = useState<MonefyImportPlan | null>(null);

  return (
    <MonefyImportModal
      step={step}
      existingAccounts={accounts}
      fileName={fileName}
      error={error}
      preview={preview}
      accountDecisions={accountDecisions}
      useOscarConvention={useOscarConvention}
      result={result}
      onFile={(file) => {
        setFileName(file.name);
        setError('');
        void readMonefyFile(file).then((outcome) => {
          if (!outcome.ok) { setError(outcome.message); return; }
          setPreview(outcome.preview);
          setAccountDecisions(defaultDecisions(outcome.preview));
          setStep('review');
        });
      }}
      onDecision={(name, patch: Partial<AccountDecision>) => {
        setAccountDecisions(prev => ({ ...prev, [name]: { ...prev[name]!, ...patch } }));
      }}
      onToggleOscar={() => setUseOscarConvention(v => !v)}
      onRunImport={() => {
        if (!preview) return;
        setStep('importing');
        // El `setTimeout` deja pintar "Importando…" antes de armar el plan, que
        // con un CSV de años es lo bastante lento como para notarse. Estaba así
        // desde antes del refactor.
        setTimeout(() => {
          setResult(planMonefyImport({ preview, accountDecisions, useOscarConvention }));
          setStep('done');
        }, 0);
      }}
      onFinish={() => {
        if (result) importMonefy(result);
        setOpen(false);
      }}
      onClose={() => setOpen(false)}
      desktop={desktop}
    />
  );
}
