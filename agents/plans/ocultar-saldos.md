# Ocultar / mostrar saldos

Implementa [tasks/ocultar-saldos.md](../../tasks/ocultar-saldos.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

Hoy todo saldo y monto de dinero está siempre visible en la UI. La task pide un toggle "modo privado" (ícono de ojo) que reemplace cada monto por un placeholder, para poder tomar una captura o enseñarle la app a alguien sin exponer cifras.

Decisiones confirmadas con el usuario (las 4 dudas abiertas de la task):
- **Alcance**: todo, incluidos los modales secundarios (MSI, Beneficios, escaneo de tickets), no solo las vistas principales.
- **Dona de gastos por categoría**: se oculta el texto/monto (tooltip, texto central, leyenda), pero se conserva la forma/proporción visual de la dona y los porcentajes.
- **Persistencia**: sobrevive a un F5, guardada en IndexedDB bajo su propia clave — mismo patrón que `OCR_SETTINGS_STORAGE_KEY` / `SYNC_STATE_STORAGE_KEY`, fuera del blob principal que viaja en sync/QR/backup (es una preferencia de pantalla del dispositivo, no un dato financiero).
- **Estilo**: placeholder fijo (`$••••`), no blur — más simple y no se puede "quitar" con herramientas sobre una captura.

## Diseño

### 1. `formatMoney` gana un segundo parámetro

[src/shared/domain/money.ts](../../src/shared/domain/money.ts) es la única función de formateo de dinero del repo (35 usos reales en 11 archivos, confirmado por grep — ningún lugar imprime un monto sin pasar por ella). Se le agrega un segundo parámetro opcional:

```ts
export function formatMoney(n: unknown, hidden?: boolean): string {
  if (hidden) return '$••••';
  ...
}
```

Sigue siendo una función pura del dominio — no lee el store, solo recibe el booleano. Cada call site le pasa `hideBalances`. Donde el signo `+`/`-` se antepone fuera de `formatMoney` (p. ej. `transaction-row.tsx`, montos de transacción con signo manual), también se suprime cuando está oculto, para no filtrar ni siquiera la dirección del movimiento:

```tsx
{hideBalances ? '' : (isExpense ? '-' : '+')}{formatMoney(txn.amount, hideBalances)}
```

### 2. `hideBalances` como preferencia persistida fuera del blob principal

Mismo patrón que `ocrSettings`/`syncState` (ver comentario en [indexed-db.ts](../../src/shared/infrastructure/indexed-db.ts) y [settings-slice.ts](../../src/app/store/settings-slice.ts)), pero más liviano: es un booleano suelto, no un objeto, y su fallo al guardar se ignora igual que `persistSyncState` ("es estado local del dispositivo y no hay nada útil que decirle al usuario") — exactamente el mismo razonamiento aplica aquí.

- **`indexed-db.ts`**: nueva clave `HIDE_BALANCES_STORAGE_KEY = 'hilo_hide_balances_v1'`, más `loadHideBalances(): Promise<boolean | null>` y `saveHideBalances(value: boolean): Promise<void>` (usando `getKey`/`putKey` como las demás).
- **`shared/domain/ports.ts`**: nuevo puerto `HideBalancesRepository = { load: TaskEither<HiloError, boolean | null>; save: (value: boolean) => TaskEither<HiloError, void> }`.
- **`shared/infrastructure/repositories.ts`**: `indexedDbHideBalancesRepository` envolviendo las dos funciones de arriba con `attempt`.
- **`shared/infrastructure/in-memory.ts`**: `inMemoryHideBalancesRepository`, mismo patrón que `inMemorySyncStateRepository` (usa `makeRepository`).
- **`app/dependencies.ts`**: se agrega `hideBalancesRepository` a `Deps` y a `productionDeps`.
- **`app/store/settings-slice.ts`**: se agrega el campo `hideBalances: boolean` (inicial `false`) y su setter `setHideBalances` con `makeSetter`, junto a `ocrSettings`/`syncState`.
- **`app/application/hydrate.ts`**: una tercera lectura en paralelo dentro de `sequenceS`, `hideBalances: readOr<boolean>((d) => d.hideBalancesRepository.load, false)`; se agrega al tipo `HydratedState`.
- **`app/store/data-slice.ts`** (`hydrateFromRepositories`): el `set({...})` final incorpora `hideBalances` del resultado de `hydrate`.
- **`app/application/persist.ts`**: nueva `persistHideBalances`, calco de `persistSyncState` (RTE que llama a `deps.hideBalancesRepository.save`).
- **`app/persistence.ts`** (`subscribePersistence`): una tercera suscripción que observa `state.hideBalances` y llama `runRTE(persistHideBalances(...), deps)`, ignorando el error igual que la de `syncState`.
- **`src/test/render-feature.tsx`**: se agrega `hideBalancesRepository: inMemoryHideBalancesRepository()` al `createDeps` por defecto, junto a `ocrSettingsRepository`/`syncStateRepository`.

No se agrega a `SettingsSlice`'s comment/actions-slice de la feature `settings` porque el toggle no vive dentro de `SettingsModal` — vive en el header/sidebar (ver punto 4), así que su setter se llama directo desde `Shells.tsx`, igual que otros toggles simples de un solo campo.

### 3. Propagación a los 11 puntos de UI que muestran dinero

Cada **container** de feature ya lee el store con `useHiloStore` (para pasar `desktop`, acciones, etc.). Se agrega ahí una línea más: `const hideBalances = useHiloStore((s) => s.hideBalances);`, y se pasa como prop nueva al componente de presentación — exactamente el mismo mecanismo de prop-threading ya usado para `desktop` en toda la app. **No** se toca `Shells.tsx` para esto: su comentario de cabecera es explícito en que `ActiveTab`/`Sheets` no reciben props de estado, solo `desktop` — cada container obtiene `hideBalances` del store por sí mismo, no por prop drilling.

Containers y vistas de presentación a tocar (props nuevas: `hideBalances?: boolean`, se reenvía a `formatMoney`):

| Container | Vista(s) de presentación | Dónde se usa el monto |
|---|---|---|
| `features/accounts/.../AccountsContainer.tsx` | `AccountsView` / `AccountsViewDesktop` | saldo por cuenta, saldo total |
| `features/dashboard/.../HomeContainer.tsx` | `HomeView` / `HomeViewDesktop` | saldo total, ingresos, gastos, saldo en carrusel de cuentas, y reenvía a `TransactionRow` + `ExpenseDonut` + `MsiPlanCard` |
| `features/history/.../HistoryContainer.tsx` | `HistoryView` / `HistoryViewDesktop` | reenvía a `TransactionRow` |
| `features/installments/.../MsiContainer.tsx` | `MsiView` / `MsiViewDesktop` | reenvía a `MsiPlanCard` |
| `features/installments/.../MsiPlanFormContainer.tsx` | `MsiPlanModal` | pagado/restante, preview de cuota, monto de abono |
| `features/transactions/.../AddTransactionContainer.tsx` | `AddTransactionSheet` | reenvía a `InstallmentPlanPicker` |
| `features/benefits/.../BenefitsContainer.tsx` | `BenefitsModal` | totales de gasto por programa |
| `features/receipt-ocr/.../ReceiptScanContainer.tsx` | `ReceiptScanModal` | suma de artículos, descuento, neto, total del ticket |

Componentes compartidos (`shared/ui/`) que reciben `hideBalances` como prop nueva desde quien los monta, sin leer el store ellos mismos (siguen siendo presentacionales puros):
- `transaction-row.tsx` (usado por Inicio e Historial)
- `msi-plan-card.tsx` (usado por MSI e Inicio)
- `installment-plan-picker.tsx` (usado por `AddTransactionSheet`)

`ExpenseDonut.tsx`: recibe `hideBalances` y lo usa en los 3 puntos donde imprime `formatMoney` (tooltip, texto central, leyenda), dejando intactos `Cell`/`Pie` (la forma) y los `pct` (los porcentajes) — así se cumple "ocultar solo el texto, no la proporción visual".

### 4. El toggle (ícono de ojo)

**Mobile** — [src/app/ui/Shells.tsx](../../src/app/ui/Shells.tsx), dentro de `MobileShell`, en el header (líneas ~111-119): un tercer botón junto al de Ajustes, mismo tamaño (`w-9 h-9 rounded-full`, `COLORS.surfaceAlt`), con `Eye`/`EyeOff` de `lucide-react` según el estado, y `onClick={() => setHideBalances(!hideBalances)}`. `MobileShell` ya lee el store directo (`activeTab`, `toast`, etc.), así que lee `hideBalances`/`setHideBalances` igual.

**Desktop** — [src/app/ui/DesktopSidebar.tsx](../../src/app/ui/DesktopSidebar.tsx) es presentación pura (props → JSX); gana dos props nuevas (`hideBalances: boolean`, `onToggleHideBalances: () => void`) y un botón adicional junto a "Ajustes" al fondo del sidebar, mismo patrón visual (`flex items-center gap-3 px-3 py-2.5 rounded-xl`). `DesktopShell` en `Shells.tsx` (que ya arma los callbacks `onOpenSettings` etc. leyendo el store) agrega `hideBalances`/`onToggleHideBalances` igual que los demás.

## Archivos tocados

**Nuevos / con cambios de infraestructura y store:**
- `src/shared/infrastructure/indexed-db.ts`, `repositories.ts`, `in-memory.ts`
- `src/shared/domain/ports.ts`, `money.ts`
- `src/app/dependencies.ts`, `application/hydrate.ts`, `application/persist.ts`, `persistence.ts`
- `src/app/store/settings-slice.ts`, `data-slice.ts`
- `src/app/ui/Shells.tsx`, `DesktopSidebar.tsx`
- `src/test/render-feature.tsx`

**Propagación del prop `hideBalances` (contenedor → vista → `formatMoney`):**
- `src/features/accounts/ui/containers/AccountsContainer.tsx` + `AccountsView.tsx` + `AccountsViewDesktop.tsx`
- `src/features/dashboard/ui/containers/HomeContainer.tsx` + `HomeView.tsx` + `HomeViewDesktop.tsx` + `ExpenseDonut.tsx`
- `src/features/history/ui/containers/HistoryContainer.tsx` + `HistoryView.tsx` + `HistoryViewDesktop.tsx`
- `src/features/installments/ui/containers/MsiContainer.tsx` + `MsiView.tsx` + `MsiViewDesktop.tsx`
- `src/features/installments/ui/containers/MsiPlanFormContainer.tsx` + `MsiPlanModal.tsx`
- `src/features/transactions/ui/containers/AddTransactionContainer.tsx` + `AddTransactionSheet.tsx`
- `src/features/benefits/ui/containers/BenefitsContainer.tsx` + `BenefitsModal.tsx`
- `src/features/receipt-ocr/ui/containers/ReceiptScanContainer.tsx` + `ReceiptScanModal.tsx`
- `src/shared/ui/transaction-row.tsx`, `msi-plan-card.tsx`, `installment-plan-picker.tsx`

**Documentación / backlog:**
- `tasks/ocultar-saldos.md` (status → `en-progreso`, luego `implementada`; se resuelven las 4 dudas abiertas con lo decidido arriba)
- `tasks/README.md` (fila de la tabla → "Implementada")
- `agents/plans/ocultar-saldos.md` (este plan, copiado al finalizar la sesión de plan-mode, y mantenido en sync si algo diverge durante la implementación)
- `CLAUDE.md` no necesita cambios: no introduce una colección persistida nueva del blob principal ni una feature nueva de las doce listadas — es una preferencia de dispositivo análoga a `ocrSettings`/`syncState`, ya documentada como patrón.

**Tests nuevos/actualizados** (obligatorio por CLAUDE.md: "cuando cambias comportamiento del producto, agrega o actualiza el test correspondiente"):
- `src/shared/domain/money.test.ts` (nuevo): `formatMoney(n, true)` devuelve el placeholder fijo; `formatMoney(n)`/`formatMoney(n, false)` sin cambios de comportamiento previo.
- Un test de round-trip persistencia para `hideBalances`, junto a los existentes de `syncState`/`ocrSettings` en `src/app/store/store.test.ts` (o `test/unit/persistence.test.js` si ahí es donde viven los de `indexed-db.ts` directamente — se sigue el archivo que ya cubre `SYNC_STATE_STORAGE_KEY`).
- Al menos un test de UI con `renderFeature` (p. ej. en `accounts` o `dashboard`) que confirme: con `hideBalances: true` en el estado inicial del store, el saldo se pinta como `$••••` y no aparece el número real.

## Verificación

1. `npm test` — deben pasar los 190 tests de regresión (sin tocar comportamiento existente cuando `hideBalances` es `false`, su valor por defecto) más los nuevos.
2. `npm run typecheck` — `tsc --noEmit` limpio.
3. `npm run dev`, probar manualmente:
   - Activar el toggle en móvil (header) y en escritorio (≥1024px, sidebar): todo monto en Inicio, Cuentas, Historial, MSI, Beneficios y el modal de escaneo de tickets pasa a `$••••`.
   - La dona de gastos conserva su forma y los porcentajes, pero el tooltip/texto central/leyenda muestran el placeholder.
   - El signo `+`/`-` de las filas de transacción no se ve mientras está oculto.
   - Recargar la página (F5) con el toggle activo: sigue activo (persistencia en IndexedDB confirmada).
   - Desactivar el toggle: todo vuelve a mostrar los montos reales, sin necesidad de recargar.
