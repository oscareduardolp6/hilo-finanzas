# Plan: cuentas completas — desglose de un movimiento en renglones y descuentos

Implementa [tasks/cuentas-completas-tickets.md](../../tasks/cuentas-completas-tickets.md). **Estado: implementado** (ver "Desviaciones respecto al plan original" al final).

> Este plan es una foto del enfoque al momento de escribirlo. Si la implementación se desvía, o un cambio posterior toca el código que describe, **actualiza este archivo en el mismo cambio** (ver "Keeping specs and plans in sync with the code" en CLAUDE.md).

## Context

Hoy un ticket de restaurante o súper se registra como un solo gasto sin detalle, o (vía OCR) como N movimientos sueltos más un `income` en "Descuentos". El usuario quiere:

- Registrar **un** movimiento ("El Sato, $5,000") y, opcionalmente, desglosarlo en renglones (Nigiris $1,000, Bebidas $2,000…), con cantidad, precio unitario y total por renglón.
- Que en el historial se vea **una sola fila**, y al abrirla, el desglose completo.
- Registrar descuentos (Amex en Starbucks) como **renglón propio del desglose**: el dinero que se mueve entre cuentas es lo realmente pagado ($174), el desglose muestra $200 de consumo y −$26 de descuento, y ese descuento cuenta como **ahorro** (no ingreso, no toca saldo), ligable a un `BenefitProgram`.
- Que cada renglón tenga su propia categoría (por defecto, la del movimiento) para separar p. ej. lo que se invitó a un amigo ("Regalos") de lo propio ("Restaurantes").

Decisiones confirmadas con el usuario:

1. **Un movimiento con desglose adentro**, no un ticket + N transacciones. Sin colección nueva: el desglose es un campo opcional del movimiento.
2. **El total (`amount`) es la fuente de la verdad.** Los renglones son opt-in ("no todo tiene desglose"). Lo no desglosado aparece automáticamente como renglón **"Sin especificar"** en la categoría del movimiento, y baja conforme se agregan renglones. Siempre cuadra: `amount = Σ renglones + sin especificar − Σ descuentos`, con `sin especificar ≥ 0`.
3. **Descuentos = renglón propio, no prorrateado.** Tiene concepto, monto, programa de beneficio opcional y categoría (por defecto la del movimiento). En totales por categoría Café suma $174 ($200 del renglón − $26 del descuento).
4. **OCR fuera de esta iteración.** Se crea una tarea nueva para que el escaneo genere este movimiento desglosado, incluyendo subir tickets largos en **varias fotos/páginas** (el modelo deduplica renglones repetidos).

Fuera de esta iteración (quedan anotados en la tarea): seguimiento de precios por producto, agrupar a posteriori movimientos viejos en un ticket, guardar la foto del ticket.

## Diseño

### Modelo de datos ([src/shared/domain/types.ts](../../src/shared/domain/types.ts))

Campo nuevo, **opcional**, en `ExpenseTransaction` y `TransferTransaction`:

```ts
breakdown?: TransactionBreakdown | null;   // ausente/null = sin desglose

type TransactionBreakdown = { items: BreakdownItem[]; discounts: BreakdownDiscount[] };

type BreakdownItem = {
  id: string;
  description: string;
  amount: number;              // total del renglón (precio de lista)
  quantity: number | null;
  unitPrice: number | null;
  categoryId: string | null;   // null = hereda la del movimiento
  size: string | null;
  brand: string | null;
};

type BreakdownDiscount = {
  id: string;
  label: string;
  amount: number;              // positivo; se resta
  categoryId: string | null;   // null = hereda la del movimiento
  benefitProgramId: string | null;
};
```

- "Sin especificar" **no se guarda**: se deriva (`amount − Σitems + Σdiscounts`), igual que el saldo o el avance MSI.
- `categoryId: null` = hereda. Así, cambiar la categoría del movimiento arrastra a todos los renglones que no se cambiaron a mano.
- **Compatibilidad:** campo nuevo y opcional; los movimientos viejos no lo tienen y todo lo que lo lee usa `?.`. No cambia el significado de ningún campo existente. No hace falta tocar `export-payload.ts`, `replaceDataState` ni la persistencia: el campo viaja dentro de `transactions`.
- **Balance y gasto total del mes no cambian**: `computeAccountBalance` y `computeTotalExpense` siguen usando `amount` (lo pagado).
- Aplica a gasto simple y a transferencia marcada como gasto, **no** en modo pago de MSI (`toTransaction` lo fuerza a `null` si hay `installmentPlanId`).

### Dominio nuevo: `src/features/transactions/domain/breakdown.ts`

Puro, sin `Deps`. Lo consumen otras features por su `domain/` (permitido por la regla 1).

- `computeBreakdownSummary(amount, breakdown)` → `{ itemsTotal, discountsTotal, unspecified, subtotal, isBalanced }`. `isBalanced = unspecified ≥ −0.005`.
- `computeCategoryPortions(txn)` → `Array<{ categoryId, amount }>` con signo. Sin desglose: `[{ parent, amount }]` (el comportamiento de hoy). Con desglose: cada renglón suma a su categoría (o la del padre), "sin especificar" suma al padre, cada descuento resta de la suya. Solo para `expense` y `transfer` con `taggedAsExpense`; el resto devuelve `[]`.
- `computeTransactionSavings(txn)` → Σ descuentos del desglose (0 si no hay). Este y `getBreakdown(txn)` (lectura laxa del campo) viven en realidad en `src/shared/domain/breakdown.ts` y el módulo de la feature los re-exporta: `TransactionRow` es de `shared/ui` y no puede importar de una feature.
- `breakdownSearchText(txn)` → descripciones de renglones y conceptos de descuentos, para el buscador.
- Borrador (strings, como el resto del form): `BreakdownDraft`, `breakdownToDraft(b)`, `draftToBreakdown(d)` (parsea números, recorta strings, `''`→`null`), y `patchItemDraft(item, field, value)`: si hay cantidad y precio unitario, editar cualquiera de los dos recalcula el total; editar el total con cantidad presente recalcula el unitario.

### Formulario y casos de uso (feature `transactions`)

- [form.ts](../../src/features/transactions/domain/form.ts): `TransactionFormDraft.breakdown?: BreakdownDraft | null`.
- [to-transaction.ts](../../src/features/transactions/domain/to-transaction.ts): expense y transfer-gasto escriben `breakdown: draftToBreakdown(...)` o `null` (MSI, o transferencia sin tag). Siempre se escribe la clave (aunque sea `null`) para que al editar `{ ...t, ...fields }` quitar el desglose sí lo borre — mismo patrón que `installmentPlanId: null`.
- Slice ([transactions-slice.ts](../../src/features/transactions/store/transactions-slice.ts)):
  - `openEditSheet` siembra `breakdown: breakdownToDraft(txn.breakdown)`.
  - Acción nueva `addBreakdownLine(kind: 'item' | 'discount')`: corre el `ReaderIO` `appendBreakdownLine` (`application/breakdown-lines.ts`) que pone el id con `deps.idGenerator` (`bitem_…` / `bdisc_…`) — así el id no se genera en el render (mismo motivo que `createCategory`). Quitar un renglón o editarlo es solo `setForm`.
- Validación (en `AddTransactionSheet.isValid`, usando `computeBreakdownSummary`): con desglose activo, cada renglón y descuento necesita monto > 0 y el resumen debe cuadrar (sin especificar ≥ 0). Si no cuadra, aviso inline ("Los renglones suman más que el total") y botón deshabilitado.

### UI

- **`AddTransactionSheet`** (la "vista de detalle" es esta misma hoja al abrir un movimiento, como hoy):
  - Toggle **"Desglosar ticket"** (mismo estilo que "Vincular a un plan de MSI"), visible en gasto simple y en transferencia marcada como gasto en modo "Gasto único".
  - Al activarlo: lista de renglones (concepto, cantidad, precio unitario, total, categoría con `CategoryPicker` compacto, tamaño/marca), botón "Agregar concepto"; lista de descuentos (concepto, monto, categoría, `BenefitProgramPicker`), botón "Agregar descuento"; renglón automático **"Sin especificar"** (solo lectura, oculto si es 0); resumen *Subtotal · Descuentos · Total pagado*. Cada renglón con botón de quitar.
  - Con desglose activo se ocultan tamaño/marca/cantidad del movimiento (viven en los renglones); sus valores guardados no se borran.
  - Componente nuevo de renderizado `BreakdownEditor` en `src/features/transactions/ui/components/` (props → JSX) para no inflar más la hoja. Cada renglón es una tarjeta plegable (una abierta a la vez; la recién agregada se abre sola). La categoría se elige con una fila de chips horizontal ("Como el movimiento (X)" + las de gasto) que se desplaza sola hasta el chip elegido; el programa del descuento, con `BenefitProgramPicker` (con alta inline).
  - Cambiar a modo MSI (en gasto o en transferencia) limpia el desglose del borrador.
- **`TransactionRow`** ([shared/ui/transaction-row.tsx](../../src/shared/ui/transaction-row.tsx)): si hay desglose, línea extra `Desglose · N conceptos` (solo `Desglose` si no hay conceptos, p. ej. un ticket con solo un descuento) y, si hay descuentos, `· Ahorro $26` (respeta `hideBalances`). Sigue compacta: el detalle solo al abrir. Lo pintan Inicio e historial, móvil y escritorio, sin cambios en esas vistas.
- Escritorio: la hoja ya se centra como modal con `desktop`; el editor es el mismo componente.

### Cálculos que cambian

- [dashboard/domain/totals.ts](../../src/features/dashboard/domain/totals.ts) `computeCategoryTotals`: suma por `computeCategoryPortions` en vez de por `categoryId` del movimiento. Excluye totales negativos (solo posibles con descuentos asignados a otra categoría) para no romper la dona. Sin desglose da exactamente lo de hoy.
- [history/domain/filters.ts](../../src/features/history/domain/filters.ts): el filtro por categoría acepta el movimiento si **alguna** porción cae en esa categoría (así "Regalos" encuentra la cena con un renglón de regalo); la búsqueda incluye `breakdownSearchText`.
- [benefits/domain/totals.ts](../../src/features/benefits/domain/totals.ts) `computeBenefitTotals`: además de los `income` con `benefitProgramId`, suma los descuentos del desglose con `benefitProgramId`. El modal ya habla de "Resumen de ahorro"; se ajusta el texto vacío para mencionar los descuentos.

### Tarea nueva

`tasks/ocr-ticket-desglosado.md` (pendiente, prioridad 2): que el escaneo cree un movimiento con desglose en vez de N movimientos + `income` en Descuentos; subir un ticket largo en varias fotos y que el modelo deduplique renglones repetidos entre páginas; qué hacer con la opción actual de mandar renglones a cuentas distintas. Fila nueva en `tasks/README.md`.

## Archivos tocados

- `src/shared/domain/types.ts` — tipos del desglose.
- `src/features/transactions/domain/breakdown.ts` (+ `breakdown.test.ts`) — nuevo.
- `src/features/transactions/domain/form.ts`, `to-transaction.ts` (+ su test).
- `src/features/transactions/application/breakdown-lines.ts` — nuevo.
- `src/shared/domain/breakdown.ts` — nuevo (`getBreakdown`, `computeTransactionSavings`).
- `src/features/transactions/store/transactions-slice.ts`.
- `src/features/transactions/ui/components/AddTransactionSheet.tsx`, `BreakdownEditor.tsx` (nuevo), `ui/containers/AddTransactionContainer.tsx`, `ui/add-transaction.test.tsx`.
- `src/shared/ui/transaction-row.tsx`.
- `src/features/dashboard/domain/totals.ts` (+ test), `src/features/history/domain/filters.ts` (+ test), `src/features/benefits/domain/totals.ts` (+ test), `src/features/benefits/ui/components/BenefitsModal.tsx` (texto).
- `CLAUDE.md` — `breakdown` en la descripción de `expense`/`transfer`, y en `benefitProgramId`/beneficios.
- `agents/plans/cuentas-completas-tickets.md` (este plan), `tasks/cuentas-completas-tickets.md` (status + sección "Estado" con lo diferido), `tasks/ocr-ticket-desglosado.md` (nueva), `tasks/README.md`.

## Verificación

- `npm test`: los 190 de regresión pasan **sin editarse** (prueba de que un movimiento sin desglose se comporta igual). Tests nuevos:
  - `breakdown.test.ts`: El Sato ($5,000; Nigiris 1,000; Bebidas 2,000 → sin especificar 2,000); Starbucks ($174; Café 200; descuento 26 Amex → sin especificar 0, Café = 174); renglón en "Regalos" separa porciones; renglones que exceden el total → no cuadra; `patchItemDraft` recalcula total/unitario.
  - Los casos de `toTransaction` (MSI y transferencia sin tag fuerzan `breakdown: null`; sin desglose se escribe `null` explícito) quedaron en `breakdown.test.ts`, no en `to-transaction.test.ts`.
  - dashboard/history/benefits: porciones por categoría, filtro por categoría de renglón, búsqueda por concepto, ahorro ligado a programa.
  - `add-transaction.test.tsx` (`renderFeature`): activar desglose, agregar concepto y descuento, ver "Sin especificar" actualizarse, botón deshabilitado si no cuadra, guardar y reabrir conserva el desglose.
- `npm run typecheck`.
- `npm run dev` en el navegador del panel (móvil y ≥1024px): capturar El Sato y Starbucks; confirmar una sola fila en historial con "Desglose · N conceptos" / "Ahorro"; saldo de cuentas movido solo por el total; dona de Inicio repartida por categoría de renglón; Beneficios muestra los $26 de Amex; un gasto sin desglose ("Churrumaiz") se ve y guarda igual que antes; `hideBalances` oculta el ahorro.

## Desviaciones respecto al plan original

- Una sola acción `addBreakdownLine(kind)` en vez de `addBreakdownItem`/`addBreakdownDiscount`.
- `getBreakdown`/`computeTransactionSavings` en `src/shared/domain/breakdown.ts` (regla de dependencias: `shared/ui` no importa de `features/`).
- La dona (`computeCategoryTotals`) excluye solo las categorías que algún desglose dejó en cero o negativas; una categoría sin desglose se comporta exactamente como antes, aunque sume 0.
- Al escribir `breakdown: null` en todo gasto/transferencia nuevo, el único test que cambió fue el de `add-transaction.test.tsx` que compara el movimiento guardado con `toEqual` (es de la suite nueva, no de la de regresión, que pasó sin editarse).
- Verificado en el navegador en modo local (sin sesión, con un `.env.local` de relleno solo para levantar Firebase): El Sato (desglose parcial + renglón en Regalos), Starbucks (transferencia marcada como gasto con descuento ligado a un programa), búsqueda por concepto, persistencia tras recargar, vista de escritorio y modo privado.
