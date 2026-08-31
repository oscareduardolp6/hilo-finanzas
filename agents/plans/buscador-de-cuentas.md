# Plan: Buscador de cuentas

> Implementa [tasks/buscador-de-cuentas.md](../../tasks/buscador-de-cuentas.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

[tasks/buscador-de-cuentas.md](../../tasks/buscador-de-cuentas.md) pide un filtro por texto para encontrar cuentas rápido cuando la lista crece. En los selectores de cuenta hay una fila de chips en scroll horizontal (`overflow-x-auto`): para elegir una cuenta que quedó al final hay que scrollear a ciegas.

Decisiones confirmadas con el usuario (resolvían las "Dudas abiertas" de la task):

1. **Alcance:** solo los selectores de captura y de ticket — `AddTransactionSheet` (chips "Desde" / "Cuenta" / "Hacia") y `ReceiptScanModal` (chips "Cuenta principal" / "Cuenta de origen"). La vista de Cuentas (`AccountsView` / `AccountsViewDesktop`) **no se toca** en esta iteración.
2. **Visibilidad:** el buscador aparece **solo cuando la lista tiene más de 5 cuentas** (`ACCOUNT_SEARCH_THRESHOLD = 5`); con listas cortas no se renderiza.
3. **Campos:** filtra **solo por nombre** de la cuenta (no por tipo).
4. **Comportamiento:** filtra los chips **en línea** — un input pequeño arriba de la fila que va ocultando los chips que no coinciden. No es un combobox.

`AddTransactionSheet` y `ReceiptScanModal` son componentes únicos compartidos entre móvil y escritorio (reciben un prop `desktop` pero no se duplican), así que el cambio aplica a ambas vistas sin tocar el árbol de escritorio paralelo.

## Diseño

Todo en [hilo-finanzas.jsx](../../hilo-finanzas.jsx).

### Import y helpers

- `Search` agregado a los imports de `lucide-react` (`X` ya estaba, se reusa para limpiar).
- Constante de nivel superior `ACCOUNT_SEARCH_THRESHOLD = 5`, junto a `STORAGE_KEY`.
- En la sección de helpers, junto a `formatMoney`:
  - `DIACRITICS_RE` + `normalizeForSearch(s)` — `toLowerCase()` + `normalize('NFD')` + quita marcas diacríticas.
  - `accountNameMatches(name, query)` — query vacío ⇒ `true`; si no, `normalizeForSearch(name).includes(normalizeForSearch(query).trim())`. Sin acentos ni mayúsculas ("nomina" encuentra "Nómina").

### Componentes compartidos (sección "Shared pieces", junto a `StoreInput`)

- **`AccountChipSearch({ value, onChange })`** — presentacional: `<input>` chico con icono `Search` a la izquierda y, cuando hay texto, una `X` a la derecha que llama `onChange('')`. Estilos con tokens `COLORS` (mismo lenguaje que `StoreInput`): `rounded-lg`, `text-xs`, fondo `COLORS.surfaceAlt`, borde `COLORS.border`, `placeholder="Buscar cuenta"`, `mb-2`. No sabe del umbral ni filtra: eso lo decide cada call site.
- **`AccountChips({ accounts, value, onSelect })`** — **hoistada a nivel de módulo** (antes era una arrow-function inline dentro de `ReceiptScanModal`; con `useState` interno el estado se perdía en cada re-render del modal porque React la trataba como tipo nuevo). Estado propio `q`; renderiza `AccountChipSearch` cuando `accounts.length > ACCOUNT_SEARCH_THRESHOLD` y mapea `accounts.filter(a => accountNameMatches(a.name, q))`. Markup de los chips idéntico al anterior.

### `AddTransactionSheet`

- Estado local nuevo: `fromAccQuery` / `toAccQuery` (`useState('')`, efímero; se descarta al desmontar la hoja).
- **Fila "Desde" / "Cuenta":** `{accounts.length > ACCOUNT_SEARCH_THRESHOLD && <AccountChipSearch value={fromAccQuery} onChange={setFromAccQuery} />}` antes de la fila de chips; `accounts.filter(a => accountNameMatches(a.name, fromAccQuery)).map(...)`. El `onClick` de cada chip (incluida la reconciliación de `toAccountId` en transfer) no cambia.
- **Fila "Hacia"** (solo transfer): igual sobre `toOptions` (ya es `accounts` menos `fromAccountId`); umbral `toOptions.length > ACCOUNT_SEARCH_THRESHOLD`. La rama `else` del ternario pasó a un fragmento `<>…</>` para poder poner el buscador arriba del `<div>` de chips.
- Si el chip seleccionado queda fuera del filtro solo se oculta; la selección en `form` sigue intacta.

### `ReceiptScanModal`

- Se elimina la definición inline de `AccountChips`.
- Las 2 invocaciones ("Cuenta principal", "Cuenta de origen") pasan `accounts={accounts}`. Cada instancia tiene su propio `q` por el estado interno del componente hoistado — buscar en una no afecta la otra.
- El `<select>` nativo por artículo no se toca (ya tiene type-ahead del navegador).

## Archivos tocados

1. **`hilo-finanzas.jsx`** — import `Search`; `ACCOUNT_SEARCH_THRESHOLD`; `normalizeForSearch` / `accountNameMatches`; `AccountChipSearch`; `AccountChips` hoistada con buscador; buscador + filtro en las 2 filas de chips de `AddTransactionSheet`; call sites de `ReceiptScanModal` pasan `accounts`.
2. **`agents/plans/buscador-de-cuentas.md`** — este archivo.
3. **`tasks/buscador-de-cuentas.md`** — `status`.
4. **`tasks/README.md`** — fila de la tabla.

CLAUDE.md no se toca: no documenta los selectores de cuenta ni cambia ninguna arquitectura descrita ahí.

## Verificación

`npm run dev` y abrir en el navegador. El seed trae solo 3 cuentas: crear cuentas hasta tener 6+ (pestaña Cuentas → Agregar) para que aparezca el buscador.

1. **Umbral:** con ≤ 5 cuentas, "Nueva transacción" no muestra ningún input de búsqueda en "Cuenta" / "Desde" / "Hacia". Con 6+ aparece "Buscar cuenta" arriba de cada fila de chips.
2. **Filtrado:** teclear parte de un nombre filtra los chips en vivo; "nomina" encuentra "Nómina"; indiferente a mayúsculas.
3. **Limpiar:** la `X` vacía el input y vuelven todos los chips.
4. **Transferencia:** "Desde" y "Hacia" tienen buscadores independientes; "Hacia" nunca lista la cuenta elegida en "Desde"; cambiar "Desde" con filtro activo en "Hacia" no rompe la selección.
5. **Selección fuera de filtro:** elegir una cuenta y luego teclear algo que la excluya conserva la selección; la transacción se guarda con la cuenta correcta.
6. **Ticket (`ReceiptScanModal`, con API key en Ajustes):** en la pantalla de revisión, "Cuenta principal" y "Cuenta de origen" muestran buscador con 6+ cuentas y son independientes; el `<select>` por artículo sigue igual.
7. **Regresión:** con ≤ 5 cuentas todo se ve y funciona como antes; sin errores de consola.

## Estado post-implementación

Implementado tal como se describe en este plan.
