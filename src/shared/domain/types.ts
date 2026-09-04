/* El modelo de datos de Hilo. Ver la sección "Domain model" de CLAUDE.md.

   Regla de compatibilidad hacia atrás (CLAUDE.md, "Backward compatibility with
   saved data"): hay usuarios con datos ya guardados en su IndexedDB y no hay
   backend que los migre. Todo campo agregado después del primer release va
   OPCIONAL — `updatedAt` cae a `createdAt`, los campos de producto pueden no
   existir — y ningún tipo de aquí puede volverse más estricto de lo que la
   versión que escribió esos datos garantizaba. */

export type AccountTypeId = 'efectivo' | 'debito' | 'credito' | 'ahorro' | 'inversion' | 'otro';

/** Marcas de tiempo que llevan las cuatro colecciones sincronizables.
 *  `updatedAt` no existe en registros previos al sync de dispositivos. */
export type Stamped = {
  createdAt?: number;
  updatedAt?: number;
};

export type Account = Stamped & {
  id: string;
  name: string;
  type: AccountTypeId;
  color: string;
  /** El saldo NUNCA se guarda: se deriva plegando los movimientos. */
  initialBalance: number;
};

export type CategoryType = 'expense' | 'income';

export type Category = Stamped & {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
};

export type TransactionType = 'expense' | 'income' | 'transfer';

/** Metadatos opcionales de producto; agregados después, pueden faltar. */
export type ProductDetails = {
  size?: string | null;
  brand?: string | null;
  quantity?: string | null;
};

type TransactionBase = Stamped & {
  id: string;
  /** ISO `YYYY-MM-DD`; las vistas por mes hacen prefix match sobre esto. */
  date: string;
  amount: number;
  description: string;
};

export type ExpenseTransaction = TransactionBase & ProductDetails & {
  type: 'expense';
  accountId: string;
  categoryId: string;
  store?: string | null;
  /** Un gasto simple también puede abonar a un plan MSI. */
  installmentPlanId?: string | null;
};

export type IncomeTransaction = TransactionBase & {
  type: 'income';
  accountId: string;
  categoryId: string;
};

export type TransferTransaction = TransactionBase & ProductDetails & {
  type: 'transfer';
  fromAccountId: string;
  toAccountId: string;
  /** El concepto clave del dominio: cuenta para gasto por categoría SIN volver a
   *  restar del saldo total (el dinero ya salió como transferencia). */
  taggedAsExpense: boolean;
  categoryId?: string | null;
  installmentPlanId?: string | null;
  store?: string | null;
};

export type Transaction = ExpenseTransaction | IncomeTransaction | TransferTransaction;

/** "Meses sin intereses". No guarda progreso: se deriva sumando los abonos. */
export type InstallmentPlan = Stamped & {
  id: string;
  description: string;
  store?: string | null;
  totalAmount: number;
  /** `parseFloat`, no `parseInt`: admite fracciones (1.5 = pagar en quincenas). */
  installmentsCount: number;
  categoryId?: string | null;
  startDate: string;
};

/** Lápida de borrado, para que un merge posterior propague la eliminación. */
export type Tombstone = {
  id: string;
  deletedAt: number;
};

/** Las cinco colecciones que viven bajo `STORAGE_KEY`, y solo esas. */
export type DataState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  installmentPlans: InstallmentPlan[];
  tombstones: Tombstone[];
};

/* --- Estado local del dispositivo: clave propia, NUNCA dentro de DataState --- */

export type OcrSettings = {
  apiKey: string;
  model: string;
};

export type SyncPeer = {
  name?: string;
  /** Hasta aquí YO le mandé mis datos (gobierna el delta; avanza manualmente). */
  lastSentAt?: number;
  /** Hasta aquí incorporé lo suyo (informativo; avanza solo al recibir). */
  lastReceivedAt?: number;
};

export type SyncState = {
  deviceId: string;
  deviceName: string;
  peers: Record<string, SyncPeer>;
};
