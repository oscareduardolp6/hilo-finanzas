# Plan: Beneficios y promociones de tarjetas

> Implementa [tasks/beneficios-tarjetas.md](../../tasks/beneficios-tarjetas.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

El usuario tiene la TDC Amex y está evaluando sacar otras (Costco, etc.) por sus beneficios. Hoy Hilo no tiene forma de registrar cuánto se gana en programas de recompensas — cashback, puntos, promociones de tarjeta o de comercio — así que decidir si una tarjeta compensa su anualidad es a ojo.

El caso concreto que motiva la tarea: pagar en Starbucks con la promoción de Amex, o usar un cupón de descuento de HEB, capturar cuánto se ahorró ahí, y ver al final del mes o de 6 meses el total ahorrado por promoción/tarjeta para decidir si conviene seguir pagándola.

Decisiones confirmadas con el usuario antes de este plan:

1. **Alcance MVP, no el modelo completo.** Nada de % de cashback, tasa de conversión de puntos, ni topes/vigencia con enforcement — eso queda para una iteración futura (anotado en la tarea). El MVP es: capturar "ahorré $X con este programa", opcionalmente ligado a una transacción, y ver totales por programa y periodo.
2. **Reutilizar el patrón ya existente de "Descuentos".** `ReceiptScanModal` ya registra un descuento como `income` en la categoría semilla `Descuentos` para que el neto cuadre en el balance (ver [src/features/receipt-ocr/domain/to-transactions.ts](../../src/features/receipt-ocr/domain/to-transactions.ts) y [src/shared/domain/defaults.ts](../../src/shared/domain/defaults.ts)). En vez de crear una colección nueva de "capturas", el ahorro de una promoción **es** un `income` (normalmente en esa categoría) — lo que se agrega es la forma de "interceptarlo": un campo opcional que etiqueta ESE ingreso con qué programa lo generó, para poder sumarlo por programa después.
3. **El programa es un catálogo reusable**, no texto libre: una entidad nueva (nombre, ícono, color, opcionalmente ligada a una cuenta/tarjeta), al estilo de `categories` pero con alta/edición/borrado completos como los planes MSI.
4. **El selector de programa aparece en cualquier ingreso**, sin importar la categoría elegida (igual que los campos de producto son opcionales en gasto sin importar la categoría).
5. **Gestión + resumen viven en un modal nuevo desde Ajustes**, con el mismo patrón que `SyncModal`/`BackupModal`.

## Diseño

### Modelo de datos (`src/shared/domain/types.ts`)

- Nuevo tipo `BenefitProgram` (`Stamped`): `{ id, name, icon, color, accountId?: string | null }` — mismo shape que `Category` más el link opcional a cuenta.
- `NewBenefitProgram = Omit<BenefitProgram, 'id' | 'createdAt' | 'updatedAt'>`.
- `IncomeTransaction` gana `benefitProgramId?: string | null` (campo opcional, como manda la regla de compatibilidad hacia atrás del CLAUDE.md — un dato viejo simplemente no lo trae).
- `DataState` gana `benefitPrograms: BenefitProgram[]` — sexta colección persistida, siguiendo el precedente de cómo se agregó `tombstones` como quinta: debe tolerar estar ausente al cargar un blob viejo.

No se modela "tipo de beneficio" (cashback/puntos/promoción) ni tasa de conversión ni topes — eso es justo lo que el MVP deja fuera.

### Persistencia y store (`src/app/store/`)

- `data-slice.ts`: agrega `benefitPrograms: BenefitProgram[]` (default `[]`), `setBenefitPrograms`, entrada en `selectDataState`, y el override tolerante en `hydrateFromRepositories` (`...(data?.benefitPrograms ? { benefitPrograms: data.benefitPrograms } : {})`), igual que las otras 5 colecciones.
- `ui-slice.ts`: agrega `benefitsModalOpen: boolean` y `editingBenefitProgram: BenefitProgram | null` (+ setters), exactamente como `msiModalOpen`/`editingPlan`.
- `index.ts`: agrega `BenefitsSlice` a la unión `HiloStore` y la compone en `createHiloStore`.
- `persistence.ts`: agrega `state.benefitPrograms` al array observado por `subscribePersistence` (junto a las otras 5 colecciones que disparan guardado).

### Sync y backup — compatibilidad hacia atrás

Este es el punto más delicado: un export/backup viejo no trae `benefitPrograms`, y no debe romperse al leerlo. Sigue el patrón exacto de cómo `tombstones` se sumó como colección tolerante (ver comentario en `payload.ts`), NO el de las 4 `SYNC_COLLECTIONS` originales (esas sí exigen `Array.isArray` o tiran error — esa validación estricta no se toca para no cambiar su contrato).

- [src/features/sync/domain/payload.ts](../../src/features/sync/domain/payload.ts):
  - Nueva constante `OPTIONAL_SYNC_COLLECTIONS = ['benefitPrograms'] as const`, documentada como "colecciones añadidas después de la v1, toleran estar ausentes en payloads viejos".
  - `buildExportPayload`: agrega `benefitPrograms: pick<BenefitProgram>(state.benefitPrograms)` al objeto `data`.
  - `normalizeExportPayload`: **no** agrega `benefitPrograms` al loop estricto de `SYNC_COLLECTIONS`; en su lugar, extracción tolerante igual que `tombstones`: `Array.isArray(d['benefitPrograms']) ? d['benefitPrograms'] as BenefitProgram[] : []`.
  - `countPayloadRecords`: suma también `payload.data.benefitPrograms.length`.
- [src/features/sync/domain/merge.ts](../../src/features/sync/domain/merge.ts): `mergeDataState` extiende el loop de `mergeCollection` a `[...SYNC_COLLECTIONS, ...OPTIONAL_SYNC_COLLECTIONS]`, así un programa se funde por `id`/`updatedAt` y respeta lápidas igual que accounts/categories.
- [src/features/backup/domain/replace.ts](../../src/features/backup/domain/replace.ts): `replaceDataState` agrega `benefitPrograms: Array.isArray(incoming.benefitPrograms) ? incoming.benefitPrograms : []`.

**Test legacy que se actualiza a propósito:** `test/unit/sync.test.js`, el test `replaceDataState > 'colecciones ausentes -> []'` hace `expect(out).toEqual({ accounts: [], categories: [], transactions: [], installmentPlans: [], tombstones: [] })` — con la sexta colección esa igualdad exacta deja de cumplirse. Se actualiza el `toEqual` para incluir `benefitPrograms: []`, con una nota de por qué (nueva colección tolerante). Es un cambio de comportamiento deliberado, no un test desactualizado — CLAUDE.md lo permite explícitamente. El resto de `sync.test.js`/`backcompat.test.js`/`persistence.test.js` usa `toMatchObject`/aserciones puntuales sobre campos existentes, no equality total, así que no deberían verse afectados — se confirma corriendo `npm test`.

### Feature nueva: `src/features/benefits/`

Sigue el mismo patrón en capas que `installments` (la feature más parecida: catálogo con CRUD completo + progreso/derivado sin guardar estado).

- `domain/totals.ts` — puro, sin `Deps`:
  ```
  computeBenefitTotals(transactions: Transaction[], programs: BenefitProgram[], sinceIso?: string): Record<programId, number>
  ```
  Filtra `type === 'income' && benefitProgramId` (ignora `null`/ausente), agrupa por `benefitProgramId`, suma `amount`; si `sinceIso` está presente, solo cuenta `date >= sinceIso`. Un programa borrado deja de aparecer en el resumen pero el `income` que lo referenciaba no se toca — mismo criterio que un plan MSI borrado (CLAUDE.md: "borrar el plan no borra sus pagos").
  - Test: `domain/totals.test.ts`.
- `application/save-program.ts` — modelado 1:1 sobre [src/features/installments/application/save-plan.ts](../../src/features/installments/application/save-plan.ts): `createProgram` (ReaderIO, alta inline desde el picker, devuelve el programa creado — mismo motivo que `createCategory`/`createPlan`: quien lo pidió necesita el id para dejarlo seleccionado), `saveProgram` (alta/edición desde el modal de gestión), `deleteProgram` (empuja tombstone, no toca transacciones).
  - Test: `application/save-program.test.ts`.
- `store/benefits-slice.ts` — acciones `createProgram`, `saveProgram`, `deleteProgram`, siguiendo [src/features/installments/store/installments-slice.ts](../../src/features/installments/store/installments-slice.ts) como plantilla (único punto que llama `runRIO` para estas acciones).
- `ui/components/BenefitsModal.tsx` — el modal de Ajustes: lista de programas con alta/edición inline (mismo patrón de `creating`/formulario embebido que [category-picker.tsx](../../src/shared/ui/category-picker.tsx), no un sheet separado tipo `MsiPlanModal`, para mantener el MVP en un solo componente) y, debajo, el resumen: por programa, total ahorrado "este mes" y "últimos 6 meses" (cortes fijos, sin selector de rango — es lo que pidió el usuario).
- `ui/containers/BenefitsContainer.tsx` — lee `benefitPrograms`, `transactions`, `accounts`, `benefitsModalOpen` del store; calcula los dos cortes de fecha (mes actual vía `monthKey`, últimos 6 meses vía `addMonths(new Date(), -6)`, ambos de [src/shared/domain/dates.ts](../../src/shared/domain/dates.ts)) y llama `computeBenefitTotals` dos veces; wire de acciones.
- `ui/benefits.test.tsx` — con `renderFeature` ([src/test/render-feature.tsx](../../src/test/render-feature.tsx)): crear un programa, registrar un ingreso etiquetado con él (vía el picker en `AddTransactionSheet`), abrir el modal de beneficios y verificar que el total aparece.

### Picker compartido: `src/shared/ui/benefit-program-picker.tsx`

Vive en `shared/ui` (no en `features/benefits/ui`) porque lo consume `AddTransactionSheet`, que pertenece a la feature `transactions` — una feature nunca importa el `ui/` de otra (regla 1 de CLAUDE.md). Mismo patrón que [category-picker.tsx](../../src/shared/ui/category-picker.tsx): grid de opciones + alta inline con nombre/ícono/color, agregando un selector de cuenta opcional (lista de `accounts`, con opción "Ninguna") para el link programa↔tarjeta.

### Wiring en el formulario de movimiento (`src/features/transactions/`)

- `domain/form.ts` (`TransactionFormDraft`): agrega `benefitProgramId?: string | null`; en `initialFormState`, rama `income`, lo inicializa en `null`.
- `domain/to-transaction.ts`: en la rama `income` de `toTransaction`, agrega `benefitProgramId: payload.benefitProgramId || null`.
  - Actualiza `to-transaction.test.ts` con el caso.
- `ui/components/AddTransactionSheet.tsx`: nuevas props `benefitPrograms: BenefitProgram[]` y `onCreateBenefitProgram: (input: NewBenefitProgram) => BenefitProgram`. Debajo de "Descripción" (junto a donde hoy van tienda/tamaño/marca/cantidad para gasto), agrega, solo si `formType === 'income'`, la sección "Programa / promoción (opcional)" con `BenefitProgramPicker`.
- `ui/containers/AddTransactionContainer.tsx`: pasa `benefitPrograms` desde el store y `onCreateBenefitProgram` conectado a la acción `createProgram` del slice nuevo.

### Entrada en Ajustes

- [src/features/settings/ui/components/SettingsModal.tsx](../../src/features/settings/ui/components/SettingsModal.tsx): nueva prop `onOpenBenefits: () => void` y un botón "Beneficios y promociones" (icono `Gift` de `lucide-react`, junto a los de sync/backup).
- **Diferencia con lo planeado:** en vez de un handler bespoke `onOpenBenefits={() => setBenefitsModalOpen(true)}`, se extendió el mecanismo genérico que ya existía para las otras hojas de Ajustes — [src/features/settings/store/settings-actions-slice.ts](../../src/features/settings/store/settings-actions-slice.ts): `SettingsTool` gana `'benefits'` y `openFromSettings` pone `benefitsModalOpen: tool === 'benefits'` en el mismo `set` que cierra Ajustes. [SettingsContainer.tsx](../../src/features/settings/ui/containers/SettingsContainer.tsx) conecta `onOpenBenefits={() => openFromSettings('benefits')}`, igual que `import`/`sync`/`backup`. Es más consistente con el patrón ya establecido que una prop aparte.
- [src/app/ui/Shells.tsx](../../src/app/ui/Shells.tsx): agrega `<BenefitsContainer desktop={desktop} />` a `<Sheets/>` (ambos árboles automáticamente, es la lista compartida); el comentario pasó de "las nueve hojas" a "las diez hojas".

### CLAUDE.md

Actualiza la sección "Domain model" (documenta `BenefitProgram` y el campo `benefitProgramId`, siguiendo el estilo de la entrada de `installmentPlans`), "Las diez features" → once, y la lista de colecciones sincronizables/persistidas donde se menciona la quinta (`tombstones`) para incluir la sexta.

## Archivos tocados

- `src/shared/domain/types.ts`
- `src/app/store/data-slice.ts`, `ui-slice.ts`, `index.ts`
- `src/app/persistence.ts`
- `src/features/sync/domain/payload.ts`, `merge.ts`
- `src/features/backup/domain/replace.ts`
- `src/shared/ui/benefit-program-picker.tsx` (nuevo)
- `src/features/benefits/domain/totals.ts` (+ test) (nuevo)
- `src/features/benefits/application/save-program.ts` (+ test) (nuevo)
- `src/features/benefits/store/benefits-slice.ts` (nuevo)
- `src/features/benefits/ui/components/BenefitsModal.tsx` (nuevo)
- `src/features/benefits/ui/containers/BenefitsContainer.tsx` (nuevo)
- `src/features/benefits/ui/benefits.test.tsx` (nuevo)
- `src/features/transactions/domain/form.ts`, `to-transaction.ts` (+ test)
- `src/features/transactions/ui/components/AddTransactionSheet.tsx`, `ui/containers/AddTransactionContainer.tsx`
- `src/features/settings/ui/components/SettingsModal.tsx`, `ui/containers/SettingsContainer.tsx`
- `src/app/ui/Shells.tsx`
- `test/unit/sync.test.js` (actualiza un `toEqual` existente, ver nota arriba)
- `CLAUDE.md`
- `tasks/beneficios-tarjetas.md` (status → en-progreso, luego implementada; se anota que cashback/puntos/topes quedan fuera del MVP)
- `tasks/README.md` (status en la tabla)

## Verificación

1. `npm test` — todos los tests nuevos en verde, y la suite legacy sin regresiones no intencionales (la única esperada es el `toEqual` de `replaceDataState` ya actualizado).
2. `npm run typecheck`.
3. `npm run dev` y, en el navegador:
   - Ajustes → "Beneficios y promociones" → crear el programa "Starbucks x Amex" (con ícono/color, sin cuenta ligada) y "Cupón HEB".
   - Nuevo movimiento → Ingreso → categoría "Descuentos", monto de ejemplo, elegir el programa "Starbucks x Amex" en el picker nuevo → guardar.
   - Reabrir Ajustes → Beneficios: confirmar que el total "este mes" refleja ese ingreso.
   - Editar el movimiento y quitar el programa → confirmar que desaparece del total.
   - Borrar el programa desde el modal → confirmar que el ingreso ya registrado NO se borra (solo deja de sumar al resumen).
   - Repetir un ingreso en un mes anterior (cambiando la fecha) y confirmar que solo cuenta en "últimos 6 meses", no en "este mes".
   - Probar en escritorio (`>= 1024px`) que el modal se centra como los demás modales migrados.
4. Ida y vuelta de sync/backup: exportar (Ajustes → Respaldo o Sincronizar), confirmar que el JSON incluye `benefitPrograms`; y por separado, simular un import de un backup viejo (sin ese campo) y confirmar que no truena y que `benefitPrograms` queda en `[]`.
