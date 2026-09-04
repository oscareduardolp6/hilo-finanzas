/* Datos con los que arranca un perfil nuevo: las categorías y cuentas semilla,
   más los movimientos de ejemplo que hacen que la app no se vea vacía la
   primera vez. Si `loadState()` no encuentra nada, esto es lo que queda — y lo
   que el primer guardado persiste.

   Vive en `shared/domain` (y no en el legacy) porque el store lo necesita como
   estado inicial: importarlo desde el legacy crearía un ciclo, ya que el legacy
   importa el store. */

import { todayIso } from './dates';
import type { Account, Category, InstallmentPlan, Transaction } from './types';

type SeedCategory = Omit<Category, 'type'>;

export const DEFAULT_EXPENSE_CATEGORIES: SeedCategory[] = [
  { id: 'comida', name: 'Comida', icon: 'UtensilsCrossed', color: '#E0793F' },
  { id: 'transporte', name: 'Transporte', icon: 'Car', color: '#4A7FC4' },
  { id: 'vivienda', name: 'Vivienda', icon: 'Home', color: '#8D6E63' },
  { id: 'servicios', name: 'Servicios', icon: 'Zap', color: '#C9A24B' },
  { id: 'salud', name: 'Salud', icon: 'HeartPulse', color: '#C4574F' },
  { id: 'belleza', name: 'Belleza', icon: 'Sparkles', color: '#C97FB0' },
  { id: 'entretenimiento', name: 'Entretenimiento', icon: 'Film', color: '#7B6FB0' },
  { id: 'ropa', name: 'Ropa', icon: 'Shirt', color: '#3F9C8B' },
  { id: 'educacion', name: 'Educación', icon: 'GraduationCap', color: '#5C8A5C' },
  { id: 'mascotas', name: 'Mascotas', icon: 'PawPrint', color: '#A3A15C' },
  { id: 'regalos', name: 'Regalos', icon: 'Gift', color: '#C15C7A' },
  { id: 'compras', name: 'Compras', icon: 'ShoppingBag', color: '#4FA8A0' },
  { id: 'otros_gasto', name: 'Otros', icon: 'MoreHorizontal', color: '#8A9490' },
];

/** `descuentos` es especial: el escaneo de tickets registra ahí cada descuento
 *  como ingreso, para que el usuario pueda totalizar cuánto ha ahorrado. */
export const DEFAULT_INCOME_CATEGORIES: SeedCategory[] = [
  { id: 'salario', name: 'Salario', icon: 'Wallet', color: '#4FA57B' },
  { id: 'freelance', name: 'Freelance', icon: 'Briefcase', color: '#3F9C6E' },
  { id: 'inversion_ingreso', name: 'Inversión', icon: 'TrendingUp', color: '#2E8B6F' },
  { id: 'regalo_ingreso', name: 'Regalo', icon: 'Gift', color: '#C9A24B' },
  { id: 'reembolso', name: 'Reembolso', icon: 'RotateCcw', color: '#4A7FC4' },
  { id: 'descuentos', name: 'Descuentos', icon: 'Ticket', color: '#6FA8A0' },
  { id: 'otros_ingreso', name: 'Otros', icon: 'MoreHorizontal', color: '#8A9490' },
];

export const DEFAULT_CATEGORIES: Category[] = [
  ...DEFAULT_EXPENSE_CATEGORIES.map((c): Category => ({ ...c, type: 'expense' })),
  ...DEFAULT_INCOME_CATEGORIES.map((c): Category => ({ ...c, type: 'income' })),
];

export const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc_efectivo', name: 'Efectivo', type: 'efectivo', color: '#C9A24B', initialBalance: 0 },
  { id: 'acc_nu', name: 'NU', type: 'debito', color: '#8D5FB0', initialBalance: 8000 },
  { id: 'acc_mp', name: 'Mercado Pago', type: 'debito', color: '#3F9C8B', initialBalance: 0 },
];

/** Movimientos de demostración. Cubren a propósito los tres tipos, una
 *  transferencia marcada como gasto y dos abonos desiguales a un plan MSI. */
export function buildDefaultTransactions(): Transaction[] {
  const today = todayIso();
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return [
    { id: 'demo_income', type: 'income', date: firstOfMonth, amount: 12000, description: 'Nómina', accountId: 'acc_nu', categoryId: 'salario', createdAt: Date.now() - 500000 },
    { id: 'demo_expense_food', type: 'expense', date: today, amount: 180, description: 'Tacos', accountId: 'acc_efectivo', categoryId: 'comida', store: null, createdAt: Date.now() - 400000 },
    { id: 'demo_transfer_cash', type: 'transfer', date: today, amount: 800, description: 'Retiro de efectivo', fromAccountId: 'acc_nu', toAccountId: 'acc_efectivo', taggedAsExpense: false, categoryId: null, installmentPlanId: null, store: null, createdAt: Date.now() - 300000 },
    { id: 'demo_transfer_cream', type: 'transfer', date: today, amount: 100, description: 'Crema facial (pagando con TDC)', fromAccountId: 'acc_nu', toAccountId: 'acc_mp', taggedAsExpense: true, categoryId: 'belleza', installmentPlanId: null, store: null, createdAt: Date.now() - 100000 },
    { id: 'demo_transfer_msi1', type: 'transfer', date: today, amount: 150, description: 'Audífonos inalámbricos', fromAccountId: 'acc_nu', toAccountId: 'acc_mp', taggedAsExpense: true, categoryId: 'compras', installmentPlanId: 'demo_msi_audifonos', store: null, createdAt: Date.now() - 50000 },
    { id: 'demo_transfer_msi2', type: 'transfer', date: today, amount: 75, description: 'Audífonos inalámbricos (quincena)', fromAccountId: 'acc_nu', toAccountId: 'acc_mp', taggedAsExpense: true, categoryId: 'compras', installmentPlanId: 'demo_msi_audifonos', store: null, createdAt: Date.now() - 40000 },
  ];
}

export function buildDefaultInstallmentPlans(): InstallmentPlan[] {
  return [
    { id: 'demo_msi_audifonos', description: 'Audífonos inalámbricos', store: 'Walmart', totalAmount: 900, installmentsCount: 6, categoryId: 'compras', startDate: todayIso(), createdAt: Date.now() - 900000 },
  ];
}
