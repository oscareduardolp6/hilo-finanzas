# Plan: Importar historial de Monefy a Hilo

> Implementa [tasks/monefy-import.md](../../tasks/monefy-import.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.
>
> **Extensión**: [tasks/monefy-import-oscar-convention.md](../../tasks/monefy-import-oscar-convention.md) / [agents/plans/monefy-import-oscar-convention.md](monefy-import-oscar-convention.md) agrega un checkbox opcional "Convención de Oscar" a `MonefyImportModal` y un parámetro `useOscarConvention` a `buildMonefyImportPlan`, que reconoce fracciones `(N/D)` y campos separados por guion en la descripción de Monefy.

## Context

Quien migre a Hilo desde Monefy hoy tendría que recapturar todo su historial a mano. El usuario compartió dos archivos reales de su propia cuenta de Monefy para diseñar el importador:

- `monefy_backup_2026_08_25_21_55_44` — el backup nativo de Monefy. Se inspeccionaron sus primeros bytes y es un blob binario sin cabecera reconocible (cifrado/formato propietario para restaurar dentro de la propia app Monefy). **No es viable parsearlo**, así que el importador usa el export en **CSV**.
- `Monefy.Data.25-8-2026.csv` — export real de 18,724 movimientos (dic-2014 a ago-2026), columnas `date,account,category,amount,currency,converted amount,currency,description`. Análisis hecho sobre el archivo real:
  - Fecha `DD/MM/YYYY`; montos con coma de miles (`"2,500"`); todo en MXN; la columna `converted amount` es siempre idéntica a `amount` (se ignora, junto con las dos columnas `currency`).
  - **Transferencias**: Monefy las parte en dos filas — `"To 'CuentaDestino'"` (monto negativo, en la cuenta origen) y `"From 'CuentaOrigen'"` (monto positivo, en la cuenta destino), mismo día y mismo monto absoluto. Hay que reconstruirlas como un solo `transfer` de Hilo.
  - **Saldo inicial**: una sola fila con categoría `"Initial balance 'X'"` → debe ir al `initialBalance` de esa cuenta, no como transacción.
  - El **tipo de categoría** (gasto/ingreso) no viene explícito, pero se infiere por el signo del monto; de 76 categorías reales solo 2 ("Retiros", "Softoise") mezclan signos, y se resuelven creando una categoría de Hilo por cada combinación (nombre, tipo) realmente usada.
  - 44 nombres de cuenta distintos a lo largo de la historia; 3 (`Deuda`, `Pago bus 🚌`, `Tarjeta Santander Débito`) solo aparecen del lado `To`/`From` de una transferencia — cuentas viejas renombradas/cerradas que ya no están en la lista "viva".
  - El CSV no trae tipo de cuenta (efectivo/débito/crédito/ahorro/inversión) — se infiere por heurística de nombre.

Decisiones confirmadas con el usuario (ver conversación):

1. **Fusionar**, no reemplazar: se conservan las cuentas/categorías/transacciones actuales de Hilo; lo importado se agrega, y una cuenta o categoría del CSV que coincida por nombre (y tipo, para categorías) con una que ya existe se reutiliza en vez de duplicarse.
2. **Revisar cuentas antes de importar**: se le muestra al usuario la lista de cuentas detectadas (incluyendo las "fantasma" que solo aparecen en transferencias) con un tipo sugerido, para que confirme, cambie el tipo, o excluya alguna antes de correr la importación.
3. **Todo el historial completo** (sin acotar por fecha) — el volumen (18.7k filas) no representa un problema real de rendimiento para el modelo de cómputo actual de Hilo.
4. **Cuentas fantasma**: se crean también como cuentas normales (editables/eliminables después) para conservar la transferencia completa, salvo que el usuario las excluya explícitamente en la revisión.
5. **Categorías**: se crean automáticamente las que falten (match por nombre+tipo, si no hay match), con un ícono adivinado por palabras clave y color tomado de `CATEGORY_PALETTE`; no hay pantalla de revisión para categorías (a diferencia de cuentas).

Todo el trabajo vive en **[hilo-finanzas.jsx](../../hilo-finanzas.jsx)**, como todo lo demás en Hilo (componente único).

## Diseño

### Helpers nuevos (sección 2, junto a `computeAccountBalance`/`groupByDate`)

- `parseCsv(text)` — parser CSV genérico basado en caracteres (no split naive por línea), maneja comillas, `""` escapado, comas dentro de campos citados y `\r\n`/`\n`. Devuelve `string[][]`. Necesario porque montos como `"2,500"` y descripciones libres pueden traer comas.
- `parseMonefyDate(ddmmyyyy)` → `YYYY-MM-DD` (formato que ya usa Hilo en `date`).
- `parseMonefyAmount(str)` → `number` (quita comas de miles, `parseFloat`).
- `MONEFY_ACCOUNT_TYPE_HINTS` (array de `{ keywords: [...], type: 'efectivo'|'debito'|... }`) + `guessAccountType(name)` — heurística simple por substring (case-insensitive): "efectivo" → efectivo; "crédito"/"tdc"/"credito" → credito; "inversión"/"inversion" → inversion; "ahorro"/"apartado"/"fondo" → ahorro; si no matchea nada → `'debito'` como default razonable (la mayoría de cuentas bancarias/tarjetas de débito).
- `CATEGORY_ICON_HINTS` (array de `{ keywords, icon }` usando iconos ya listados en `ICON_CHOICES`) + `guessCategoryIcon(name)` — ej. "comida"/"restaurante"/"cafetería"→`UtensilsCrossed`/`Coffee`, "transporte"/"uber"/"gasolina"/"estacionamiento"/"casetas"→`Car`/`Fuel`, "renta"/"casa"→`Home`, "salud"/"enfermedad"→`HeartPulse`, "ropa"→`Shirt`, "escuela"→`GraduationCap`, "ahorro"/"inversion"/"financiero"→`PiggyBank`/`TrendingUp`, "sueldo"/"beca"/"prestacion"/"trabajo"→`Wallet`/`Briefcase`, "regalo"→`Gift`, "viaje"/"vacacion"/"hospedaje"→`Plane`, "gym"/"deporte"→`Dumbbell`, "telefonía"→`Smartphone`, etc.; sin match → `MoreHorizontal`.
- `buildMonefyImportPreview(rows)` — función pura central. Recibe las filas ya parseadas (arrays de columnas) y:
  1. Separa cada fila en tres buckets según la categoría: `"Initial balance '...'"`, `"To '...'"` / `"From '...'"`, o normal.
  2. Junta el **set de nombres de cuenta** = `account` de todas las filas ∪ nombres referenciados dentro de `To '...'`/`From '...'`. Para cada uno: `{ name, suggestedType: guessAccountType(name), isGhost: boolean (no aparece como `account` directo, solo en transferencias) }`.
  3. Empareja las transferencias: agrupa las filas `"To 'X'"` por clave `fecha|monto|cuentaOrigen(=account de la fila)|cuentaDestino(=X)`, agrupa las `"From 'Y'"` por `fecha|monto|cuentaOrigen(=Y)|cuentaDestino(=account de la fila)`, y hace un merge tipo "cola FIFO por clave" para emparejar una a una (soporta duplicados exactos el mismo día). Las que no encuentran par (dato inconsistente) se degradan a transacción simple (expense si el lado sin pareja fue "To", income si fue "From") sobre la cuenta que sí existe.
  4. Devuelve `{ accounts: [...], dateRange: {min, max}, transactionCount, transferCount, initialBalances: Map<name, amount> }` — esto es lo que alimenta la pantalla de revisión (paso 2 de abajo), **sin** todavía tocar el estado de la app.
- `buildMonefyImportPlan(rows, { accountDecisions, existingAccounts, existingCategories })` — se corre al confirmar. `accountDecisions` es lo que salió de la revisión del usuario: `{ [nombreCuentaMonefy]: { include: bool, type, name (editable) } }`. Con eso:
  - Resuelve cada nombre de cuenta a un `accountId`: si `include` es `false`, esa cuenta queda excluida (ver fallback de transferencias abajo); si el nombre (trim, case-insensitive) coincide con una cuenta ya existente en Hilo, reusa su `id`; si no, crea `{ id: uid('acc'), name, type, color: siguiente color de CATEGORY_PALETTE, initialBalance: initialBalances.get(name) || 0 }` — el `initialBalance` importado **solo** se aplica a cuentas nuevas, nunca se pisa el de una cuenta ya existente.
  - Resuelve cada `(nombreCategoría, tipo)` a un `categoryId`: match case-insensitive contra `existingCategories` (nombre + tipo); si no hay match, crea `{ id: uid('cat'), name, icon: guessCategoryIcon(name), color: siguiente color de CATEGORY_PALETTE, type }`.
  - Construye las transacciones: `expense`/`income` normales con `store: ''` (Monefy no distingue "comercio" de descripción libre, todo el texto de `description` va al campo `description` de Hilo) y `description` recortado; `transfer` para cada par emparejado, con `taggedAsExpense: false`, `categoryId: null`, `installmentPlanId: null` (Monefy no tiene ninguno de esos conceptos — ver [CLAUDE.md](../../CLAUDE.md)). Si una de las dos cuentas del par fue excluida (`include: false`), la transferencia se degrada a expense/income simple sobre la cuenta incluida, usando una categoría genérica "Transferencias" (se crea si no existe, tipo según dirección).
  - Devuelve `{ accountsToAdd, categoriesToAdd, transactions }` listo para mandar a `App`.

### UI nueva (sección 5, junto a `AccountFormModal`/`MsiPlanModal`/`SettingsModal`)

`MonefyImportModal({ existingAccounts, existingCategories, onClose, onConfirm, desktop })` — sheet con wizard de 3 pasos internos (`useState('upload' | 'review' | 'importing' | 'done')`), reutilizando `SheetOverlay`, mismo estilo visual que `AccountFormModal` (labels uppercase `COLORS.textMuted`, inputs `COLORS.surfaceAlt` + borde, botón principal `COLORS.accent`):

1. **Upload**: `<input type="file" accept=".csv">`, se lee con `FileReader.readAsText`. Al cambiar, se corre `parseCsv` + se valida que el header empiece con `date,account,category,amount` (si no, error inline: "Este archivo no parece un export CSV de Monefy"); si es válido, se corre `buildMonefyImportPreview` y se pasa a `review`. El parseo de 18.7k filas es síncrono pero rápido (ms); no hace falta Web Worker.
2. **Review**: resumen arriba (rango de fechas, # movimientos, # transferencias detectadas) + lista de cuentas detectadas, cada una con: nombre (input editable), badge "ya existe en Hilo" si hace match por nombre con `existingAccounts` (en ese caso no se pide tipo, se va a fusionar), si no existe: selector de tipo (mismo grid de `ACCOUNT_TYPES` que usa `AccountFormModal`) precargado con `suggestedType`, checkbox de incluir/excluir (marcado por default; si es `isGhost` se muestra una nota "solo aparece en transferencias antiguas, probablemente renombrada o cerrada"). Botón "Importar" dispara `importing`.
3. **Importing**: estado de carga simple (spinner/texto "Importando…") mientras se corre `buildMonefyImportPlan` (se dispara con un `setTimeout(fn, 0)` tras pintar el estado de carga, para no bloquear el primer render del "Importando…").
4. **Done**: resumen final ("Se importaron N movimientos, M cuentas nuevas, K categorías nuevas") y botón para cerrar, que llama a `onConfirm(plan)` y luego `onClose()`.

### Entrada desde Settings

`SettingsModal` gana un botón "Importar desde Monefy" (mismo estilo que el botón de "Borrar todos los movimientos" pero neutro, no rojo) que llama a un nuevo prop `onOpenImport`. `App` (y `DesktopShell`) agregan el estado `importModalOpen` + handler `handleImportMonefy(plan)`:

```js
function handleImportMonefy({ accountsToAdd, categoriesToAdd, transactions }) {
  if (accountsToAdd.length) setAccounts(prev => [...prev, ...accountsToAdd]);
  if (categoriesToAdd.length) setCategories(prev => [...prev, ...categoriesToAdd]);
  setTransactions(prev => [...prev, ...transactions]);
  setToast(`Se importaron ${transactions.length} movimientos de Monefy`);
  setImportModalOpen(false);
}
```

`MonefyImportModal` se monta condicionalmente igual que `accountModalOpen`/`msiModalOpen` hoy, tanto en el árbol móvil de `App` como dentro de `DesktopShell` (con `desktop` prop), pasando `existingAccounts={accounts}` y `existingCategories={categories}`.

## Archivos tocados

- `hilo-finanzas.jsx` — helpers de parseo/heurística/plan (sección 2), `MonefyImportModal` (sección 5), botón + prop en `SettingsModal`, estado/handler en `App`, montaje del modal en el árbol móvil y en `DesktopShell`.
- `agents/plans/monefy-import.md` (este archivo).
- `tasks/monefy-import.md` — `status: implementada`, se resuelve la sección "Abierto / por decidir" con las decisiones tomadas arriba.
- `tasks/README.md` — fila de la tabla a "Implementada".

## Verificación

Con `npm run dev` (ver README.md):

1. Ajustes → "Importar desde Monefy" abre el wizard.
2. Subir el CSV real del usuario (`Monefy.Data.25-8-2026.csv`, fuera del repo) y confirmar que el paso de revisión muestra ~44 cuentas (incluyendo las 3 "fantasma" con su nota) con tipos sugeridos razonables, y el resumen reporta 18,724 filas / rango dic-2014–ago-2026.
3. Excluir una cuenta en la revisión y confirmar que las transferencias donde participaba se conviertan en gasto/ingreso simple en vez de fallar o desaparecer.
4. Confirmar importación completa: verificar en la vista de Cuentas que los saldos calculados (`computeAccountBalance`) cuadran con lo esperado para al menos 2-3 cuentas conocidas del CSV (comparar a mano sumando algunas filas), que Historial muestra movimientos desde 2014, y que una transferencia importada (ej. "Tarjeta 💳 de débito" → "Efectivo") aparece como un solo movimiento de tipo transferencia, no dos.
5. Repetir el flujo con un archivo pequeño de prueba armado a mano (2-3 filas) para probar rápido el caso de "Initial balance" y el caso de categoría con signos mixtos, sin esperar el parseo de 18k filas cada vez.
6. Probar también en el layout de escritorio (`>=1024px`) que el modal se ve centrado como el resto de los modales de escritorio.
