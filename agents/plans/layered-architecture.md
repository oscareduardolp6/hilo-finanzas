# Plan: refactorizar hacia una arquitectura en capas

> Implementa [tasks/layered-architecture.md](../../tasks/layered-architecture.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.
>
> **Refactor en curso.** El [registro de avance](#registro-de-avance) de abajo es la fuente de verdad de qué se migró ya; se actualiza en el mismo commit que migra cada módulo, para poder retomar el refactor en otra sesión sin releer el diff.

## Context

Todo el producto vivía en un solo archivo de **4721 líneas** con tokens de diseño, persistencia IndexedDB, dominio, sync, import de Monefy, OCR y ~35 componentes React mezclados. `App` era dueño de **29 `useState`, 10 `useMemo`, 4 `useEffect` y 28 handlers**, y `DesktopShell` recibía **~60 props** solo para reenviarlas, con el cableado de los 7 modales duplicado entre el árbol móvil y el de escritorio.

Fue una decisión deliberada mientras Hilo corría como Claude Artifact (un archivo autocontenido era requisito); esa restricción ya no aplica desde [local-storage-migration.md](local-storage-migration.md). [testing.md](testing.md) se implementó explícitamente como red de seguridad previa a este refactor: **190 tests** (163 unit + 27 de integración) que congelan el comportamiento actual.

### Decisiones confirmadas con el usuario

1. **Feature-first.** La funcionalidad es el primer nivel; dentro van `domain/`, `application/`, `infrastructure/`, `store/` y `ui/`.
2. **Casos de uso con mónada Reader**, e `IO`/`Task` según el efecto (ver [Las tres formas de caso de uso](#2-las-tres-formas-de-caso-de-uso)).
3. **fp-ts v2**, con canal de error explícito: los casos de uso con IO devuelven `Either` en vez de lanzar. Tradeoff aceptado a sabiendas: fp-ts está en modo mantenimiento (su sucesor es Effect), pero es el vocabulario estándar y la app no necesita `Layer` ni fibras.
4. **zustand**, un store con **slices por feature**; los derivados son selectores puros sobre las funciones de dominio ya testeadas.
5. **TypeScript**, migrando en este mismo refactor.
6. **`hilo-finanzas.jsx` queda como barrel permanente.** Los 190 tests **no cambian ni una línea** en todo el refactor.
7. **Incremental**, un módulo por commit, con el registro de avance de abajo.
8. **Funciones, no clases.** Los repositorios son records de funciones; no se introduce una sola `class`.

## Diseño

### 1. Estructura de carpetas

```
hilo-finanzas.jsx            ← barrel permanente: re-exports explícitos + `export { default }`
src/
  app/
    App.tsx                  ← default export; crea el store, monta Provider, decide móvil/escritorio
    store.ts                 ← createHiloStore(deps) componiendo las slices
    store-context.tsx        ← HiloStoreProvider + useHiloStore(selector)
    dependencies.ts          ← composition root: el record `Deps` de producción
    persistence.ts           ← subscribe que persiste el blob (reemplaza el useEffect de guardado)
  shared/
    fp/                      ← re-exports de fp-ts + runRIO/runRTE
    domain/                  ← money, dates, search, ids, tipos del modelo, HiloError
    infrastructure/          ← indexed-db, file-reader, clipboard, download, share, compression, camera, qr
    design/                  ← COLORS, CATEGORY_PALETTE, ICONS, ACCOUNT_TYPES
    ui/                      ← SheetOverlay, Toast, EmptyState, GlobalStyles, CategoryPicker, useIsDesktop…
  features/<feature>/
    domain/                  ← tipos + funciones puras de la feature
    application/             ← casos de uso (Reader / ReaderIO / ReaderTaskEither)
    infrastructure/          ← adaptadores IO propios de la feature
    store/                   ← slice de zustand + selectores  (el único punto de "run")
    ui/
      components/            ← componentes de RENDERIZADO: props → JSX, sin store ni casos de uso
      containers/            ← componentes de LÓGICA: leen el store, ejecutan acciones, no pintan
  legacy/
    hilo-legacy.jsx          ← el archivo original, movido tal cual; se vacía commit a commit
```

**Features:** `accounts`, `transactions`, `installments` (MSI), `dashboard` (Home), `history`, `sync`, `backup`, `monefy-import`, `receipt-ocr`, `settings`.

**Regla de dependencias:** `ui → store → application → domain`. Una feature puede importar de `domain/` y de `store/selectors` de otra feature, **nunca de su `ui/`**. `shared/` lo importa cualquiera y no importa nada de `features/`.

### 2. Las tres formas de caso de uso

```ts
// shared/fp/index.ts
export { pipe, flow } from 'fp-ts/function';
export * as R   from 'fp-ts/Reader';
export * as RIO from 'fp-ts/ReaderIO';
export * as RTE from 'fp-ts/ReaderTaskEither';
export * as TE  from 'fp-ts/TaskEither';
export * as E   from 'fp-ts/Either';

export const runRIO = <A>(rio: RIO.ReaderIO<Deps, A>, deps: Deps): A => rio(deps)();
export const runRTE = <A>(rte: RTE.ReaderTaskEither<Deps, HiloError, A>, deps: Deps) => rte(deps)();
```

| Forma | Cuándo | Ejemplos |
|---|---|---|
| `Reader<Deps, A>` | determinista, solo necesita dependencias | `buildExportPayload` con `clock` inyectado |
| `ReaderIO<Deps, A>` | síncrono con efecto no determinista (id, reloj) | `saveTransaction`, `deleteTransaction`, `saveAccount`, `createCategory`, `savePlan` |
| `ReaderTaskEither<Deps, HiloError, A>` | asíncrono y falible | `hydrate`, `persist`, `receiveSync`, `scanReceipt`, `importMonefyFile`, `restoreBackup` |

Inyectar `clock` e `idGenerator` es la otra ganancia: hoy `uid()` y `Date.now()` se llaman dentro de los handlers y los vuelven no determinísticos. `uid` y `todayIso` quedan como implementación por defecto en `dependencies.ts`, así que sus tests unitarios siguen pasando intactos.

### 3. Dónde vive la mónada y dónde muere

`saveTransaction(state, input)` **no guarda nada**: devuelve un valor que describe el cambio. Ese valor solo ocurre cuando el slice le aplica `runRIO(..., deps)`. La mónada nace en `application/` y muere en `store/`; arriba de esa línea todo son funciones normales y datos planos.

| Capa | ¿Ve mónadas? |
|---|---|
| `ui/components/` | **No.** Props y JSX. |
| `ui/containers/` | **No.** Del store recibe `(input) => void` o `=> Promise<void>`. |
| `store/` (slice) | **Sí. El único lugar que corre y que hace `match` del `Either`.** |
| `application/` | **Sí.** Construye el valor y lo devuelve; nunca lo ejecuta. |
| `domain/` | **No.** Funciones puras. |

Es la única regla que hay que vigilar en review: si zustand y fp-ts se pisaran, sería porque algún componente corrió una mónada.

```ts
// features/transactions/store/transactions-slice.ts  ← único punto de run
saveTransaction: (input) => {
  const next = runRIO(saveTransaction(snapshot(get()), input), get().deps);
  set({ ...next, sheetOpen: false, toast: 'Movimiento agregado' });
},

// features/sync/store/sync-slice.ts  ← el Either se resuelve aquí y en ningún otro lado
receiveSync: async (text) => {
  const result = await runRTE(receiveSync(snapshot(get()), text), get().deps);
  pipe(result, E.match(
    (err) => set({ toast: messageFor(err) }),
    ({ state, summary }) => set({ ...state, toast: summaryToast(summary) }),
  ));
},
```

### 4. Dependencias y repositorios (todo funciones, cero clases)

```ts
// shared/domain/ports.ts
export type StateRepository = {
  load: TE.TaskEither<HiloError, DataState | null>;
  save: (state: DataState) => TE.TaskEither<HiloError, void>;
};

// app/dependencies.ts
export type Deps = {
  stateRepository: StateRepository;
  ocrSettingsRepository: OcrSettingsRepository;
  syncStateRepository: SyncStateRepository;
  receiptGateway: ReceiptGateway;      // fetch a la API de Anthropic
  fileGateway: FileGateway;            // FileReader
  clipboardGateway; shareGateway; downloadGateway; cameraGateway; qrGateway;
  clock: () => number;
  idGenerator: (prefix: string) => string;
};
```

Las tres claves de IndexedDB (`STORAGE_KEY`, `OCR_SETTINGS_STORAGE_KEY`, `SYNC_STATE_STORAGE_KEY`) siguen siendo tres repositorios separados sobre el mismo object store `state`, preservando por construcción que la config de OCR y el sync state **nunca** entren al blob de sync/QR/respaldo. La contraparte en memoria (`inMemoryStateRepository`, etc.) vive en `shared/infrastructure/` y se exporta para los tests nuevos: es el pago del patrón repository.

### 5. Errores tipados

```ts
export type HiloError =
  | { _tag: 'PersistenceError'; cause: unknown }
  | { _tag: 'InvalidPayload'; message: string }
  | { _tag: 'ReceiptApiError'; status: number; message: string }
  | { _tag: 'CsvParseError'; message: string }
  | { _tag: 'CameraUnavailable' };

export const messageFor = (e: HiloError): string => { /* … */ };
```

**Los textos en español son contrato de test.** `messageFor` reproduce literalmente los de hoy — `'No se pudo guardar el cambio localmente'` y los mensajes de 401/429 que ya mapea `scanReceipt`.

### 6. El store NO puede ser un singleton de módulo

Hoy el estado vive en `App`, así que se reinicia en cada `render()`. Un `create()` a nivel de módulo filtraría estado entre los 27 tests de integración y rompería el de `persistence-desktop.test.jsx`, que hace `cleanup()` y remonta para probar la rehidratación desde IndexedDB.

Por eso: **`createStore` vanilla + `<HiloStoreProvider>` creado por `App` en cada montaje**. Misma semántica que hoy, y de paso la inyección de dependencias sale gratis (un test construye su store con repositorios en memoria).

**Persistencia** (`app/persistence.ts`): un `subscribeWithSelector` sobre las 5 colecciones que corre el caso de uso `persist` y, en `Left`, hace `set({ toast: messageFor(err) })`. Hay que replicar un detalle sutil del efecto original: **también disparaba cuando `loaded` pasaba a `true`**, guardando la semilla demo aunque no hubiera cambios. Se replica con un `persist` explícito al terminar la hidratación.

### 7. Renderizado vs. lógica

- **`ui/components/`** — reciben props y devuelven JSX. Nada de `useHiloStore`, nada de casos de uso: `AccountsView`, `AccountsViewDesktop`, `TransactionRow`, `MsiPlanCard`, `HomeView`…
- **`ui/containers/`** — leen el store con selectores, ligan acciones y componen el componente de renderizado. Aquí muere el prop drilling: `DesktopShell` deja de recibir ~60 props porque cada container se sirve solo.

Los cuatro componentes con estado de formulario propio (`CategoryPicker`, `InstallmentPlanPicker`, `AddTransactionSheet`, `AccountFormModal`) conservan su `useState` local: es borrador de UI, no dominio, y subirlo al store cambiaría comportamiento sin beneficio.

### 8. El barrel: cómo los 190 tests no se enteran

[hilo-finanzas.jsx](../../hilo-finanzas.jsx) ya no tiene lógica: es un archivo de re-exports agrupados por el módulo **destino** de cada símbolo. Cuando uno migra de `src/legacy/hilo-legacy.jsx` a su feature, cambia solo el origen de esa línea.

Reglas:
- **Re-exports explícitos, nunca `export *`.** Si un símbolo quedara declarado en dos módulos a la vez, el error es inmediato en vez de silencioso.
- El archivo debe seguir llamándose literalmente `hilo-finanzas.jsx`: los tests lo importan con extensión.
- Debe exportar `buildDefaultTransactions` y `buildDefaultInstallmentPlans`. **No estaban exportadas** aunque `test/integration/helpers.jsx` las importa: resolvían a `undefined` y nadie se enteraba porque ningún test las usa. Corregido en el paso 0; con TypeScript habría sido error duro.

### 9. Fugas de capa a resolver

| Fuga | Dónde | Cómo se resuelve |
|---|---|---|
| Dominio importa tokens de diseño | `computeCategoryTotals` usa `COLORS.textMuted` | Parámetro opcional al final con ese default. **La firma de 2 argumentos no cambia** — `test/unit/domain.test.js` la llama así. |
| Helper de dominio devuelve JSX | `highlightMatch` | Vive en `shared/ui/highlight.tsx`. El test inspecciona `out[1].type === 'mark'` sin renderizar, así que sigue verde. |
| Lógica de formulario entre helpers de formato | `initialFormState` | `features/transactions/domain/form.ts` |
| IO dentro de componentes | `FileReader`, `getUserMedia`, `clipboard`, `share`, QR en `SyncModal`/`BackupModal`/`MonefyImportModal`/`ReceiptScanModal` | Salen a gateways inyectados en `Deps` |

## Registro de avance

Cada paso es un commit que deja **`npm test` en verde con los 190 tests**, `npm run typecheck` limpio y `npm run build` funcionando. **Actualiza este registro en el mismo commit que migra el módulo.**

| # | Paso | Estado |
|---|---|---|
| 0 | Mover el archivo tal cual a `src/legacy/hilo-legacy.jsx`; `hilo-finanzas.jsx` pasa a barrel | **hecho** |
| 1 | Cimientos: `tsconfig`, deps, `shared/fp`, `shared/domain`, `shared/design`, `shared/infrastructure` (repos IndexedDB + in-memory), `HiloError`, `Deps` | pendiente |
| 2 | Store: slices, `createStore` + Provider, persistencia por `subscribe`. Los 29 `useState` y los 4 `useEffect` salen de `App`; el `App` legacy pasa a leer del store y sigue bajando props | pendiente |
| 3 | Feature `accounts` (la más chica: valida el patrón completo de punta a punta) | pendiente |
| 4 | Feature `transactions` | pendiente |
| 5 | Feature `installments` (MSI) | pendiente |
| 6 | Feature `dashboard` (Home + donut + totales) | pendiente |
| 7 | Feature `history` (filtros + buscador) | pendiente |
| 8 | Feature `sync` (la más pesada: QR, cámara, delta) | pendiente |
| 9 | Feature `backup` | pendiente |
| 10 | Feature `monefy-import` | pendiente |
| 11 | Feature `receipt-ocr` | pendiente |
| 12 | Feature `settings`; borrar `src/legacy/`; `DesktopShell` sin prop drilling; CLAUDE.md final | pendiente |

Cada paso de feature (3–12) hace lo mismo: dominio → casos de uso → slice conectado → containers/components → tests nuevos de la feature → actualizar este registro.

### Detalle del paso 0 (hecho)

- `hilo-finanzas.jsx` → `src/legacy/hilo-legacy.jsx` con `git mv`, sin un solo cambio de lógica.
- `buildDefaultTransactions` y `buildDefaultInstallmentPlans` pasaron a estar exportadas (ver §8).
- `hilo-finanzas.jsx` reescrito como barrel: **76 símbolos** re-exportados más el `default`, verificado con un diff de conjuntos contra los exports del legacy.
- `vite.config.js`: `test.include` ensanchado a `['test/**/*.test.{js,jsx}', 'src/**/*.test.{js,jsx,ts,tsx}']` para poder colocar los tests nuevos junto a su feature; `coverage.include` de `['hilo-finanzas.jsx']` a `['src/**/*.{js,jsx,ts,tsx}']` con `exclude` de `src/test/**` y `src/main.jsx`.
- `tailwind.config.js`: `content` ampliado a `ts,tsx`.
- `src/main.jsx` no se tocó: sigue importando del barrel.

### Tests nuevos por feature

Los 190 existentes se quedan como red de regresión y no se editan. Encima, cada feature suma los suyos:

- `src/features/<f>/application/__tests__/*.test.ts` — casos de uso corridos con `Deps` en memoria; sin React, sin mocks de módulo.
- `src/features/<f>/ui/__tests__/*.test.tsx` — el componente de la feature como punto de entrada, **atómico**: monta el container con un store de prueba, no `<App/>`.

## Archivos tocados

- `hilo-finanzas.jsx` — de 4721 líneas a barrel de re-exports.
- `src/legacy/hilo-legacy.jsx` — el archivo original; se vacía commit a commit hasta borrarse en el paso 12.
- `src/app/**`, `src/shared/**`, `src/features/**` — el código nuevo.
- `package.json` — deps `fp-ts` y `zustand`; devDeps `typescript`, `@types/react`, `@types/react-dom`, `@types/qrcode`; script `typecheck`.
- `vite.config.js`, `tailwind.config.js` — ver detalle del paso 0.
- `CLAUDE.md` — reescribir "What this is" / "Architecture": ya no es un solo archivo. Se actualiza en el paso 1 describiendo el objetivo y apuntando a este registro, y se afina en el paso 12.
- `tasks/layered-architecture.md` y `tasks/README.md` — `status`.
- **Sin tocar:** los 16 archivos de `test/` ni `src/test/setup.js`.

## Verificación

Por commit, obligatorio:

```bash
npm test && npm run typecheck && npm run build
```

Los 190 tests deben pasar sin haber editado nada bajo `test/`. Si alguno falla, es un cambio de comportamiento real, no un test desactualizado.

Manual (`npm run dev`), en el paso 2 y en el 12, en móvil <1024px y escritorio ≥1024px:

1. Primer arranque sin datos: aparecen las cuentas y movimientos de ejemplo; recargar los conserva.
2. Alta, edición y borrado de un movimiento; el saldo de la cuenta cambia y sobrevive a la recarga.
3. Transferencia marcada como gasto: `totalBalance` no cambia dos veces y sí aparece en el total por categoría.
4. Plan MSI con pago parcial: `Quedan $X` correcto; al liquidarlo, `Pagado ✓`.
5. Historial: pager de mes, "ver todo el tiempo", filtros de tipo/categoría/tienda y buscador con resaltado.
6. Sincronizar: exportar por texto y por QR, recibir pegando el payload, y el delta tras "marcar como enviado".
7. Respaldo: exportar y restaurar por archivo.
8. Importar un CSV de Monefy y escanear un ticket (requiere API key en Ajustes).
9. Romper IndexedDB desde DevTools y confirmar el toast `'No se pudo guardar el cambio localmente'`.
10. Sin errores de consola en ninguno de los dos layouts.
