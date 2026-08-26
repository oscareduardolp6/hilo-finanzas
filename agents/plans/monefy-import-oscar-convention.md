# Plan: Convención de Oscar en la importación de Monefy

> Implementa [tasks/monefy-import-oscar-convention.md](../../tasks/monefy-import-oscar-convention.md), una extensión de [tasks/monefy-import.md](../../tasks/monefy-import.md) ya implementada (ver [agents/plans/monefy-import.md](../../agents/plans/monefy-import.md)). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

El importador de Monefy ([agents/plans/monefy-import.md](../../agents/plans/monefy-import.md)) ya funciona, pero importa la `description` de Monefy tal cual, sin aprovechar dos convenciones personales que Oscar usaba ahí. Analicé su CSV real (`Monefy.Data.25-8-2026.csv`) para entenderlas con datos reales, no solo con su descripción:

**1. Fracciones de progreso `(N/D)`** — 271 series distintas (cuenta + descripción base), hasta 23 pagos en una sola serie. Ejemplo: `Televisión (0.5/12) - Mercado Libre` en Bancomer, repetido con `1/12`, `1.5/12`, etc. Hallazgos clave:
   - El 93% de las series (185 de 271, solo contando gasto) son de **una sola cuenta** — no hay una segunda cuenta "colchón"/tarjeta involucrada como en una transferencia real. Monefy simplemente registra el pago como un gasto normal con una nota de progreso en el texto.
   - Una minoría (~19 series) sí tienen una fila espejo en otra cuenta (categoría "Apartados" u otra) el mismo día — esos casos ya están cubiertos por el import normal como movimientos independientes; esta feature no intenta re-fusionarlos en una transferencia (fuera de alcance, ver Límites abajo).
   - El denominador puede cambiar para la misma descripción+cuenta (ej. "Ropa" en Bancomer tiene una serie `/7` en 2023-2024 y otra `/3` en 2025 — son dos compras distintas que reusan el mismo nombre genérico).
   - Salto directo al denominador (ej. `2/6` → `6/6`) = liquidación anticipada del saldo restante.

**2. Campos separados por guion** `item - lugar - tamaño - marca - cantidad` — confirmé la distribución real: 2146 filas con 2 segmentos (item - lugar), 984 con 3, 485 con 4, 251 con los 5 completos. Es independiente de la fracción: aparece tanto en compras a meses como en gastos normales de súper.

**Decisiones confirmadas con el usuario:**

1. Para que las series de una sola cuenta (93% de los casos) generen un plan MSI real con progreso, **se extiende el modelo de Hilo**: un `expense` normal ahora puede llevar `installmentPlanId` (hoy solo lo tienen los `transfer`). Es una mejora genuina al feature de MSI de Hilo, disponible también para uso manual, no solo para esta importación.
2. Tamaño/marca/cantidad se agregan como **campos nuevos y opcionales** (`size`, `brand`, `quantity`) en el modelo de `expense` — no se aplastan en `description`/`store`.
3. Estos campos tienen **soporte completo en la UI**: editables a mano en `AddTransactionSheet` para cualquier gasto nuevo o existente, pero solo visibles al abrir/editar el movimiento — la fila compacta de Historial no cambia.
4. Todo esto va detrás de un **checkbox opcional** ("Convención de Oscar") en el wizard de importación, prendido por default pero desactivable — no es comportamiento genérico de Monefy.

## Diseño

### 1. Modelo de datos (`expense`) y MSI — cambios permanentes, no solo de importación

- `expense`: agrega `installmentPlanId` (string|null, default null) y campos opcionales `size`, `brand`, `quantity` (strings|null).
- `planProgress` en `App` ([hilo-finanzas.jsx:2419-2431](../../hilo-finanzas.jsx)) — el filtro `t.type === 'transfer' && t.installmentPlanId === p.id` pasa a `(t.type === 'transfer' || t.type === 'expense') && t.installmentPlanId === p.id`. El resto de la fórmula (paid/per/pct/isPaidOff) no cambia.
- `TransactionRow` ([hilo-finanzas.jsx:907-966](../../hilo-finanzas.jsx)) — la rama de `expense` (hoy sin badge de MSI) gana el mismo bloque "MSI · {plan.description}" que ya existe en la rama de `transfer` (líneas 935-940), usando `txn.installmentPlanId`.
- `AddTransactionSheet` ([hilo-finanzas.jsx:1525](../../hilo-finanzas.jsx)):
  - Para `formType === 'expense'`, se agrega un toggle "Vincular a un plan de MSI" (mismo patrón visual que "Marcar como gasto" del flujo de transferencia, ícono `Layers`) que al activarse muestra `InstallmentPlanPicker` (mismo componente que ya usa el flujo de transferencia) y fija `form.installmentPlanId` + `categoryId` al seleccionar/crear un plan.
  - El estado local `expenseMode` (ya existe, líneas 1526-1527) se reutiliza para ambos flujos (transfer-msi y expense-msi, nunca activos a la vez porque son formTypes distintos). Se agrega un `useEffect` que resetea `expenseMode` a `form?.installmentPlanId ? 'msi' : 'single'` cuando cambia `formType`, para que no quede "pegado" en `'msi'` al cambiar de pestaña.
  - `isValid` gana: si `formType === 'expense' && expenseMode === 'msi'`, requiere `form.installmentPlanId`.
  - Debajo del `StoreInput` (línea ~1715), para `formType === 'expense'` se agrega una fila de 3 inputs opcionales (grid-cols-3): Tamaño, Marca, Cantidad — mismo estilo que los demás inputs del form.
- `initialFormState` ([hilo-finanzas.jsx:224-236](../../hilo-finanzas.jsx)) — la rama `expense` agrega `installmentPlanId: null, size: '', brand: '', quantity: ''`.
- `handleSaveTransaction` ([hilo-finanzas.jsx:2463-2493](../../hilo-finanzas.jsx)) — la rama `expense` agrega `installmentPlanId: payload.installmentPlanId || null, size: (payload.size||'').trim() || null, brand: (payload.brand||'').trim() || null, quantity: (payload.quantity||'').trim() || null`.
- `CLAUDE.md` — actualizar la línea del modelo de `expense` y la de "Installment plans / MSI" (que hoy dice "sumando cada transacción `transfer`") para reflejar que también cuentan los `expense`.

### 2. Parsing de la convención de Oscar (helpers nuevos, junto a los de `monefy-import.md`)

```js
const OSCAR_FRACTION_RE = /[(\[]\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+)\s*[)\]]/;

function parseOscarDescription(raw) {
  const m = raw.match(OSCAR_FRACTION_RE);
  let base, rest, numerator = null, denominator = null;
  if (m) {
    base = raw.slice(0, m.index).trim();
    rest = raw.slice(m.index + m[0].length).replace(/^[\s-]+/, '').trim();
    numerator = parseFloat(m[1]);
    denominator = parseInt(m[2], 10);
  } else {
    const parts = raw.split(' - ');
    base = parts[0].trim();
    rest = parts.slice(1).join(' - ').trim();
  }
  const [store, size, brand, quantity] = rest ? rest.split(' - ').map(s => s.trim()).filter(Boolean) : [];
  return { description: base || raw.trim(), store: store || '', size: size || '', brand: brand || '', quantity: quantity || '', numerator, denominator };
}
```

Esta única función cubre ambos casos (con y sin fracción) porque cuando hay fracción, todo lo que sigue al `(N/D)` ya viene separado por guion (`- lugar - tamaño - marca - cantidad`); cuando no hay fracción, el string completo sigue el mismo patrón `item - lugar - ...`.

### 3. Integración en el pipeline de importación existente

En `buildMonefyImportPreview` ([hilo-finanzas.jsx](../../hilo-finanzas.jsx), función agregada por `monefy-import.md`), para cada fila que hoy termina en el bucket `plain`:

- Se le agrega siempre `oscarParsed: parseOscarDescription(row.description)` (barato, no cambia el conteo de cuentas/transacciones ya calculado).
- Si `oscarParsed.numerator != null` y la fila es de tipo `expense` (monto negativo), se agrega a un `Map` de series con clave `` `${accountName}||${oscarParsed.description.toLowerCase()}||${oscarParsed.denominator}` `` (incluir el denominador en la clave separa automáticamente casos como "Ropa" con `/7` vs `/3`).
- Al terminar, por cada serie se calcula (ordenando sus filas por fecha, con el índice original de fila como desempate):
  - `installmentsCount` = denominador de la clave.
  - `categoryName` = categoría más frecuente dentro de la serie (moda).
  - `store` = primer `oscarParsed.store` no vacío de la serie.
  - `paidSoFar` = suma de montos absolutos de la serie; `finalNumerator` = numerador de la última fila (por fecha).
  - `totalAmount = finalNumerator > 0 ? paidSoFar * installmentsCount / finalNumerator : paidSoFar` — esta fórmula, pedida explícitamente, hace que un salto directo a `N/N` (liquidación anticipada) resuelva `totalAmount = paidSoFar` exactamente, marcando el plan como pagado.
- El resultado de preview gana: `oscarConvention: { seriesCount, transactionsWithDash, transactionsWithFraction }` — solo para mostrar un resumen informativo en el wizard.

En `buildMonefyImportPlan`, nuevo parámetro `useOscarConvention` (booleano, del checkbox):
- Si `true`: antes de construir transacciones, crea un `installmentPlan` de Hilo por cada serie (usando `categoryIdFor(categoryName, 'expense')`), guardando el id en un mapa `seriesKey → planId`.
- Al construir cada transacción de `skeleton.plain`: si `useOscarConvention` es `true`, usa `row.oscarParsed.description/store` en vez del texto crudo; si el tipo es `expense` agrega `size/brand/quantity` desde `oscarParsed` y `installmentPlanId` (si la fila pertenece a una serie); si `useOscarConvention` es `false`, comportamiento idéntico al actual (sin cambios).

### 4. UI del wizard (`MonefyImportModal`)

En el paso de revisión (`step === 'review'`), justo antes de la lista de cuentas, se agrega un checkbox:

> ☑ Usar la convención de Oscar — reconoce fracciones `(N/6)` como pagos de MSI y separa "item - lugar - tamaño - marca - cantidad". Es específico de tu forma de anotar en Monefy, no una función genérica.

Prendido por default (`useState(true)`). Cuando está activo, el resumen agrega una línea: `"{seriesCount} planes de MSI detectados"`. El botón de confirmar pasa `useOscarConvention` a `buildMonefyImportPlan`, y el resumen final ("done") agrega el conteo de planes MSI creados junto a cuentas/categorías nuevas.

## Límites conocidos (documentar en este plan, no resolver ahora)

- Las ~19 series que sí tienen una fila espejo en otra cuenta el mismo día se importan igual que hoy (dos movimientos independientes); no se intenta reconstruirlas como transferencia con MSI.
- Un reset de numerador dentro de la **misma** clave cuenta+descripción+denominador (ej. "Piano por 3 meses" pasa de `2.5/3` a `0.5/3` sin llegar a `3/3`) se trata como una sola serie continua — pasa en ~10 de 271 series reales, la mayoría por ruido de orden en filas del mismo día, no compras distintas.

## Archivos tocados

- `hilo-finanzas.jsx` — modelo de datos, `planProgress`, `TransactionRow`, `AddTransactionSheet`, `initialFormState`, `handleSaveTransaction`, helpers de parsing (`parseOscarDescription`), extensión de `buildMonefyImportPreview`/`buildMonefyImportPlan`, checkbox en `MonefyImportModal`.
- `CLAUDE.md` — modelo de `expense` e Installment plans/MSI.
- `agents/plans/monefy-import-oscar-convention.md` (este archivo) y `agents/plans/monefy-import.md` (nota breve de que el import ahora acepta `useOscarConvention`).
- `tasks/monefy-import-oscar-convention.md` (status) y `tasks/README.md` (tabla).

## Verificación

Con `npm run dev`:

1. **Feature de MSI para gastos (independiente de la importación)**: crear un gasto nuevo, activar "Vincular a un plan de MSI", crear un plan ahí mismo, guardar. Verificar en Cuentas a meses que el plan aparece con progreso correcto, y que en Historial el gasto muestra el badge "MSI · {descripción}". Editar el mismo gasto y confirmar que tamaño/marca/cantidad se guardan y se re-muestran al reabrir, pero no aparecen en la fila compacta de Historial.
2. **Importación con la convención activada**: armar un CSV de prueba con una serie de una sola cuenta (ej. 3 filas `Silla (0.5/3)`, `Silla (1/3)`, `Silla (3/3)` en la misma cuenta) y verificar que se crea un plan con `totalAmount` igual a la suma pagada (por el salto a `3/3`), `installmentsCount = 3`, y que las 3 transacciones importadas son `expense` con `installmentPlanId` apuntando a ese plan.
3. Probar también una fila con guiones sin fracción (ej. `Leche - HEB - 1L - Lala - 2`) y confirmar que `description` queda "Leche", `store` "HEB", y tamaño/marca/cantidad quedan "1L"/"Lala"/"2".
4. Repetir la importación con el checkbox desactivado y confirmar que el comportamiento es idéntico al de antes de este cambio (texto crudo, sin planes MSI nuevos).
5. Con el CSV real completo, revisar en la app un par de las series largas conocidas (ej. "Silla Escritorio" en Bancomer, 23 pagos) y confirmar que el plan y su progreso se ven razonables.
