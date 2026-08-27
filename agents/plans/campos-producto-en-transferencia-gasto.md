# Plan — Campos de producto en transferencias marcadas como gasto

Implementa la tarea [tasks/campos-producto-en-transferencia-gasto.md](../../tasks/campos-producto-en-transferencia-gasto.md).

**Este plan es una foto de la intención al momento de escribirlo. Si el código diverge, actualiza este archivo en el mismo cambio** — un plan desactualizado engaña a quien lo lea después (regla de `CLAUDE.md`).

---

## Context

Los campos de detalle de producto `size` / `brand` / `quantity` (bloque "Tamaño / Marca / Cantidad" en `AddTransactionSheet`) solo existían para `type: 'expense'`. Cuando una transferencia se marca con `taggedAsExpense` —que hace que su monto cuente en los reportes por categoría igual que un gasto— no había forma de anotarle marca, tamaño ni cantidad.

**Decisión confirmada con el usuario:** mostrar el bloque de producto siempre que `formType === 'transfer' && form.taggedAsExpense`, **incluyendo el sub-modo "Pago de MSI"** (no solo "Gasto único"). Diverge a propósito del campo Comercio, que se oculta en MSI.

Se reutilizan los nombres `size` / `brand` / `quantity` para que el único consumidor —el propio `AddTransactionSheet` al editar, que ya lee `form.size` etc. sin ramificar por tipo— funcione sin cambios.

## Diseño

Todo en `hilo-finanzas.jsx`. Tres cambios puntuales:

1. **`initialFormState`, rama `transfer`** (~línea 238): añadir `size: '', brand: '', quantity: ''` al objeto que devuelve, para inputs controlados también en formularios de transferencia nuevos.

2. **Bloque de inputs de producto en `AddTransactionSheet`** (~línea 2046): cambiar la condición de render de `{formType === 'expense' && (` a `{(formType === 'expense' || (formType === 'transfer' && form.taggedAsExpense)) && (`. El grid de 3 inputs no cambia.

3. **`handleSaveTransaction`, rama `transfer`** (~línea 3211): añadir al objeto `txn` (junto a `store`), condicionado a `taggedAsExpense` (sin importar `isMsi`):

   ```js
   size: payload.taggedAsExpense ? ((payload.size || '').trim() || null) : null,
   brand: payload.taggedAsExpense ? ((payload.brand || '').trim() || null) : null,
   quantity: payload.taggedAsExpense ? ((payload.quantity || '').trim() || null) : null,
   ```

   La rama arma `txn` con lista blanca de claves y al editar hace `{ ...t, ...txn }`, así que incluir estas claves con `null` explícito limpia los valores viejos al apagar `taggedAsExpense` y guardar.

### Fuera de alcance / verificado sin cambio

- **Importación de Monefy ("Convención de Oscar"):** los movimientos con campos separados por guion siempre se importan como `type: 'expense'` en `buildMonefyImportPlan` (~líneas 801-806); la rama de `skeleton.transfers` (~líneas 810-819) fija `taggedAsExpense: false` y no toca `oscarParsed`. No existe el camino "dash-fields → transferencia-gasto", nada que arreglar.
- **Fila de Historial / reportes:** `size`/`brand`/`quantity` no se muestran en `TransactionRow` ni en reportes. Sin cambios.

## Archivos tocados

- **`hilo-finanzas.jsx`** — los tres cambios de arriba.
- **`agents/plans/campos-producto-en-transferencia-gasto.md`** — este plan.
- **`tasks/campos-producto-en-transferencia-gasto.md`** — `status`.
- **`tasks/README.md`** — fila de la tabla.
- **`CLAUDE.md`** — la forma de `transfer` en "Domain model" gana `size?`, `brand?`, `quantity?` (solo cuando `taggedAsExpense`).

## Verificación (`npm run dev`)

1. **Móvil (< 1024px), transferencia-gasto único:** Nueva transacción → Transferencia → "Marcar como gasto" → "Gasto único" → aparecen Tamaño / Marca / Cantidad → llenarlos + monto + cuentas + categoría → Guardar → abrir desde Historial → los tres siguen ahí.
2. **Transferencia-gasto MSI:** repetir con sub-modo "Pago de MSI" → los tres campos también aparecen y persisten.
3. **Apagar el tag limpia:** editar una transferencia-gasto con campos → apagar "Marcar como gasto" → inputs desaparecen → Guardar → reabrir → `size`/`brand`/`quantity` en `null`.
4. **Sin regresión:** `expense` sigue mostrando/guardando los tres campos; `income` no muestra el bloque; transferencia sin tag no muestra el bloque y guarda sin errores.
5. **Escritorio (≥ 1024px):** repetir el paso 1 en el modal de `DesktopShell`.
6. **Historial:** la fila compacta no muestra tamaño/marca/cantidad (sin cambio).
