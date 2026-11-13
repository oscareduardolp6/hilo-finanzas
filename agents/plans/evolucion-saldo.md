# Plan: Evolución del saldo por plazos

> Implementa [tasks/evolucion-saldo.md](../../tasks/evolucion-saldo.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

Hilo muestra el saldo total de *ahora* (Inicio) y totales de *un mes*, pero no cómo ha subido o bajado el dinero ni cuánto se ahorró en un plazo. Se pidió una gráfica con plazos (1 mes, 3, 6, 1 año, 2, 3…).

Decisiones confirmadas con el usuario:
- **Qué graficar**: el **saldo total en el tiempo** (área). El "ahorro" del plazo = saldo final − saldo inicial, mostrado arriba de la gráfica.
- **Dónde**: **pestaña propia** ("Evolución"), móvil y escritorio.
- **Plazos**: 1M, 3M, 6M, 1A, 2A, 3A y **Todo**.

Hecho clave del dominio: el saldo nunca se guarda, se deriva (`computeAccountBalance`). Saldo total = Σ `initialBalance` + Σ ingresos − Σ gastos; las transferencias (incluso las marcadas como gasto) **no lo mueven**. El histórico se reconstruye sin cambiar el modelo ni los datos guardados: no hay campos nuevos ni migración.

## Diseño

Nueva feature **`evolution`** (la duodécima): `domain/` → `ui/{components,containers}`. Sin slice propio: el único estado es el plazo elegido, efímero, y vive como campo en `ui-slice` (`evolutionRange`, como `monthCursor`/`filterType`), porque las slices de feature solo aportan acciones.

### Dominio — [src/features/evolution/domain/series.ts](../../src/features/evolution/domain/series.ts)
- `EVOLUTION_RANGES` (1m, 3m, 6m, 1y, 2y, 3y, all) y `EvolutionRangeId`.
- `computeBalanceSeries(accounts, transactions, rangeId, today)` — pura, `today` inyectado.
  - Saldo de apertura = Σ `Number(initialBalance) || 0` (defensivo, igual que `computeAccountBalance`).
  - Efecto por movimiento: `income +amount`, `expense −amount`, `transfer 0`.
  - Inicio de ventana: `today` − N meses de calendario; en `all`, el primer movimiento (o `today`).
  - **Línea base** = saldo antes del primer día de la ventana; es el "saldo inicial" y el primer punto.
  - Granularidad: `step = max(1, ceil(spanDays / 60))` días (≈60 puntos máx.); el último punto es siempre `today`.
  - Los movimientos posteriores a `today` se ignoran: el último punto solo difiere del "Saldo total" de Inicio si hay movimientos a futuro.
  - Devuelve `{ points, startBalance, endBalance, change, changePct }`; `changePct` es `null` si `startBalance <= 0`.

### UI
- `BalanceChart` (recharts `AreaChart`, mismo patrón que `ExpenseDonut`; trazo verde/rojo/dorado según el cambio sea positivo/negativo/cero; eje Y oculto, solo fija la escala), `RangePills` (selector de plazos, `aria-pressed`) y `EvolutionSummary` (cambio con %, saldo inicial y final; versión `desktop` más grande) son los tres presentacionales compartidos. `EvolutionView` (móvil) y `EvolutionViewDesktop` (rejilla 3 columnas: gráfica ancha + resumen) los componen con los mismos props, incluido `hasData` (`false` sin un solo movimiento → `EmptyState` en vez de la gráfica). `EvolutionContainer` lee el store, memoiza la serie y elige vista por `desktop`; "hoy" sale de `todayIso()`, como el cursor de mes de Inicio.
- Modo privado: `formatMoney(x, hideBalances)`, sin signo cuando está oculto; se conserva la forma de la curva y el porcentaje (misma decisión que la dona en `ocultar-saldos`).

### Cableado
`ui-slice.ts` (`evolutionRange` = `'6m'` + `setEvolutionRange`), `nav.ts` (pestaña "Evolución", ícono `TrendingUp`, entre Historial y MSI), `Shells.tsx` (una línea en `ActiveTab`). `BottomNav` y `DesktopSidebar` ya pintan la lista.

## Archivos tocados
- Nuevos: `src/features/evolution/**`, `tasks/evolucion-saldo.md`, este plan.
- Editados: `src/app/store/ui-slice.ts`, `src/app/ui/nav.ts`, `src/app/ui/Shells.tsx`, `src/shared/domain/dates.ts` (si hace falta), `tasks/README.md`, `CLAUDE.md`.

## Qué se construyó (y qué se verificó)
Se construyó lo descrito arriba, sin divergencias de diseño. Tests: `series.test.ts` (17, dominio) y `evolution.test.tsx` (8: resumen por plazo, "Todo", transferencia neutra, estado vacío, modo privado, escritorio y la pestaña montada desde `<App/>`). `npm run typecheck` y `npm run build` limpios; `npm test` 460/461 y el único fallo (`transactions.test.jsx`, timeout de 15 s) pasó solo al correrlo aislado: fue carga de la suite completa, no cambio de comportamiento. En `npm run dev` (modo local) se comprobó por DOM y captura la vista móvil, y por DOM la de escritorio (rejilla, título) y el modo privado; no se logró una captura de escritorio.

Nota para quien pruebe en un worktree nuevo: la app no arranca sin `.env.local` (Firebase). Para el modo local basta con valores falsos en `VITE_FIREBASE_*`.

## Verificación
- `npm test`, `npm run typecheck`, `npm run build`.
- En `npm run dev` (modo local): la pestaña aparece en móvil (375px) y escritorio (≥1024px); cada plazo cambia gráfica y resumen; un ingreso/gasto mueve la curva y una transferencia no; modo privado oculta montos; sin datos muestra estado vacío; consola limpia.
