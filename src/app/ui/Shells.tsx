/* Los dos árboles de la app. Son paralelos a propósito —ver
   agents/plans/desktop-view.md—: uno cabe en 375px y el otro reparte lo mismo
   en una rejilla ancha, y forzarlos a ser el mismo con clases responsive
   producía un híbrido peor que los dos.

   Lo que ya NO son es dos cableados distintos. Los dos montan exactamente los
   mismos containers y solo les pasan `desktop`; ninguno recibe props de estado.
   Esa lista compartida es `<Sheets/>`: si se añade una hoja, aparece en los dos
   árboles o en ninguno. */

import { Eye, EyeOff, Plus, ScanLine, Settings } from 'lucide-react';
import { COLORS } from '../../shared/design/tokens';
import { GlobalStyles } from '../../shared/ui/global-styles';
import { Toast } from '../../shared/ui/toast';
import { AccountsContainer } from '../../features/accounts/ui/containers/AccountsContainer';
import { AccountFormContainer } from '../../features/accounts/ui/containers/AccountFormContainer';
import { BackupContainer } from '../../features/backup/ui/containers/BackupContainer';
import { BenefitsContainer } from '../../features/benefits/ui/containers/BenefitsContainer';
import { HomeContainer } from '../../features/dashboard/ui/containers/HomeContainer';
import { HistoryContainer } from '../../features/history/ui/containers/HistoryContainer';
import { MsiContainer } from '../../features/installments/ui/containers/MsiContainer';
import { MsiPlanFormContainer } from '../../features/installments/ui/containers/MsiPlanFormContainer';
import { MonefyImportContainer } from '../../features/monefy-import/ui/containers/MonefyImportContainer';
import { ReceiptScanContainer } from '../../features/receipt-ocr/ui/containers/ReceiptScanContainer';
import { SettingsContainer } from '../../features/settings/ui/containers/SettingsContainer';
import { SyncContainer } from '../../features/sync/ui/containers/SyncContainer';
import { AddTransactionContainer } from '../../features/transactions/ui/containers/AddTransactionContainer';
import { useHiloStore } from '../store-context';
import { BottomNav } from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { TAB_TITLES } from './nav';

type ShellProps = {
  desktop?: boolean;
};

/** La pestaña activa. Cada container elige su vista móvil o de escritorio. */
function ActiveTab({ desktop }: ShellProps) {
  const activeTab = useHiloStore((s) => s.activeTab);
  if (activeTab === 'home') return <HomeContainer desktop={desktop} />;
  if (activeTab === 'history') return <HistoryContainer desktop={desktop} />;
  if (activeTab === 'msi') return <MsiContainer desktop={desktop} />;
  if (activeTab === 'accounts') return <AccountsContainer desktop={desktop} />;
  return null;
}

/** Las diez hojas. Cada una decide sola si está abierta, así que montarlas
 *  siempre no cuesta nada y evita que los dos árboles se desincronicen. */
function Sheets({ desktop }: ShellProps) {
  return (
    <>
      <AddTransactionContainer desktop={desktop} />
      <AccountFormContainer desktop={desktop} />
      <MsiPlanFormContainer desktop={desktop} />
      <SettingsContainer desktop={desktop} />
      <MonefyImportContainer desktop={desktop} />
      <ReceiptScanContainer desktop={desktop} />
      <SyncContainer desktop={desktop} />
      <BackupContainer desktop={desktop} />
      <BenefitsContainer desktop={desktop} />
    </>
  );
}

export function DesktopShell() {
  const activeTab = useHiloStore((s) => s.activeTab);
  const setActiveTab = useHiloStore((s) => s.setActiveTab);
  const openAddSheet = useHiloStore((s) => s.openAddSheet);
  const setSettingsOpen = useHiloStore((s) => s.setSettingsOpen);
  const setReceiptModalOpen = useHiloStore((s) => s.setReceiptModalOpen);
  const toast = useHiloStore((s) => s.toast);
  const hideBalances = useHiloStore((s) => s.hideBalances);
  const setHideBalances = useHiloStore((s) => s.setHideBalances);

  return (
    <div className="w-full h-screen flex" style={{ backgroundColor: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
      <GlobalStyles />
      <DesktopSidebar
        active={activeTab}
        onChange={setActiveTab}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddTransaction={() => openAddSheet('expense')}
        onScanReceipt={() => setReceiptModalOpen(true)}
        hideBalances={hideBalances}
        onToggleHideBalances={() => setHideBalances(!hideBalances)}
      />

      <div className="flex-1 h-full overflow-y-auto hilo-scroll relative">
        <div className="max-w-6xl mx-auto px-10 py-8">
          <h2 className="text-2xl font-semibold font-display mb-6" style={{ color: COLORS.text }}>{TAB_TITLES[activeTab]}</h2>
          <ActiveTab desktop />
        </div>

        {toast && <Toast message={toast} desktop />}
      </div>

      <Sheets desktop />
    </div>
  );
}

export function MobileShell() {
  const activeTab = useHiloStore((s) => s.activeTab);
  const setActiveTab = useHiloStore((s) => s.setActiveTab);
  const openAddSheet = useHiloStore((s) => s.openAddSheet);
  const setSettingsOpen = useHiloStore((s) => s.setSettingsOpen);
  const setReceiptModalOpen = useHiloStore((s) => s.setReceiptModalOpen);
  const toast = useHiloStore((s) => s.toast);
  const hideBalances = useHiloStore((s) => s.hideBalances);
  const setHideBalances = useHiloStore((s) => s.setHideBalances);

  return (
    <div className="w-full h-screen flex justify-center" style={{ backgroundColor: COLORS.bg }}>
      <div className="relative w-full max-w-md h-full flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
        <GlobalStyles />

        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-semibold font-display leading-tight" style={{ color: COLORS.text }}>Hilo</h1>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>Control de gastos</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setHideBalances(!hideBalances)} aria-label={hideBalances ? 'Mostrar saldos' : 'Ocultar saldos'} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
              {hideBalances ? <EyeOff size={16} style={{ color: COLORS.textMuted }} /> : <Eye size={16} style={{ color: COLORS.textMuted }} />}
            </button>
            <button onClick={() => setSettingsOpen(true)} aria-label="Abrir ajustes" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
              <Settings size={16} style={{ color: COLORS.textMuted }} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hilo-scroll px-5 pb-24">
          <ActiveTab />
        </div>

        <BottomNav active={activeTab} onChange={setActiveTab} />

        <button
          onClick={() => setReceiptModalOpen(true)}
          aria-label="Escanear ticket"
          className="absolute right-6 z-20 w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.borderStrong}`, bottom: 150 }}
        >
          <ScanLine size={18} color={COLORS.text} />
        </button>

        <button
          onClick={() => openAddSheet('expense')}
          aria-label="Agregar movimiento"
          className="absolute right-5 z-20 w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          style={{ backgroundColor: COLORS.accent, bottom: 82 }}
        >
          <Plus size={24} color={COLORS.bg} />
        </button>

        <Sheets />

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
