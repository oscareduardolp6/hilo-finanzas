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

**Corolario (paso 4):** un componente **presentacional que usan dos o más features** vive en `shared/ui/`, no en una de ellas — es la única ubicación que la regla permite. Sigue siendo props → JSX, sin store ni casos de uso, así que no acopla nada.

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
| Dominio importa tokens de diseño | `computeCategoryTotals` usa `COLORS.textMuted` | Parámetro opcional al final con ese default. **La firma de 2 argumentos no cambia** — `test/unit/domain.test.js` la llama así. Cerrada **a medias** en el paso 6: ver su detalle. |
| Helper de dominio devuelve JSX | `highlightMatch` | Vive en `shared/ui/highlight.tsx`. El test inspecciona `out[1].type === 'mark'` sin renderizar, así que sigue verde. |
| Lógica de formulario entre helpers de formato | `initialFormState` | `features/transactions/domain/form.ts` |
| IO dentro de componentes | `FileReader`, `getUserMedia`, `clipboard`, `share`, QR en `SyncModal`/`BackupModal`/`MonefyImportModal`/`ReceiptScanModal` | Salen a gateways inyectados en `Deps` |

## Registro de avance

Cada paso es un commit que deja **`npm test` en verde sin haber editado nada bajo `test/`**, `npm run typecheck` limpio y `npm run build` funcionando. Los **190 tests de regresión** son intocables; el total sube porque cada paso suma los suyos. **Actualiza este registro en el mismo commit que migra el módulo.**

| # | Paso | Estado |
|---|---|---|
| 0 | Mover el archivo tal cual a `src/legacy/hilo-legacy.jsx`; `hilo-finanzas.jsx` pasa a barrel | **hecho** |
| 1 | Cimientos: `tsconfig`, deps, `shared/fp`, `shared/domain`, `shared/design`, `shared/infrastructure` (repos IndexedDB + in-memory), `HiloError`, `Deps` | **hecho** |
| 2 | Store: slices, `createStore` + Provider, persistencia por `subscribe`. Los 29 `useState` y los 4 `useEffect` salen de `App`; el `App` legacy pasa a leer del store y sigue bajando props | **hecho** |
| 3 | Feature `accounts` (la más chica: valida el patrón completo de punta a punta) | **hecho** |
| 4 | Feature `transactions` (en dos commits: lógica y UI) | **hecho** |
| 5 | Feature `installments` (MSI) | **hecho** |
| 6 | Feature `dashboard` (Home + donut + totales) | **hecho** |
| 7 | Feature `history` (filtros + buscador) | **hecho** |
| 8 | Feature `sync` (la más pesada: QR, cámara, delta), en dos commits: lógica y UI | **hecho** |
| 9 | Feature `backup` | **hecho** |
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

### Detalle del paso 1 (hecho)

Módulos creados, todos en TypeScript estricto:

| Módulo | Contenido |
|---|---|
| `src/shared/fp/index.ts` | Único punto de entrada de fp-ts + `runReader`/`runReaderIO`/`runReaderTaskEither`, genéricos sobre el entorno para que `shared/` no dependa de `Deps` |
| `src/shared/domain/types.ts` | El modelo: `Account`, `Category`, `Transaction` (unión de los 3 tipos), `InstallmentPlan`, `Tombstone`, `DataState`, `OcrSettings`, `SyncState`. Todo campo posterior al primer release va opcional, por la regla de compatibilidad con datos ya guardados |
| `src/shared/domain/errors.ts` | `HiloError` (unión etiquetada), sus constructores y `messageFor` |
| `src/shared/domain/ports.ts` | `StateRepository`, `OcrSettingsRepository`, `SyncStateRepository`, `Clock`, `IdGenerator` |
| `src/shared/domain/{ids,dates,money,search,grouping}.ts` | Los helpers puros, trasladados verbatim |
| `src/shared/design/{tokens,icons}.ts` | `COLORS`, `CATEGORY_PALETTE`, `ACCOUNT_SEARCH_THRESHOLD`, `DESKTOP_BREAKPOINT`, `ICONS`, `ICON_CHOICES`, `IconFor`, `ACCOUNT_TYPES` |
| `src/shared/ui/highlight.tsx` | `highlightMatch`, fuera de dominio por devolver JSX (fuga §9 resuelta) |
| `src/shared/infrastructure/indexed-db.ts` | La capa física, con la API de Promises intacta (es la que importan los tests) |
| `src/shared/infrastructure/repositories.ts` | Los puertos reales: envuelven esas Promises en `TaskEither` |
| `src/shared/infrastructure/in-memory.ts` | Su contraparte en memoria, con `failWith` para ejercitar la rama `Left` |
| `src/app/dependencies.ts` | `Deps` + `productionDeps` + `createDeps(overrides)` |
| `src/app/run.ts` | `runR`/`runRIO`/`runRTE` ligados a `Deps`/`HiloError`. **Solo puede importarse desde un slice de zustand** |

Notas de implementación:

- **TypeScript 7** (compilador nativo). Quitó `baseUrl`, así que el alias va como `"paths": { "@/*": ["./src/*"] }` relativo al tsconfig, espejado en `resolve.alias` de Vite. `allowJs: true` + `checkJs: false`: el legacy, el barrel y los 190 tests se resuelven pero no se chequean.
- `@types/react` se fijó a `^18` — npm instaló v19 por defecto, que no corresponde con React 18.3 y rompía el typecheck.
- `loadState`/`saveState`/etc. **siguen devolviendo Promises**, no `TaskEither`. Son la API pública histórica y los 9 tests de `test/unit/persistence.test.js` las llaman así; el canal monádico se añade encima, en `repositories.ts`.
- El legacy dejó de declarar lo migrado y ahora lo importa. Se recortó su import de `lucide-react` a los iconos que sigue usando directamente.
- 6 tests nuevos en `src/shared/infrastructure/in-memory.test.ts`: corren un caso de uso de ejemplo con `Deps` inyectadas, verifican que el fallo de persistencia llega como `Left` con el texto de toast correcto, y que el repositorio de OCR borra al guardar vacío. Total: **196 tests**.

### Detalle del paso 2 (hecho)

Los 29 `useState` y los 4 `useEffect` salieron de `App`. El default export quedó como un envoltorio de tres líneas sobre `HiloStoreProvider`, y el árbol vive ahora en `AppBody`.

| Módulo | Contenido |
|---|---|
| `src/app/store/index.ts` | `createHiloStore(deps)` con `createStore` vanilla + `subscribeWithSelector` |
| `src/app/store/{data,ui,settings}-slice.ts` | Las 5 colecciones + `loaded`; lo efímero (nav, filtros, formulario, 9 modales, toast); OCR y sync state |
| `src/app/store/setter.ts` | `makeSetter`, que produce setters con la firma de `useState` |
| `src/app/store-context.tsx` | Provider (store por montaje) + `useHiloStore` con y sin selector |
| `src/app/persistence.ts` | Las dos suscripciones de guardado |
| `src/app/application/{hydrate,persist}.ts` | Los dos primeros casos de uso reales |
| `src/shared/domain/defaults.ts` | Datos semilla, movidos aquí porque el store los necesita como estado inicial |

Decisiones que vale la pena conocer:

- **Los setters imitan la firma de `useState`** (aceptan valor o función actualizadora). Es lo que permitió que los **28 handlers de `App` migraran sin tocar su cuerpo**: `setTransactions(prev => prev.filter(...))` se sigue escribiendo igual. Los pasos 3–12 los irán reemplazando por acciones respaldadas por casos de uso.
- **`AppBody` se suscribe al store sin selector**, así que re-renderiza ante cualquier cambio — exactamente lo que hacía cuando era dueño de los 29 `useState`. Los selectores granulares llegan con los containers de cada feature; meterlos ahora cambiaría el comportamiento de render sin que ningún test lo cubra.
- **`hydrate` es un `ReaderTask`, no un `ReaderTaskEither`.** La hidratación no puede fallar de cara al usuario: si IndexedDB no responde, se arranca con los datos de ejemplo y no se muestra error, que es lo que hacía el `useEffect` original al tragarse la excepción. Cada una de las tres lecturas se recupera por separado porque cada una significa algo distinto al faltar. `persist` sí es `ReaderTaskEither`: su fallo es el toast.
- **Las slices viven en `src/app/store/` y no en cada feature** (desviación consciente del diseño de arriba). Están agrupadas por ciclo de vida — persistido / efímero / config — porque en el paso 2 las features todavía no existen y repartir los campos ahora obligaría a moverlos otra vez. Los pasos 3–12 añaden, desde `features/<f>/store/`, slices que aportan **acciones**, sin mover los campos.
- **`makeSyncState` acepta un generador de ids opcional**, para que la hidratación sea determinista en test. Llamarla sin argumentos sigue usando `uid`, que es como la invocan los tests existentes.

12 tests nuevos en `src/app/store/store.test.ts`, sin React: cubren los tres detalles del efecto original que es fácil perder al volverlo suscripción — que no guarda antes de hidratar, que **sí** guarda en el instante en que `loaded` pasa a `true` (lo que persiste la semilla en un perfil nuevo), y que un fallo se vuelve toast. Total: **208 tests**.

> **Trampa del entorno.** Tras mover módulos, el preview puede fallar con `does not provide an export named X` o `Invalid hook call` aunque test, typecheck y build estén en verde: es el **service worker de la PWA** sirviendo el grafo de módulos anterior. Borrar `node_modules/.vite` no basta — hay que desregistrar el SW y limpiar `caches` desde la consola del navegador, y comprobar en una pestaña nueva (el búfer de consola de la vieja conserva los errores previos).

### Detalle del paso 3 (hecho)

La primera feature completa, y por tanto **la plantilla de los pasos 4–12**: es la vertical entera, de `domain/` a `ui/containers/`, en la feature más chica que la ejercita toda.

| Módulo | Contenido |
|---|---|
| `features/accounts/domain/balance.ts` | `computeAccountBalance`, `computeBalances`, `computeTotalBalance` y `accountHasTransactions` |
| `features/accounts/application/{save,delete}-account.ts` | Los dos casos de uso, ambos `ReaderIO` (necesitan reloj, y el alta un id) |
| `features/accounts/store/accounts-slice.ts` | Las 4 acciones. **Único lugar de la feature que llama `runRIO`** |
| `features/accounts/store/selectors.ts` | `selectAccounts`, `selectBalances`, `selectEditingAccountCanDelete`… |
| `features/accounts/ui/components/` | `AccountsView`, `AccountsViewDesktop`, `AccountFormModal` — props → JSX |
| `features/accounts/ui/containers/` | `AccountsContainer`, `AccountFormContainer` — leen el store, ligan acciones |
| `shared/ui/sheet-overlay.tsx` | `SheetOverlay`, movido aquí porque lo usan los 9 modales |
| `test/render-feature.tsx` | Monta UN container con repos en memoria y reloj/ids fijos. **Nunca `<App/>`** |

Decisiones y hallazgos:

- **El prop drilling de cuentas desapareció**: `DesktopShell` perdió 8 props (`onAddAccount`, `onEditAccount`, `accountModalOpen`, `editingAccount`, `onCloseAccountModal`, `onSaveAccount`, `onDeleteAccount`, `accountCanDelete`) y `App` sus dos handlers. Los dos árboles montan `<AccountsContainer />` y `<AccountFormContainer />`, que se sirven solos. Es la prueba en pequeño de lo que el paso 12 hará con los ~60 props restantes.
- **El `accountModalOpen && <Modal/>` se lo tragó el container.** Estaba duplicado en el árbol móvil y en el de escritorio; ahora `AccountFormContainer` devuelve `null` si está cerrado, lo que conserva lo que importa: al abrirse, el modal se monta de cero y sus `useState` toman los valores de la cuenta editada.
- **Los campos siguen donde estaban** (`accounts`/`tombstones` en `data-slice`, `accountModalOpen`/`editingAccount` en `ui-slice`); la slice de la feature solo aporta acciones. `editingAccount` sí se estrechó de `unknown` a `Account | null`.
- **Cuatro `set` se volvieron uno.** El handler legacy llamaba `setAccounts`, `setToast`, `setAccountModalOpen` y `setEditingAccount` por separado; la acción hace un solo `set`, así que la suscripción de persistencia guarda una vez en vez de varias. React ya los batcheaba dentro del handler, así que de cara al usuario no cambia nada.
- **`computeBalances` va en `useMemo`, no en un selector**: devuelve un objeto nuevo y zustand v5 compara por identidad, así que pasarlo a `useHiloStore` sería un bucle de renders. Los selectores que devuelven un escalar (`selectEditingAccountCanDelete`) sí van directos. Queda anotado en `selectors.ts` porque es la trampa que se repetirá en cada feature.
- `accountHasTransactions` mira los tres campos de cuenta sin ramificar por `type`, igual que el original: un registro viejo puede traer combinaciones que la unión de tipos ya no admite, y perder una referencia ahí dejaría borrar una cuenta que sí tiene movimientos.

19 tests nuevos: 6 de casos de uso (uno comprueba que **construir el caso de uso no toca el reloj** — solo correrlo), 3 de dominio y 10 de UI por los containers. Total: **227 tests**, con los 190 de regresión intactos.

### Detalle del paso 4 (hecho)

La feature más grande, y la que obligó a fijar dos reglas que el diseño original no había resuelto. Se hizo en **dos commits** — lógica (`c3365de`) y UI (`903cfcf`+1) — porque en uno solo el diff era irrevisable.

| Módulo | Contenido |
|---|---|
| `transactions/domain/form.ts` | `TransactionFormDraft` (el borrador: los inputs son strings) + `initialFormState` |
| `transactions/domain/to-transaction.ts` | Borrador → movimiento. Las tres ramas y sus asimetrías |
| `transactions/domain/queries.ts` | `computePeriodTransactions`, `computeRecentTxns`, `computeKnownStores` |
| `transactions/application/` | `saveTransaction`, `deleteTransaction`, `resetTransactions` (los tres `ReaderIO`) |
| `transactions/store/` | El slice con 7 acciones + selectores |
| `transactions/ui/components/AddTransactionSheet.tsx` | La pantalla más cargada de Hilo |
| `transactions/ui/containers/AddTransactionContainer.tsx` | Sustituye 15 props duplicadas entre los dos árboles |
| `categories/` | Feature mínima: `createCategory` y su slice. No tiene pantalla propia |
| `installments/domain/progress.ts`, `application/create-plan.ts` | Adelanto del paso 5 (ver abajo) |
| `shared/ui/` | `EmptyState`, `CategoryPicker`, `StoreInput`, `AccountChips`, `InstallmentPlanPicker`, `TransactionRow` |

**Regla nueva 1 — qué va en `shared/ui/`.** Un componente **presentacional que usan dos o más features** vive en `shared/ui/`, no en una de ellas. No es preferencia: la regla de dependencias prohíbe que una feature importe el `ui/` de otra, y `TransactionRow` lo pintan Inicio y el historial, `CategoryPicker` el formulario de movimiento y los dos de plan, `InstallmentPlanPicker` habla de planes pero lo monta `transactions`. Siguen siendo props → JSX: no tocan store ni casos de uso, así que no acoplan nada.

**Regla nueva 2 — una acción puede devolver lo que creó.** `CategoryPicker` e `InstallmentPlanPicker` llamaban `uid()` **dentro del render**: una fuga de capa que además volvía no determinista cualquier test de esas altas. Ahora emiten la entidad sin id (`NewCategory`, `NewInstallmentPlan`) y `createCategory`/`createPlan` devuelven la creada, porque quien la pidió necesita su id para dejarla seleccionada. Es la excepción a "las acciones devuelven `void`", y la alternativa era peor.

Por qué `categories` e `installments` aparecen aquí:

- `createCategory` no tiene dueño natural — lo invocan el formulario de movimiento, el de plan MSI y el picker de planes. Ponerlo en `transactions` habría sido arbitrario, así que se creó `features/categories/`, que **no estaba en la lista de features** del diseño: es mínima (un caso de uso, una acción) porque las categorías no tienen pantalla propia, se crean al vuelo.
- De `installments` se adelantaron `domain/progress` (`computePlanProgress`) y `createPlan` porque el formulario de movimiento los necesita. El paso 5 se encuentra la feature empezada.

Otras decisiones:

- **`todayIso` se apoya ahora en `isoFromEpoch(ms)`**, así que `saveTransaction` deriva "hoy" de `deps.clock()` en vez de leer el reloj del sistema. Guardar sin fecha ya es determinista en test, y `todayIso()` sigue existiendo igual para quien lo llama sin reloj inyectado.
- **`Omit` sobre una unión colapsa a las claves comunes**, lo que borraba `accountId`/`fromAccountId` de `NewTransaction`. Hace falta la versión distributiva (`T extends unknown ? Omit<T, K> : never`); queda anotado en el módulo porque volverá a aparecer.
- **El `useMemo` de `isValid` estaba después de un `return null` condicional** en el original — un hook condicional que solo no explotaba porque la hoja nunca se monta con `form` nulo. Al migrarlo se subió antes del guard.
- **Latente, no corregido:** `createCategory` no pone `createdAt` (el alta inline nunca lo puso), mientras que `createPlan` sí. No estorba porque `recordStamp` mira `updatedAt` primero, pero es una asimetría que conviene arreglar **fuera** de un refactor, para no mezclar cambio de comportamiento con movimiento de código.

27 tests nuevos: 10 de `toTransaction` (las tres ramas campo a campo), 7 de casos de uso y 10 de UI por el container. Total: **254 tests**, con los 190 de regresión intactos.

### Detalle del paso 5 (hecho)

La feature ya venía empezada del paso 4 (`domain/progress` y `createPlan`, que el formulario de movimiento necesitaba). Este paso la cierra.

| Módulo | Contenido |
|---|---|
| `installments/domain/grouping.ts` | `groupPlansByStatus` y `planPayments` |
| `installments/application/save-plan.ts` | `savePlan` y `deletePlan` (`ReaderIO`) |
| `installments/store/` | El slice completo (5 acciones) + selectores |
| `installments/ui/components/` | `MsiView`, `MsiViewDesktop`, `MsiPlanModal` |
| `installments/ui/containers/` | `MsiContainer`, `MsiPlanFormContainer` |
| `shared/ui/msi-plan-card.tsx` | `MsiPlanCard`, que Inicio también pinta |

Decisiones:

- **`PlanProgress` subió a `shared/domain/types.ts`.** Estaba duplicado: la versión canónica en `installments/domain/progress.ts` y una copia estructural en `shared/ui/installment-plan-picker.tsx`, porque `shared/` no puede importar de `features/`. Al llegar `MsiPlanCard` habrían sido tres. El tipo es vocabulario de dominio sin lógica, así que `shared/domain` es su sitio; la feature lo re-exporta para quien lo lea desde ahí.
- **La partición activos/pagados salió a `domain/grouping.ts`.** Estaba duplicada literal entre `MsiView` y `MsiViewDesktop`, que es exactamente cómo un cambio se olvida en una de las dos.
- **Las dos vistas siguen siendo dos componentes.** Se probó a factorizarlas en un cuerpo común con el layout inyectado y se descartó: contradice la decisión de [desktop-view](desktop-view.md) de mantener árboles paralelos, y es inconsistente con `accounts`. Lo único que se comparte es el dominio.
- **Dos toasts distintos para crear un plan**, y es intencional: el formulario completo dice `'Plan creado'` y el alta inline del picker `'Plan de MSI creado'`. Venía así de antes; unificarlos es un cambio de producto, no un refactor. Hay un test que lo fija para que nadie lo "arregle" sin querer.
- **Único cambio de comportamiento del paso, deliberado:** el botón de borrar de `MsiPlanModal` era un icono sin nombre accesible, mientras que sus hermanos de `AccountFormModal` y `AddTransactionSheet` sí lo tienen. Se le puso `aria-label="Eliminar plan"`. Es aditivo y ningún test previo lo consultaba.

20 tests nuevos: 6 de agrupación, 6 de casos de uso (incluido el que fija los dos toasts) y 8 de UI por los containers. Total: **274 tests**, con los 190 de regresión intactos.

### Detalle del paso 6 (hecho)

Inicio es la vista que más cruza features, y por eso era la prueba real de la regla de dependencias: los saldos son de `accounts`, los movimientos del periodo de `transactions` y el avance de los planes de `installments`. Todo eso entra por `domain/` y por acciones del store; ningún `ui/` de otra feature.

| Módulo | Contenido |
|---|---|
| `dashboard/domain/totals.ts` | `computeTotalIncome`, `computeTotalExpense`, `computeCategoryTotals` |
| `dashboard/store/dashboard-slice.ts` | `showCategoryInHistory` — la única acción propia |
| `dashboard/ui/components/` | `HomeView`, `HomeViewDesktop`, `ExpenseDonut` (con `DonutTooltip`) |
| `dashboard/ui/containers/HomeContainer.tsx` | Los siete `useMemo` que le quedaban a `App` |
| `shared/design/icons.ts` | `accountTypeFor`, el lookup tolerante sobre `ACCOUNT_TYPES` |
| `shared/domain/dates.ts` | `addMonths`, el pager de mes |

Decisiones:

- **`accountTypeFor` subió a `shared/design/icons.ts`.** Estaba como `typeInfoFor` exportado desde `AccountsView`, y Inicio también pinta la tira de cuentas: importarlo habría sido feature → `ui/` de otra feature. Es un lookup tolerante sobre un catálogo de diseño, igual que `IconFor`, así que ese es su sitio; `accounts` ahora lo importa de ahí.
- **El pager de mes es `addMonths` en `shared/domain/dates.ts`, no una acción.** El cursor lo comparten Inicio y el historial; una acción en el slice de una de las dos habría dejado a la otra importándola por su nombre. Réplica literal del `setMonth` original, desbordamiento incluido — el cursor siempre es día 1, así que el caso raro no se da, pero cambiar la aritmética sería cambiar comportamiento sin quererlo.
- **`showCategoryInHistory` sí es una acción del dashboard**, aunque escriba campos del historial: describe lo que pasa al tocar una porción de la dona. Va en un solo `set` — una notificación del store donde antes había un render de React con cuatro `setState`.
- **Los planes activos los filtra el container**, con `activePlans` extraído a `installments/domain/grouping.ts`. La pantalla de MSI usa `groupPlansByStatus`, que además **ordena**; Inicio no reordena, así que compartir el predicado sin compartir el orden era la única forma de deduplicar sin cambiar lo que se ve.
- **La fuga de `COLORS` en `computeCategoryTotals` queda a medias, a sabiendas.** El color de una categoría borrada ya entra por parámetro, pero su default sigue siendo `COLORS.textMuted` para que la llamada de dos argumentos (la de `test/unit/domain.test.js`) signifique exactamente lo mismo que antes. Cerrarla del todo obliga a devolver `color: null` y decidir el fallback en los cuatro puntos de la dona que lo pintan, o a duplicar el hex: ninguna vale dentro de un refactor cuyo contrato es no cambiar comportamiento. Queda para cuando la dona se toque por producto.
- **Cambio de comportamiento deliberado y aditivo:** las flechas del pager de Inicio eran iconos sin nombre accesible. Llevan `aria-label="Mes anterior"` / `"Mes siguiente"`, como ya hizo el paso 5 con el borrar de MSI. *(Corregido en el paso 7: la frase original decía que el pager del historial tampoco los tenía. `HistoryView` sí los traía desde antes del refactor — o sea que esto no inventó una etiqueta, alineó Inicio con lo que el historial ya hacía. La que sí le faltaba era la vista de escritorio.)*

18 tests nuevos: 5 de dominio y 13 de UI por el container. Total: **292 tests**, con los 190 de regresión intactos. `DesktopShell` pierde otras 9 props.

**Observación, no regresión:** en el panel de vista previa la dona de recharts no dibuja sus sectores (el SVG se dimensiona bien y la leyenda, el total y los porcentajes salen correctos, pero los `.recharts-pie-sector` quedan vacíos). Se comprobó contra el commit del paso 5 y pasa igual, así que es previo al paso 6 y ajeno a esta migración.

### Detalle del paso 7 (hecho)

| Módulo | Contenido |
|---|---|
| `history/domain/filters.ts` | `filterHistoryTransactions`, `computeHistorySuggestions`, `HISTORY_TYPE_FILTERS` |
| `history/ui/components/` | `HistoryView`, `HistoryViewDesktop` |
| `history/ui/containers/HistoryContainer.tsx` | Los dos últimos `useMemo` de `AppBody` y las cuatro derivaciones que cada vista repetía |

Decisiones:

- **`history` no tiene slice.** Sus filtros son campos del `ui-slice` y el container liga sus setters; no hay ninguna acción propia que añadir. La única acción de historial que existe vive en `dashboard` (`showCategoryInHistory`), porque el disparo es de allá. Un slice vacío por simetría sería indirección sin contenido.
- **Las vistas dejaron de derivar.** Cada una normalizaba la búsqueda, filtraba, agrupaba por día y sacaba las categorías de gasto — las cuatro cosas, literales, en las dos. Ahora entra todo hecho por props. Es la deduplicación más grande de todo el refactor hasta ahora, y la que mejor justifica la separación renderizado/lógica: dos vistas paralelas solo son sostenibles si no piensan.
- **`HISTORY_TYPE_FILTERS` va en `domain/`, no en `design/`.** Lleva etiquetas en español, que suena a presentación, pero lo que importa es que los ids y las etiquetas se mantengan juntos: el id `'msi'` no es un `type` de movimiento, es "tiene plan MSI vinculado", y separarlo de su etiqueta invita a tratarlo como los otros tres. El tipo `HistoryFilterType` lo deja explícito.
- **Cambio de comportamiento deliberado y aditivo:** `HistoryViewDesktop` no tenía los `aria-label` del pager ni el de "Limpiar búsqueda"; su gemela móvil sí, desde antes del refactor. Ahora los dos árboles dicen lo mismo.

**Con este paso `AppBody` deja de derivar nada.** De los diez `useMemo` originales no queda ninguno, y `DesktopShell` baja de ~60 props a 36 — las que quedan son casi todas de los modales, que se van en los pasos 8-12.

28 tests nuevos: 13 de dominio (cómo se componen los filtros, y la regla de que buscar ignora el mes) y 15 de UI por el container. Total: **320 tests**, con los 190 de regresión intactos.

### Detalle del paso 8a (hecho)

El paso más grande, y por eso va en dos commits como el 4: primero la lógica, después la UI.

| Módulo | Contenido |
|---|---|
| `shared/infrastructure/compression.ts` | `supportsCompression`, `gzipString`, `gunzipBytes`, `bytesToBase64`, `base64ToBytes` |
| `shared/infrastructure/download.ts` | `exportFileName`, `downloadJson` |
| `sync/domain/payload.ts` | El formato del blob: constantes, `recordStamp`, `buildExportPayload`, `normalizeExportPayload`, `parseExportText`/`parseExportBytes` |
| `sync/domain/merge.ts` | `mergeCollection`, `mergeTombstones`, `mergeDataState` |
| `sync/domain/peers.ts` | El estado local de peers y el texto del resumen |
| `sync/application/receive-sync.ts` | El caso de uso, `ReaderTaskEither` |
| `sync/store/sync-slice.ts` | `receiveSync`, `renameDevice`, `forgetPeer`, `markSent` |
| `backup/domain/replace.ts` | `replaceDataState` — ver abajo |

Decisiones:

- **La compresión y la descarga van a `shared/infrastructure/`, no a `sync/`.** No saben nada de Hilo: una comprime un string, la otra baja un JSON. `backup` y `receipt-ocr` también las van a querer.
- **`replaceDataState` se adelanta a `backup/domain/`.** Es de la feature del paso 9, pero el bloque de export/sync salió del legacy entero en este paso y dejarla sola ahí habría sido peor que empezar la carpeta antes de tiempo — como ya pasó con `installments` en el paso 4.
- **El fallo de `receiveSync` NO sale como toast**, a diferencia de todo lo demás. El mensaje ("Esto no parece un export de Hilo") habla del texto que el usuario acaba de pegar y va debajo de ese cuadro. El `Either` igual muere en el slice; lo que cruza a la UI es un `{ ok } | { ok, message }` plano, no una mónada.
- **Tres funciones ganaron un parámetro de tiempo opcional** (`buildExportPayload`, `mergeTombstones`, `mergeDataState`, `exportFileName`). Llamaban a `Date.now()` por dentro, lo que las volvía no deterministas pese a ser "puras". El default preserva la firma que usan `test/unit/sync.test.js` y el barrel; el caso de uso pasa `deps.clock()`.
- **`SyncPeer.lastSentAt`/`lastReceivedAt` pasan a `number | null`.** El código escribía `?? null` desde antes del refactor, así que eso es lo que hay guardado en los IndexedDB de los usuarios: el tipo tiene que decir la verdad sobre el dato.
- **La asimetría de los dos sellos está ahora escrita en el dominio.** `lastSentAt` gobierna el delta y lo avanza el usuario a mano; `lastReceivedAt` es informativo y avanza solo. Era un comentario dentro de un handler de `App`; ahora es la documentación de `peers.ts` y tiene tests.

19 tests nuevos: 13 del estado de peers y 6 del caso de uso (incluido que un delta no borre lo que no lleva). Total: **339 tests**, con los 190 de regresión intactos.

El **8b** lo completa: `SyncModal` a `sync/ui/`, con los gateways saliendo a `Deps`.

### Detalle del paso 8b (hecho)

Cierra la fuga que la tabla de arriba llamaba "IO dentro de componentes". Los cinco `useEffect` de `SyncModal` —comprimir, pintar el QR, abrir la cámara, leer un archivo, copiar y compartir— se convirtieron en cinco puertos.

| Módulo | Contenido |
|---|---|
| `shared/domain/ports.ts` | `FileGateway`, `ClipboardGateway`, `ShareGateway`, `DownloadGateway`, `QrGateway` |
| `shared/infrastructure/browser.ts` | Las cuatro primeras, sobre `FileReader`, `navigator.clipboard` y `navigator.share` |
| `shared/infrastructure/qr.ts` | `qrcode` + `getUserMedia` + `jsqr`, detrás de una promesa con `cancel` |
| `shared/infrastructure/in-memory.ts` | Los dobles de las cinco, con un registro de lo que se les pidió |
| `sync/application/prepare-share.ts` | `ReaderTask`: payload → gzip → base64 → QR |
| `sync/ui/components/SyncModal.tsx` | props → JSX, sin un solo efecto que hable con el navegador |
| `sync/ui/containers/SyncContainer.tsx` | El container más grande del refactor |

Decisiones:

- **`QrGateway.scan` recibe un `HTMLVideoElement`.** Es el único puerto que toca el DOM, y es deliberado: la cámara tiene que pintarse en algún sitio y ese sitio lo decide la UI. A cambio, el bucle de `requestAnimationFrame` sale del componente.
- **El límite del QR (`QR_BYTE_LIMIT`) se comprueba en el caso de uso, no en el gateway.** `shared/` no importa de `features/`, y "cuántos bytes caben" es un concepto de Hilo, no del navegador.
- **`prepareShare` es `ReaderTask`, no `ReaderTaskEither`.** Quedarse sin QR no es un error: es un historial grande. Devuelve un preview sin QR y la UI ofrece el archivo.
- **`prepareShare` devuelve el preview en vez de guardarlo en el store.** Es una vista previa, no estado de la app, y quien la pidió puede haberla descartado — el `cancelled` del efecto vive donde React sabe expresarlo.
- **El container va partido en dos.** `SyncContainer` solo mira si la hoja está abierta; el estado vive en `SyncSheet`, que se desmonta con ella. Sin esa partición, reabrir la hoja recordaba la última pestaña en vez de volver a "Enviar" — se detectó en el navegador, no en los tests.
- **El `<video>` se monta siempre y solo se oculta.** Antes se montaba a la vez que `scanning` pasaba a true y el código leía la ref inmediatamente después; funcionaba por un orden de renders que no conviene volver a apostar.
- **`qrcode` y `jsqr` se cargan con `import()` dinámico.** Un import estático en `shared/infrastructure/qr.ts` entra por `dependencies.ts` —que lo importa todo— al arranque de cada test unitario y al chunk inicial del bundle. Con la carga diferida, el bundle principal baja de 862 KB a 709 KB y las dos librerías quedan en chunks aparte.

14 tests nuevos de UI, con las cinco capacidades fingidas: se puede negar la cámara, romper el portapapeles y leer un archivo sin tener ninguna de las tres. Total: **353 tests**, con los 190 de regresión intactos. El legacy baja a 1714 líneas.

**Nota sobre `npm test` en esta máquina:** con el paralelismo por defecto (un worker por core) la suite satura la CPU y dos tests de integración pasan de 5 s y fallan por timeout. Pasa igual en el commit del paso 8a, así que es del entorno y no del codigo; `npx vitest run --minWorkers=1 --maxWorkers=3` la deja verde de forma reproducible.

### Detalle del paso 9 (hecho)

La feature más chica de las que quedaban, y la que mejor enseña en qué se
diferencia de `sync`: el mismo payload, la intención opuesta.

| Módulo | Contenido |
|---|---|
| `backup/domain/replace.ts` | `replaceDataState` — ya estaba, adelantada en el paso 8a |
| `backup/application/build-backup.ts` | `buildBackup` (`Reader`) y `backupText` (`ReaderTask`) |
| `backup/application/read-backup.ts` | `readBackup`, `ReaderTaskEither` |
| `backup/store/backup-slice.ts` | `downloadBackup`, `copyBackup`, `readBackupFile`, `restoreBackup` |
| `backup/ui/components/BackupModal.tsx` | props → JSX, sin `FileReader` ni `navigator` |
| `backup/ui/containers/BackupContainer.tsx` | Partido en dos, como el de `sync` |

Decisiones:

- **Leer y aplicar son dos acciones, no una.** `receiveSync` funde en cuanto
  entiende el payload; restaurar pierde a propósito lo que había, así que entre
  leer el archivo y reemplazar va una confirmación. El caso de uso `readBackup`
  solo lee: devuelve el respaldo y no toca el store. Es la razón de que la
  feature no se pudiera resolver reusando el caso de uso de `sync`.
- **`backup` importa del `domain/` de `sync`, nunca de su `application/` ni de
  su `ui/`.** Por eso `backupText` no reusa `prepareShare` pese al parecido: un
  respaldo no lleva QR, ni delta, ni `device`, y cuando el navegador no comprime
  cae al JSON plano, donde `prepareShare` se queda sin texto a propósito.
- **`buildBackup` es `Reader` y no una función pura** porque el reloj entra por
  `Deps` — fecha el nombre del archivo y el `exportedAt`. Es el primer caso de
  uso del refactor que usa la forma más simple de las tres.
- **`backupText` devuelve `string | null`, no un `Either`.** Comprimir es lo
  único que puede fallar ahí, y el mensaje resultante ('No se pudo copiar.') es
  el mismo que el del portapapeles: un canal de error tipado distinguiría dos
  causas que el usuario ve idénticas. Reproduce el `try/catch` único del legacy.
- **`BackupOutcome` no se comparte con el `ReceiveOutcome` de `sync`** aunque
  tengan la misma forma. Hoistarlo a `shared/` acoplaría dos features por dos
  líneas de tipo; que dos slices coincidan en cómo le hablan a su UI es el
  patrón, no una abstracción que falte.
- **El componente no ve el respaldo leído, solo dos conteos.** `pending` es
  `{ transactions, accounts } | null`: la confirmación es lo único que enseña de
  él, y así el componente de renderizado no sabe qué es un payload.
- **Restaurar no deja lápidas.** Lo que se pierde no es un borrado que haya que
  propagar por sync, es otro dataset; el legacy tampoco las dejaba.
- **`DesktopShell` pierde además tres props que ya estaban muertas**
  (`installmentPlans`, `transactions`, `onCreateCategory`): las destructuraba y
  no las usaba desde que sus features se migraron. Baja de 29 props a 22.

14 tests nuevos: 6 de los casos de uso (que un respaldo nunca sea parcial, que
el texto comprimido vuelva al mismo payload, y las dos ramas de error de leer) y
8 de UI por el container, incluido el que separa esta feature de `sync` — leer
no aplica nada, y cancelar deja los datos como estaban. Total: **367 tests**,
con los 190 de regresión intactos. El legacy baja a 1598 líneas.

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
