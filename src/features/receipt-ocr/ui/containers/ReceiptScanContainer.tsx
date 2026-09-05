/* Componente de LÓGICA de la hoja de escanear ticket.

   Partido en dos como los de `sync`, `backup` y `monefy-import`: el borrador y
   lo que el usuario lleva corregido viven en `ReceiptScanSheet`, que se
   desmonta al cerrar. Un ticket a medio revisar no debe seguir ahí la próxima
   vez que se abra la cámara.

   Todo el estado de aquí es borrador de UI —lo que se está editando antes de
   confirmar—; lo único que sale al store son las dos acciones. */

import { useMemo, useState } from 'react';
import { useHiloStore } from '../../../../app/store-context';
import { todayIso } from '../../../../shared/domain/dates';
import { uid } from '../../../../shared/domain/ids';
import type { ReceiptDiscount, ReceiptDraft, ReceiptRow } from '../../domain/draft';
import { computeReviewTotals, rowAccountId } from '../../domain/review';
import { ReceiptScanModal } from '../components/ReceiptScanModal';
import type { ReceiptStep } from '../components/ReceiptScanModal';

export type ReceiptScanContainerProps = {
  desktop?: boolean;
};

export function ReceiptScanContainer({ desktop }: ReceiptScanContainerProps) {
  const open = useHiloStore((s) => s.receiptModalOpen);
  if (!open) return null;
  return <ReceiptScanSheet desktop={desktop} />;
}

function ReceiptScanSheet({ desktop }: ReceiptScanContainerProps) {
  const setOpen = useHiloStore((s) => s.setReceiptModalOpen);
  const setSettingsOpen = useHiloStore((s) => s.setSettingsOpen);
  const accounts = useHiloStore((s) => s.accounts);
  const categories = useHiloStore((s) => s.categories);
  const ocrSettings = useHiloStore((s) => s.ocrSettings);
  const scanReceipt = useHiloStore((s) => s.scanReceipt);
  const addReceiptTransactions = useHiloStore((s) => s.addReceiptTransactions);

  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);

  const [step, setStep] = useState<ReceiptStep>('capture');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);

  const [store, setStore] = useState('');
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [discounts, setDiscounts] = useState<ReceiptDiscount[]>([]);
  const [primaryAccountId, setPrimaryAccountId] = useState(accounts[0] ? accounts[0].id : '');
  // La segunda cuenta como origen por defecto: si se paga con tarjeta, el
  // dinero rara vez sale de la misma cuenta donde cae el gasto.
  const [originAccountId, setOriginAccountId] = useState(
    accounts[1] ? accounts[1].id : (accounts[0] ? accounts[0].id : ''),
  );
  // Solo para este ticket: no cambia nada de la cuenta.
  const [accountModes, setAccountModes] = useState<Record<string, boolean | undefined>>({});

  const totals = computeReviewTotals({
    rows, discounts, primaryAccountId, originAccountId, accountModes,
    ticketTotal: draft ? draft.ticketTotal : 0,
  });

  return (
    <ReceiptScanModal
      step={step}
      accounts={accounts}
      expenseCategories={expenseCategories}
      hasApiKey={!!ocrSettings.apiKey}
      error={error}
      draft={draft}
      store={store}
      date={date}
      rows={rows}
      discounts={discounts}
      primaryAccountId={primaryAccountId}
      originAccountId={originAccountId}
      accountModes={accountModes}
      totals={totals}
      onFile={(file) => {
        setError('');
        setStep('processing');
        void scanReceipt(file).then((outcome) => {
          if (!outcome.ok) { setError(outcome.message); setStep('capture'); return; }
          setDraft(outcome.draft);
          setStore(outcome.draft.store);
          setDate(outcome.draft.date);
          setRows(outcome.draft.rows);
          setDiscounts(outcome.draft.discounts);
          setStep('review');
        });
      }}
      onStore={setStore}
      onDate={setDate}
      onPrimaryAccount={setPrimaryAccountId}
      onOriginAccount={setOriginAccountId}
      onPatchRow={(id, patch) => setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))}
      onPatchDiscount={(id, patch) => setDiscounts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))}
      onAddDiscount={() => setDiscounts(prev => [...prev, { id: uid('rdsc'), label: '', amount: '', accountId: null, included: true }])}
      onToggleAccountMode={(accountId) => setAccountModes(prev => ({ ...prev, [accountId]: !prev[accountId] }))}
      onConfirm={() => {
        setStep('saving');
        addReceiptTransactions({
          date,
          store: store.trim(),
          originAccountId,
          rows: totals.includedRows.map(r => ({
            description: r.description.trim(),
            amount: parseFloat(String(r.amount)) || 0,
            categoryId: r.categoryId,
            accountId: rowAccountId(r, primaryAccountId),
            quantity: (r.quantity || '').trim(),
            viaTransfer: !!accountModes[rowAccountId(r, primaryAccountId)],
          })),
          discounts: totals.includedDiscounts.map(d => ({
            label: d.label.trim(),
            amount: parseFloat(String(d.amount)) || 0,
            accountId: d.accountId || primaryAccountId,
          })),
        });
        setOpen(false);
      }}
      onOpenSettings={() => { setOpen(false); setSettingsOpen(true); }}
      onClose={() => setOpen(false)}
      desktop={desktop}
    />
  );
}
