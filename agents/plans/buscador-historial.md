# Plan: Buscador en el historial

> Implementa [tasks/buscador-historial.md](../../tasks/buscador-historial.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

Hoy `HistoryView` / `HistoryViewDesktop` solo se acotan con los filtros de tipo / categoría / lugar y el toggle "Ver todo el tiempo". Con meses de captura acumulada, encontrar una compra concreta ("óxxo", "pañales", el nombre de un plan MSI) implica scrollear mucho o adivinar el `store` exacto en el `<select>`. La tarea pide un input de texto libre arriba de la lista que busque a lo largo de **todo el tiempo**, combinado con los filtros actuales, con autocompletado nativo vía `<datalist>`.

Decisiones confirmadas con el usuario:

1. **Toggle de mes mientras hay query**: el pager de mes y el toggle "Ver por mes / Ver todo el tiempo" se **deshabilitan** mientras hay texto en el buscador, con un hint ("Buscando en todo el tiempo"). Al limpiar el buscador vuelven a funcionar. La búsqueda siempre es all-time e ignora `monthCursor` / `showAllTime` por debajo.
2. **Campos de match**: solo `description`, `store`, y `description` / `store` del plan MSI asociado (`installmentPlanId` → `installmentPlans`). Sin `brand` / `size`. Match case-insensitive y sin acentos.
3. **Highlight**: sí, resaltar el fragmento que coincide dentro de `TransactionRow` (en `description` y `store`), envolviéndolo en `<mark>`.
4. **Persistencia**: el buscador siempre arranca vacío. Estado efímero en `App`, **fuera** del `useEffect` de guardado y del blob de `STORAGE_KEY` — igual que `filterType` / `filterCategory` / `filterStore`.

## Diseño

Todo vive en [hilo-finanzas.jsx](../../hilo-finanzas.jsx).

### Helpers (bloque de helpers puros, junto a `formatMoney` / `groupByDate`)

- **`normalizeForSearch(s)`** — normaliza sin acentos ni mayúsculas (`toLowerCase().normalize('NFD')` + quitar diacríticos). **Ya existe** en el repo (lo introdujo el buscador de cuentas, `AccountChipSearch`); el buscador de historial lo reutiliza en vez de duplicarlo.
- **`highlightMatch(text, rawQuery)`** (nuevo) — devuelve `text` tal cual si no hay query o no hay coincidencia; si la hay, devuelve un array `[antes, <mark>match</mark>, después]` (una sola coincidencia, la primera). Para no romper el mapeo de índices que causaría `normalize('NFD')` (é → e + marca combinante cambia longitudes), el highlight usa `indexOf` **case-insensitive pero sensible a acentos** sobre el string original; si sólo hubo match vía acento/nombre de plan, simplemente no resalta (ayuda visual best-effort, el filtrado ya es el correcto). El `<mark>` lleva estilo inline (`backgroundColor: COLORS.accentSoft`, `color: COLORS.text`, `borderRadius: 3`, `padding: '0 1px'`) porque el proyecto no usa clases para esto y Tailwind preflight neutraliza el estilo por defecto de `mark`.

### Estado en `App` (junto a `filterStore`)

- `const [searchQuery, setSearchQuery] = useState('');` — no se hidrata al cargar, no se incluye en el `useEffect` que llama `saveState`.

### Sugerencias para el `<datalist>` (memo en `App`, junto a `knownStores`)

- `const historySuggestions = useMemo(...)` — `Set` con `store` + `description` de cada transacción y `description` + `store` de cada plan MSI; `Array.from(set).sort((a,b) => a.localeCompare(b))`. Se pasa como prop a ambas vistas de historial. (No reutilizo `knownStores` directo porque ese no trae descripciones ni nombres de plan.)

### `HistoryView` y `HistoryViewDesktop` (mismos cambios en ambas, firmas ya paralelas)

Nuevas props: `searchQuery`, `setSearchQuery`, `historySuggestions`.

En el `useMemo` de `filtered`:

```js
const q = normalizeForSearch(searchQuery.trim());
const searching = q.length > 0;
// ...
if (!showAllTime && !searching) {           // el mes se ignora al buscar
  const key = monthKey(monthCursor);
  list = list.filter(t => t.date && t.date.startsWith(key));
}
// ...filtros de tipo / categoría / lugar sin cambios...
if (searching) {
  list = list.filter(t => {
    const plan = t.installmentPlanId
      ? installmentPlans.find(p => p.id === t.installmentPlanId)
      : null;
    const hay = [t.description, t.store, plan && plan.description, plan && plan.store]
      .map(normalizeForSearch).join(' ');
    return hay.includes(q);
  });
}
```

Deps del memo: agregar `searchQuery` e `installmentPlans`.

UI:

- **Input de búsqueda** justo debajo de la fila del pager de mes / toggle y **arriba** de los chips de tipo. `<input type="search" list="history-search-list" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar en el historial…" />` con un botón/ícono para limpiar (`X`, ya se importa `lucide-react`) cuando `searchQuery` no está vacío. Estilo consistente con los `<select>` existentes (`COLORS.surfaceAlt`, `border: 1px solid COLORS.border`, `rounded-xl`). En móvil ocupa el ancho completo; en escritorio va en la barra horizontal de filtros.
- **`<datalist>`** con `historySuggestions.map(s => <option key={s} value={s} />)`. Id distinto por vista (`history-search-list` / `history-search-list-desktop`) para no colisionar (aunque sólo un árbol se monta a la vez por el early-return de escritorio).
- **Pager de mes**: botones `disabled={showAllTime || searching}`.
- **Toggle**: cuando `searching`, en lugar del `<button>` mostrar `<span>` muted "Buscando en todo el tiempo"; label del mes muestra "Todo el tiempo" cuando `showAllTime || searching`.
- **EmptyState**: texto "No hay movimientos que coincidan." cuando `searching`, si no el de siempre.

### `TransactionRow`

- Nueva prop opcional `query` (default `undefined`). Cuando viene y no está vacía, pasar `description` y `store` por `highlightMatch(text, query)` en:
  - rama `transfer`: `txn.description` (línea del título).
  - rama normal: `txn.description` (título) y la parte `txn.store` de la línea meta (partir el string de la meta para envolver sólo el store).
- Ambas vistas de historial renderizan `<TransactionRow ... query={searchQuery.trim()} />`. El resto de llamadas (Home, desktop Home, etc.) no pasan `query` → sin resaltado, sin cambios de comportamiento.

## Archivos tocados

1. **[hilo-finanzas.jsx](../../hilo-finanzas.jsx)** — `normalizeForSearch` + `highlightMatch` helpers; estado `searchQuery` en `App` (efímero); memo `historySuggestions`; props nuevas + lógica de match + input + `<datalist>` + toggle/pager deshabilitado en `HistoryView` y `HistoryViewDesktop`; prop `query` y resaltado en `TransactionRow`.
2. **agents/plans/buscador-historial.md** — este plan.
3. **[tasks/buscador-historial.md](../../tasks/buscador-historial.md)** — `status`.
4. **[tasks/README.md](../../tasks/README.md)** — fila de la tabla.
5. **[CLAUDE.md](../../CLAUDE.md)** — en "State flow", la línea de `HistoryView` gana la mención de la búsqueda de texto (descripción / lugar / nombre de plan MSI, siempre all-time).

## Verificación

`npm run dev` y abrir en el navegador (la persistencia no funciona en dev local, es esperado). En viewport móvil (< 1024px) y escritorio (≥ 1024px):

1. Ir a Historial. Escribir `oxxo` → aparecen solo movimientos con "oxxo" en descripción o lugar, de **cualquier mes**; el pager de mes y el toggle quedan deshabilitados y se ve "Buscando en todo el tiempo".
2. Limpiar el buscador (botón X) → vuelve la vista por mes normal, pager y toggle re-habilitados.
3. Buscar el **nombre de un plan MSI** que no aparezca en el texto del movimiento → los pagos de ese plan salen igual.
4. Prueba sin acentos: `nino` encuentra "niño"; `descuento` encuentra "Descuentos".
5. Combinar con filtro de categoría / tipo: el buscador acota sobre lo que dejan pasar esos filtros.
6. Highlight: el fragmento coincidente aparece resaltado en la fila (título y/o lugar); las filas de Home siguen sin resaltado.
7. Recargar con un término escrito → el buscador arranca vacío (no se persiste).
8. Sin errores de consola en ningún viewport; cruzar el breakpoint en vivo con query activa no rompe estado.

## Estado post-implementación

_(Actualizar esta sección si algo se implementó distinto a lo descrito arriba — ver la nota de sincronización en CLAUDE.md.)_

Implementado tal como se describe en este plan. Detalles:

- El `<input>` de escritorio se colocó en la barra horizontal de filtros, entre el hint/toggle y el `<select>` de categoría (ancho fijo `w-64`); el de móvil ocupa el ancho completo debajo del toggle. Ambos con ícono `Search` a la izquierda y botón `X` para limpiar a la derecha.
- Fuera del plan original, para poder correr `npm run dev` con otro dev server ya ocupando el 5173 se tocó plumbing del scaffold: `.claude/launch.json` (`autoPort: true`) y `vite.config.js` (`server: { port: Number(process.env.PORT), strictPort: true }` sólo cuando `process.env.PORT` está definido). Sin efecto cuando `PORT` no está seteado (comportamiento por defecto de Vite intacto).
- Verificado en `npm run dev` (móvil 375px y escritorio 1280px) y `npm run build`: filtrado por texto/plan MSI, insensible a acentos/mayúsculas, highlight en `TransactionRow` (ramas normal y transfer), toggle/pager deshabilitados con hint, botón limpiar restaura la vista por mes, `<datalist>` poblado, sin errores de consola.
