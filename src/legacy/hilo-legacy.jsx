import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, X, ArrowRightLeft, Landmark,
  TrendingUp, MoreHorizontal,
  Settings, Receipt, LayoutGrid, Link2, Trash2,
  Check, Layers, Smartphone,
  QrCode, Camera, Download, Share2, RefreshCw, DatabaseBackup, ScanLine,
} from 'lucide-react';

/* Migrado a la capa `shared` (paso 1 de agents/plans/layered-architecture.md).
   Este archivo ya solo los consume; el barrel los re-exporta desde su nuevo
   hogar, así que los tests no se enteran del movimiento. */
import { COLORS, ACCOUNT_SEARCH_THRESHOLD, DESKTOP_BREAKPOINT } from '../shared/design/tokens';
import { ICONS, ICON_CHOICES, IconFor } from '../shared/design/icons';
import { accountNameMatches } from '../shared/domain/search';
import { highlightMatch } from '../shared/ui/highlight';
import { SheetOverlay } from '../shared/ui/sheet-overlay';
import { saveOcrSettings } from '../shared/infrastructure/indexed-db';

/* Feature `accounts`, migrada en el paso 3. */
import { AccountsContainer } from '../features/accounts/ui/containers/AccountsContainer';
import { AccountFormContainer } from '../features/accounts/ui/containers/AccountFormContainer';

/* Feature `transactions`, paso 4. El alta, la edición y el borrado son acciones
   del store, y la hoja se monta por container. */
import { AddTransactionContainer } from '../features/transactions/ui/containers/AddTransactionContainer';

/* Feature `installments`, paso 5. */
import { MsiContainer } from '../features/installments/ui/containers/MsiContainer';
import { MsiPlanFormContainer } from '../features/installments/ui/containers/MsiPlanFormContainer';

/* Feature `dashboard`, paso 6: Inicio, la dona y los totales del mes. */
import { HomeContainer } from '../features/dashboard/ui/containers/HomeContainer';

/* Feature `history`, paso 7: filtros y buscador. Con ella se van los dos
   últimos `useMemo` de `AppBody`, que ya no deriva absolutamente nada. */
import { HistoryContainer } from '../features/history/ui/containers/HistoryContainer';

/* Features `sync` (paso 8) y `backup` (paso 9): comparten el formato del
   payload, y de las dos ya no queda nada en este archivo. */
import { SyncContainer } from '../features/sync/ui/containers/SyncContainer';
import { BackupContainer } from '../features/backup/ui/containers/BackupContainer';

/* Feature `monefy-import`, paso 10: el parser del CSV, la hoja de revisión y
   el plan de importación. */
import { MonefyImportContainer } from '../features/monefy-import/ui/containers/MonefyImportContainer';

/* Feature `receipt-ocr`, paso 11: la foto, la llamada a la API de visión y la
   hoja de revisión del ticket. Con ella se va la última llamada a red del
   legacy. */
import { ReceiptScanContainer } from '../features/receipt-ocr/ui/containers/ReceiptScanContainer';

/* Componentes presentacionales compartidos por varias features: por la regla de
   dependencias no pueden vivir en ninguna de ellas. */
import { CategoryPicker } from '../shared/ui/category-picker';
import { StoreInput } from '../shared/ui/store-input';

/* El estado dejó de vivir en `App`: ahora está en el store de zustand, que se
   crea por montaje. Ver src/app/store/ y agents/plans/layered-architecture.md. */
import { HiloStoreProvider, useHiloStore } from '../app/store-context';
import { useToastAutoDismiss } from '../app/use-toast-auto-dismiss';

/* Config del escaneo de tickets. La clave de IndexedDB donde vive
   (`OCR_SETTINGS_STORAGE_KEY`) está en shared/infrastructure/indexed-db.ts. */
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const RECEIPT_MODEL_DEFAULT = 'claude-haiku-4-5';

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: LayoutGrid },
  { id: 'history', label: 'Historial', icon: Receipt },
  { id: 'msi', label: 'MSI', icon: Layers },
  { id: 'accounts', label: 'Cuentas', icon: Landmark },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_BREAKPOINT
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const handler = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                  */
/* ------------------------------------------------------------------ */

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      .font-display { font-family: 'Fraunces', Georgia, serif; }
      .font-mono-custom { font-family: 'IBM Plex Mono', 'Courier New', monospace; font-variant-numeric: tabular-nums; }
      .hilo-scroll::-webkit-scrollbar { display: none; }
      .hilo-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.85); cursor: pointer; }
      input[type="number"]::-webkit-outer-spin-button,
      input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      input[type="number"] { -moz-appearance: textfield; }
      @keyframes hiloSlideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes hiloFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .hilo-sheet { animation: hiloSlideUp 0.28s cubic-bezier(0.16,1,0.3,1); }
      .hilo-overlay { animation: hiloFadeIn 0.2s ease; }
      @media (prefers-reduced-motion: reduce) {
        .hilo-sheet, .hilo-overlay { animation: none !important; }
      }
    `}</style>
  );
}

function Toast({ message, desktop }) {
  const className = desktop
    ? 'fixed z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2'
    : 'absolute left-5 right-5 z-50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-2';
  const style = desktop
    ? { bottom: 24, right: 24, backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}` }
    : { top: 16, backgroundColor: COLORS.elevated, border: `1px solid ${COLORS.borderStrong}` };
  return (
    <div className={className} style={style}>
      <Check size={15} style={{ color: COLORS.income }} />
      <span className="text-sm" style={{ color: COLORS.text }}>{message}</span>
    </div>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <div className="flex items-center justify-around border-t px-1 py-2 shrink-0" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
      {NAV_ITEMS.map(it => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl">
            <Icon size={20} style={{ color: isActive ? COLORS.accent : COLORS.textMuted }} />
            <span className="text-xs font-medium" style={{ color: isActive ? COLORS.accent : COLORS.textMuted }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop shell                                                       */
/* ------------------------------------------------------------------ */
/* Las cuatro pestañas ya son features: cada una monta su container y este
   elige la vista móvil o la de escritorio según el prop `desktop`. Lo que
   queda aquí del árbol de escritorio es el chrome — la barra lateral y el
   contenedor ancho —, más los modales sin migrar. */

function DesktopSidebar({ active, onChange, onOpenSettings, onAddTransaction, onScanReceipt }) {
  return (
    <div className="w-60 shrink-0 h-full flex flex-col border-r px-4 py-6" style={{ backgroundColor: COLORS.surface, borderColor: COLORS.border }}>
      <div className="px-2 mb-8">
        <h1 className="text-xl font-semibold font-display leading-tight" style={{ color: COLORS.text }}>Hilo</h1>
        <p className="text-xs" style={{ color: COLORS.textMuted }}>Control de gastos</p>
      </div>
      <button onClick={onAddTransaction} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-2" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>
        <Plus size={16} /> Nueva transacción
      </button>
      <button onClick={onScanReceipt} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-6" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
        <ScanLine size={16} /> Escanear ticket
      </button>
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(it => {
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onChange(it.id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ backgroundColor: isActive ? COLORS.accentSoft : 'transparent', color: isActive ? COLORS.accent : COLORS.textMuted }}>
              <Icon size={18} />
              {it.label}
            </button>
          );
        })}
      </nav>
      <button onClick={onOpenSettings} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium" style={{ color: COLORS.textMuted }}>
        <Settings size={18} /> Ajustes
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ajustes                                                             */
/* ------------------------------------------------------------------ */

function SettingsModal({ onClose, onResetTransactions, onOpenImport, onOpenSync, onOpenBackup, ocrSettings, onSaveOcrSettings, desktop }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [keyDraft, setKeyDraft] = useState((ocrSettings && ocrSettings.apiKey) || '');
  const [modelDraft, setModelDraft] = useState((ocrSettings && ocrSettings.model) || '');
  const savedKey = (ocrSettings && ocrSettings.apiKey) || '';
  const maskedKey = savedKey ? `•••• ${savedKey.slice(-4)}` : null;
  return (
    <SheetOverlay onClose={onClose} desktop={desktop}>
      <div className="px-5 pt-4 pb-1 flex items-center justify-between">
        <p className="text-lg font-semibold font-display" style={{ color: COLORS.text }}>Ajustes</p>
        <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <X size={15} style={{ color: COLORS.textMuted }} />
        </button>
      </div>
      <div className="px-5 mt-3 pb-6">
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium" style={{ color: COLORS.text }}>Moneda</p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>Pesos mexicanos (MXN)</p>
        </div>
        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.text }}>Sobre la trazabilidad</p>
          <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>Cuando marcas una transferencia como gasto, el monto cuenta en tus reportes por categoría, pero no resta de tu saldo total: el dinero sigue siendo tuyo hasta que de verdad pagas la tarjeta de crédito.</p>
        </div>
        <button onClick={onOpenSync} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <RefreshCw size={15} /> Sincronizar dispositivos
        </button>
        <button onClick={onOpenBackup} className="w-full py-3 rounded-xl text-sm font-semibold mb-3 flex items-center justify-center gap-2" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>
          <DatabaseBackup size={15} /> Respaldo de datos
        </button>
        <button onClick={onOpenImport} className="w-full py-3 rounded-xl text-sm font-semibold mb-3" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Importar desde Monefy</button>

        <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: COLORS.surfaceAlt }}>
          <p className="text-sm font-medium mb-1" style={{ color: COLORS.text }}>Escaneo de tickets (IA)</p>
          <p className="text-xs leading-relaxed mb-3" style={{ color: COLORS.textMuted }}>
            La key se guarda solo en este dispositivo y se envía directo a Anthropic junto con la foto del ticket. No se incluye en la sincronización ni en los respaldos. Usa una key dedicada para Hilo con un límite de gasto mensual: {' '}
            <span style={{ color: COLORS.textFaint }}>console.anthropic.com/settings/keys</span>
          </p>
          <p className="text-xs mb-1" style={{ color: COLORS.textFaint }}>API key {maskedKey ? `· guardada (${maskedKey})` : ''}</p>
          <input
            type="password"
            value={keyDraft}
            onChange={e => setKeyDraft(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <p className="text-xs mb-1" style={{ color: COLORS.textFaint }}>Modelo</p>
          <input
            type="text"
            value={modelDraft}
            onChange={e => setModelDraft(e.target.value)}
            placeholder={RECEIPT_MODEL_DEFAULT}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-1"
            style={{ backgroundColor: COLORS.elevated, color: COLORS.text, border: `1px solid ${COLORS.border}` }}
          />
          <p className="text-xs mb-3" style={{ color: COLORS.textFaint }}>Déjalo vacío para usar el modelo por defecto (Haiku, más barato). Puedes poner otro id si quieres más precisión.</p>
          <div className="flex gap-2">
            <button onClick={() => onSaveOcrSettings({ apiKey: keyDraft.trim(), model: modelDraft.trim() })} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.accent, color: COLORS.bg }}>Guardar</button>
            {savedKey && (
              <button onClick={() => { setKeyDraft(''); setModelDraft(''); onSaveOcrSettings({ apiKey: '', model: '' }); }} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.elevated, color: COLORS.text }}>Quitar</button>
            )}
          </div>
        </div>

        {!confirmingReset ? (
          <button onClick={() => setConfirmingReset(true)} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: COLORS.expenseSoft, color: COLORS.expense }}>Borrar todos los movimientos</button>
        ) : (
          <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.expenseSoft }}>
            <p className="text-sm font-medium mb-2" style={{ color: COLORS.expense }}>¿Seguro? Se borrarán todos tus movimientos (tus cuentas se quedan).</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingReset(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: COLORS.surfaceAlt, color: COLORS.text }}>Cancelar</button>
              <button onClick={() => { onResetTransactions(); setConfirmingReset(false); onClose(); }} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ backgroundColor: COLORS.expense, color: COLORS.bg }}>Sí, borrar</button>
            </div>
          </div>
        )}
      </div>
    </SheetOverlay>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop shell                                                       */
/* ------------------------------------------------------------------ */
/* Layout raíz de escritorio: sidebar fijo + área principal ancha, montado por
   App cuando useIsDesktop() es true, en vez del árbol móvil (max-w-md +
   BottomNav). Recibe el mismo estado/handlers que App ya pasa al árbol móvil
   — ver el bloque `if (isDesktop)` en App más abajo. */

function DesktopShell(props) {
  const {
    activeTab, setActiveTab,
    onOpenAddSheet, onOpenSettings,
    settingsOpen, onCloseSettings, onResetTransactions,
    onOpenImport, onOpenSync, onOpenBackup,
    onOpenReceipt, ocrSettings, onSaveOcrSettings,
    toast,
  } = props;

  const tabTitles = { home: 'Inicio', history: 'Historial', msi: 'Compras a meses', accounts: 'Cuentas' };

  return (
    <div className="w-full h-screen flex" style={{ backgroundColor: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
      <GlobalStyles />
      <DesktopSidebar active={activeTab} onChange={setActiveTab} onOpenSettings={onOpenSettings} onAddTransaction={() => onOpenAddSheet('expense')} onScanReceipt={onOpenReceipt} />

      <div className="flex-1 h-full overflow-y-auto hilo-scroll relative">
        <div className="max-w-6xl mx-auto px-10 py-8">
          <h2 className="text-2xl font-semibold font-display mb-6" style={{ color: COLORS.text }}>{tabTitles[activeTab]}</h2>

          {activeTab === 'home' && (
            <HomeContainer desktop />
          )}
          {activeTab === 'history' && (
            <HistoryContainer desktop />
          )}
          {activeTab === 'msi' && <MsiContainer desktop />}
          {activeTab === 'accounts' && <AccountsContainer desktop />}
        </div>

        {toast && <Toast message={toast} desktop />}
      </div>

      <AddTransactionContainer desktop />

      <AccountFormContainer desktop />

      <MsiPlanFormContainer desktop />

      {settingsOpen && (
        <SettingsModal onClose={onCloseSettings} onResetTransactions={onResetTransactions} onOpenImport={onOpenImport} onOpenSync={onOpenSync} onOpenBackup={onOpenBackup} ocrSettings={ocrSettings} onSaveOcrSettings={onSaveOcrSettings} desktop />
      )}

      <MonefyImportContainer desktop />

      <ReceiptScanContainer desktop />

      <SyncContainer desktop />

      <BackupContainer desktop />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                  */
/* ------------------------------------------------------------------ */

/* El default export ya solo monta el store; el árbol vive en `AppBody`.
   El store se construye por montaje (ver src/app/store-context.tsx), así que
   cada render(<App/>) arranca limpio — misma semántica que cuando el estado
   vivía en los 29 useState de este componente. */
export default function App() {
  return (
    <HiloStoreProvider>
      <AppBody />
    </HiloStoreProvider>
  );
}

function AppBody() {
  /* Sin selector: se re-renderiza ante cualquier cambio del store, que es
     exactamente lo que hacía este componente cuando era dueño del estado.
     Los selectores granulares llegan con los containers de cada feature. */
  const {
    loaded,

    /* Navegación entre pestañas. Los filtros del historial y el cursor de mes
       siguen en el store, pero ya solo los lee el container de su feature. */
    activeTab, setActiveTab,

    /* Acciones de los slices de las features ya migradas. Las hojas y vistas se
       montan por container, así que sus campos ya no se leen aquí. */
    openAddSheet, resetTransactions,

    settingsOpen,
    setSettingsOpen,
    setImportModalOpen, setSyncModalOpen, setBackupModalOpen, setReceiptModalOpen,

    ocrSettings, setOcrSettings, toast, setToast,
  } = useHiloStore();

  /* La hidratación y el guardado automático los lleva el Provider
     (src/app/persistence.ts). Aquí solo queda el auto-cierre del toast, que es
     puro asunto de UI. */
  useToastAutoDismiss();

  const isDesktop = useIsDesktop();

  /* Ya no queda un solo dato derivado aquí: los diez `useMemo` originales se
     fueron con sus features. Lo de abajo es lo que todavía no se migra. */

  function openImportModal() {
    setSettingsOpen(false);
    setImportModalOpen(true);
  }

  function openSyncModal() {
    setSettingsOpen(false);
    setSyncModalOpen(true);
  }

  function openBackupModal() {
    setSettingsOpen(false);
    setBackupModalOpen(true);
  }

  function handleSaveOcrSettings(next) {
    const clean = { apiKey: (next.apiKey || '').trim(), model: (next.model || '').trim() };
    setOcrSettings(clean);
    saveOcrSettings(clean).catch(() => setToast('No se pudo guardar la config de escaneo'));
    setToast(clean.apiKey ? 'Config de escaneo guardada' : 'API key eliminada');
  }

  if (!loaded) {
    return (
      <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Cargando…</p>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <DesktopShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAddSheet={openAddSheet}
        onOpenSettings={() => setSettingsOpen(true)}
        settingsOpen={settingsOpen}
        onCloseSettings={() => setSettingsOpen(false)}
        onResetTransactions={resetTransactions}
        onOpenImport={openImportModal}
        onOpenSync={openSyncModal}
        onOpenBackup={openBackupModal}
        onOpenReceipt={() => setReceiptModalOpen(true)}
        ocrSettings={ocrSettings}
        onSaveOcrSettings={handleSaveOcrSettings}
        toast={toast}
      />
    );
  }

  return (
    <div className="w-full h-screen flex justify-center" style={{ backgroundColor: COLORS.bg }}>
      <div className="relative w-full max-w-md h-full flex flex-col overflow-hidden" style={{ backgroundColor: COLORS.bg, fontFamily: "'Inter', sans-serif" }}>
        <GlobalStyles />

        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-semibold font-display leading-tight" style={{ color: COLORS.text }}>Hilo</h1>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>Control de gastos</p>
          </div>
          <button onClick={() => setSettingsOpen(true)} aria-label="Abrir ajustes" className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: COLORS.surfaceAlt }}>
            <Settings size={16} style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto hilo-scroll px-5 pb-24">
          {activeTab === 'home' && (
            <HomeContainer />
          )}
          {activeTab === 'history' && (
            <HistoryContainer />
          )}
          {activeTab === 'msi' && <MsiContainer />}
          {activeTab === 'accounts' && <AccountsContainer />}
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

        <AddTransactionContainer />

        <AccountFormContainer />

        <MsiPlanFormContainer />

        {settingsOpen && (
          <SettingsModal onClose={() => setSettingsOpen(false)} onResetTransactions={resetTransactions} onOpenImport={openImportModal} onOpenSync={openSyncModal} onOpenBackup={openBackupModal} ocrSettings={ocrSettings} onSaveOcrSettings={handleSaveOcrSettings} />
        )}

        <MonefyImportContainer />

        <ReceiptScanContainer />

        <SyncContainer />

        <BackupContainer />

        {toast && <Toast message={toast} />}
      </div>
    </div>
  );
}
