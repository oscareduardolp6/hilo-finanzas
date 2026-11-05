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

/** Una categoría tal como la emite el formulario: sin identidad ni marcas de
 *  tiempo, que las pone el caso de uso (es quien tiene reloj y generador). */
export type NewCategory = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;

export type TransactionType = 'expense' | 'income' | 'transfer';

/** Metadatos opcionales de producto; agregados después, pueden faltar. */
export type ProductDetails = {
  size?: string | null;
  brand?: string | null;
  quantity?: string | null;
};

/** Un renglón del desglose de un ticket ("Nigiris $1,000"). `amount` es el
 *  total del renglón a precio de lista. */
export type BreakdownItem = {
  id: string;
  description: string;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  /** `null` = hereda la categoría del movimiento. */
  categoryId: string | null;
  size: string | null;
  brand: string | null;
};

/** Un descuento del desglose (p. ej. la promoción de Amex en Starbucks). Es
 *  AHORRO, no ingreso: no toca ningún saldo, solo resta del gasto de su
 *  categoría. `amount` es positivo. */
export type BreakdownDiscount = {
  id: string;
  label: string;
  amount: number;
  /** `null` = hereda la categoría del movimiento. */
  categoryId: string | null;
  benefitProgramId: string | null;
};

/** El desglose opcional de un movimiento (la "cuenta completa" de un ticket).
 *  El `amount` del movimiento sigue siendo la fuente de la verdad — lo que de
 *  verdad se pagó —; lo no desglosado ("Sin especificar") NO se guarda, se
 *  deriva: `amount − Σ items + Σ discounts`. Ver
 *  `features/transactions/domain/breakdown.ts`. */
export type TransactionBreakdown = {
  items: BreakdownItem[];
  discounts: BreakdownDiscount[];
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
  /** Agregado después: ausente en registros viejos. Nunca junto con MSI. */
  breakdown?: TransactionBreakdown | null;
};

export type IncomeTransaction = TransactionBase & {
  type: 'income';
  accountId: string;
  categoryId: string;
  /* El import de Monefy escribe `store` también en los ingresos (siempre lo
     hizo), así que hay perfiles con ese campo guardado. El tipo tiene que
     decir la verdad sobre el dato aunque ninguna pantalla lo pinte todavía. */
  store?: string | null;
  /** Con qué programa de beneficios (cashback/promoción de tarjeta) se ganó
   *  este ingreso, si aplica. Ver `BenefitProgram`. */
  benefitProgramId?: string | null;
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
  /** Solo con `taggedAsExpense` y sin MSI. Ausente en registros viejos. */
  breakdown?: TransactionBreakdown | null;
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

/** Un plan tal como lo emite el formulario, sin identidad ni marcas de tiempo. */
export type NewInstallmentPlan = Omit<InstallmentPlan, 'id' | 'createdAt' | 'updatedAt'>;

/** El avance de un plan, DERIVADO (nunca se guarda): lo calcula
 *  `features/installments/domain/progress.ts`. El tipo vive aquí y no en la
 *  feature porque lo pintan componentes de `shared/ui` — `MsiPlanCard` y
 *  `InstallmentPlanPicker` —, y `shared/` no puede importar de `features/`. */
export type PlanProgress = {
  paid: number;
  /** Cuánto toca por pago completo. */
  per: number;
  /** Pagado / `per`: puede ser fraccionario (2.5 de 6). */
  installmentsPaid: number;
  remaining: number;
  /** 0–1, ya acotado. */
  pct: number;
  isPaidOff: boolean;
};

/** Un programa de beneficios/recompensas (cashback, promoción de tarjeta,
 *  cupón de comercio): quién lo da y, opcionalmente, con qué tarjeta va.
 *  No guarda cuánto se ha ganado — eso se deriva sumando los `income` que lo
 *  referencian (`IncomeTransaction.benefitProgramId`), igual que un plan MSI
 *  no guarda su avance. Ver `features/benefits/domain/totals.ts`. */
export type BenefitProgram = Stamped & {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** La tarjeta/cuenta a la que pertenece la promoción, si aplica. */
  accountId?: string | null;
};

/** Un programa tal como lo emite el formulario, sin identidad ni marcas de tiempo. */
export type NewBenefitProgram = Omit<BenefitProgram, 'id' | 'createdAt' | 'updatedAt'>;

/** Lápida de borrado, para que un merge posterior propague la eliminación. */
export type Tombstone = {
  id: string;
  deletedAt: number;
};

/** Las seis colecciones que viven bajo `STORAGE_KEY`, y solo esas. */
export type DataState = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  installmentPlans: InstallmentPlan[];
  tombstones: Tombstone[];
  benefitPrograms: BenefitProgram[];
};

/* --- Estado local del dispositivo: clave propia, NUNCA dentro de DataState --- */

export type OcrSettings = {
  apiKey: string;
  model: string;
};
