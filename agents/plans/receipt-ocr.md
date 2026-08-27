# Plan: Reconocimiento de tickets de súper (OCR con IA)

> Implementa [tasks/receipt-ocr.md](../../tasks/receipt-ocr.md). Ver la nota de sincronización en [CLAUDE.md](../../CLAUDE.md) — si el código diverge de lo aquí descrito, actualiza este documento en el mismo cambio.

## Context

Capturar a mano un gasto de súper con muchos artículos vía `AddTransactionSheet` es tedioso. La idea: tomarle foto al ticket y que la app extraiga los renglones para pre-llenar movimientos, dejando siempre que el usuario revise y edite antes de guardar.

Decisiones confirmadas con el usuario (conversación de planeación):

1. **OCR = API de visión de Anthropic (Claude), llamada directa desde el navegador** con una API key que el usuario pega en Ajustes. Se aceptó el trade-off de seguridad (la key vive en el cliente) a cambio de no montar backend. Mitigaciones acordadas: key dedicada solo para Hilo, límite de gasto mensual en la consola de Anthropic, key **excluida** de sync/QR/backup, y aviso claro en Ajustes.
2. **Un registro por renglón del ticket.** Todos los renglones más los descuentos deben cuadrar con el total pagado.
3. **El tipo de cada renglón se deriva de un toggle por cuenta, dentro de la revisión del ticket** (no se guarda en la cuenta, es solo para ese ticket). En la vista de revisión cada renglón se asigna a una cuenta; luego, por cada cuenta usada en el ticket, hay un toggle "Registrar como transferencia marcada como gasto". Ejemplo del usuario: en un mismo ticket pone unos renglones en la cuenta de vales con el toggle **apagado** (→ `expense`) y el resto en su cuenta de "ahorro para el súper" con el toggle **encendido** (→ `transfer` origen → esa cuenta, `taggedAsExpense`). Si al menos una cuenta tiene el toggle encendido, aparece un selector de "Cuenta de origen" (el `fromAccountId` de esas transferencias).
4. **Descuentos = ingreso en categoría "Descuentos".** Los renglones quedan a precio de lista y un `income` los compensa, dejando el balance neto correcto (subtotal − descuento = pagado). Un `income` por cada descuento distinto del ticket, con su descripción, para poder medir después cuánto se ahorró. Efecto conocido y aceptado: los totales de gasto por categoría quedan a precio de lista (algo inflados).
5. **La foto no se guarda** — solo vive en memoria durante el escaneo.
6. **Punto de entrada:** botón propio, aparte del de "nueva transacción", que abre una vista de revisión con las filas a agregar, editables individualmente, para dar el visto bueno. Aplica a móvil y escritorio (los dos árboles de componentes).
7. **El modelo de IA es configurable** (texto libre en Ajustes). Default `claude-haiku-4-5` (Haiku 4.5, con visión, mucho más barato que Sonnet para este uso; id sin sufijo de fecha, confirmado con la skill `claude-api`). El usuario puede escribir otro id si quiere más precisión.

Defaults que fija este plan:
- El `income` de descuento se acredita por default a la cuenta "principal" del ticket, con override por fila.
- El descuadre entre suma de filas y total del ticket es una **advertencia no bloqueante** (los tickets reales traen redondeos).

Todo el trabajo de producto vive en **[hilo-finanzas.jsx](../../hilo-finanzas.jsx)** (componente único), como el resto de Hilo.

## Diseño

> Antes de escribir el código que llama a la API de Anthropic, revisar la skill `claude-api` para confirmar el id de modelo vigente de Haiku, los headers exactos (incl. `anthropic-dangerous-direct-browser-access`), el formato del bloque `image` base64 y la forma de *forced tool use*.

### 1. Datos estáticos (sección 1, junto a `DEFAULT_INCOME_CATEGORIES` / `ACCOUNT_TYPES`)

- Agregar a `DEFAULT_INCOME_CATEGORIES`: `{ id: 'descuentos', name: 'Descuentos', icon: 'Ticket', color: '#6FA8A0' }` (icono `Ticket` ya está en `ICONS`). Para instalaciones nuevas.
- Constantes nuevas: `RECEIPT_MODEL_DEFAULT = 'claude-haiku-4-5-20251001'`, `ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'`, `OCR_SETTINGS_STORAGE_KEY = 'hilo_receipt_ocr_settings'`.
- Importar `ScanLine` de `lucide-react` en el bloque de imports (botón de entrada + header del modal).

### 2. Persistencia de la config de OCR (sección junto a `loadState`/`saveState`)

- `async function loadOcrSettings()` → `objectStore(STORE_NAME).get(OCR_SETTINGS_STORAGE_KEY)`, devuelve `{ apiKey, model } | null`.
- `async function saveOcrSettings(next)` → `put(next, OCR_SETTINGS_STORAGE_KEY)`; si `!next.apiKey && !next.model` → `delete(OCR_SETTINGS_STORAGE_KEY)`.
- **Clave separada dentro del mismo object store `state`**, nunca dentro del blob `STORAGE_KEY`. Por eso `buildExportPayload` (línea ~278), `mergeDataState`, `replaceDataState`, `SyncModal` y `BackupModal` **no se tocan**: la key y el modelo quedan fuera de sync/QR/backup por construcción.

### 3. OCR: helpers nuevos (sección nueva tras el bloque de helpers de Monefy)

- `downscaleImage(file, maxDim = 1600)` → `Promise<Blob>` vía `<canvas>` — baja peso/costo y respeta límites de imagen de la API.
- `fileToBase64(blob)` → `Promise<{ media_type, data }>` con `FileReader.readAsDataURL`, recortando el prefijo `data:`.
- `RECEIPT_TOOL` — definición de tool para *forced tool use* (salida estructurada fiable). `input_schema`:
  - `store: string`, `date: string` (`YYYY-MM-DD` o `""`), `currency: string`
  - `lineItems: [{ description: string, listPrice: number, quantity: number|null, categoryId: string|null }]` — `categoryId` obligado a ser uno de los ids de categoría de gasto que se le pasan, o `null`.
  - `discounts: [{ label: string, amount: number }]` — montos positivos, descuentos/ahorros a nivel ticket.
  - `ticketTotal: number` — total pagado tal cual impreso.
- `async function scanReceipt({ apiKey, model, image, expenseCategories })`:
  - `fetch(ANTHROPIC_API_URL, { method:'POST', headers:{ 'content-type':'application/json', 'x-api-key': apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' }, body: JSON.stringify({ model: (model || RECEIPT_MODEL_DEFAULT), max_tokens: 4096, tools:[RECEIPT_TOOL], tool_choice:{ type:'tool', name:'emit_receipt' }, messages:[{ role:'user', content:[ { type:'image', source:{ type:'base64', media_type, data } }, { type:'text', text: prompt } ] }] }) })`.
  - `prompt`: ticket de súper mexicano, montos en MXN; devolver cada artículo con su precio **antes** de descuentos a nivel ticket; listar descuentos/ahorros del ticket aparte como montos positivos; dar el total impreso; elegir `categoryId` solo de esta lista `<id — nombre>`; `date` en ISO o `""`.
  - Respuesta: buscar el bloque `tool_use` en `content`, devolver su `input`.
  - Errores tipados: 401 → "La clave de API no es válida."; 429 → "Se alcanzó el límite de uso de tu cuenta de API."; otro !ok → "El servicio de OCR falló (código N)."; fallo de red → "No hay conexión para leer el ticket."; sin `tool_use` → "No se pudo interpretar el ticket, intenta con otra foto.".
- `function buildReceiptDraft(scan, { expenseCategories }) → { store, date, rows, discounts, ticketTotal, sums }`:
  - `rows`: `scan.lineItems` → `{ id: uid('rrow'), description, amount: listPrice, quantity, categoryId: <id válido> || expenseCategories[0].id, included: true, accountId: null /* hereda principal */, viaTransfer: false }`.
  - `discounts`: `scan.discounts` → `{ id: uid('rdsc'), label, amount, included: true, accountId: null }`.
  - `date`: ISO válido de `scan.date`, si no `todayIso()`.
  - `sums`: getter en el componente — `sumRows`, `sumDiscounts`, `net = sumRows - sumDiscounts`, `mismatch = Math.abs(net - ticketTotal) > 0.5`.

### 4. `ReceiptScanModal` (componente nuevo, justo después de `MonefyImportModal`)

`ReceiptScanModal({ accounts, categories, apiKey, model, knownStores, onClose, onConfirm, onOpenSettings, desktop })`, montado sobre `SheetOverlay` (mismo shell que los demás modales, respeta `desktop`).

Estado: `step: 'capture' | 'processing' | 'review' | 'saving'`, `error`, `draft`, y estado de revisión: `store`, `date`, `primaryAccountId` (default `accounts[0]`), `accountModes` (`{ [accountId]: boolean }`, default `{}` — el toggle "vía transferencia" por cuenta, con alcance solo este ticket), `originAccountId` (default `accounts[1] || accounts[0]`), `rows` (copia mutable de `draft.rows`; cada fila lleva `accountId`), `discounts` (copia mutable).

- **Sin `apiKey`**: `step='capture'` muestra solo un texto ("Necesitas configurar tu API key de Anthropic") y un botón → `onOpenSettings()`.
- **capture**: drop-zone con `<input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile}>` — mismo patrón visual que el paso `upload` de `MonefyImportModal` (línea ~2364). Texto: la imagen se envía a la API de Anthropic con tu key; nada pasa por un servidor del proyecto. Al elegir: `downscaleImage` → `fileToBase64` → `step='processing'`.
- **processing**: spinner "Leyendo el ticket…"; llama `scanReceipt`; ok → `buildReceiptDraft` → `review`; error → vuelve a `capture` con `error`.
- **review**:
  - Tienda (`<input type="text">`) y fecha (`<input type="date">`) editables.
  - Fila de chips "Cuenta principal" — cuenta por defecto de cada renglón. Reusar el patrón de chips horizontales de `AddTransactionSheet` (líneas ~1912–1948).
  - Lista de renglones: por fila → checkbox incluir/quitar (patrón de la revisión de Monefy), `description` (input) y `amount` (input con `$`); y, si está incluida, un `<select>` de categoría de gasto + un `<select>` de cuenta (opción "Principal · …" = heredar) + badge de tipo resultante ("Gasto" o "Transferencia · gasto" según `accountModes[rowAccountId]`). Se usan `<select>` nativos en vez de `CategoryPicker` para mantener las filas compactas en un ticket de 20+ artículos; si la IA devuelve un `categoryId` inválido, `buildReceiptDraft` ya lo cae a la primera categoría de gasto.
  - Sección **"Cuentas de este ticket"**: para cada cuenta distinta asignada a un renglón incluido, una fila con el nombre de la cuenta + toggle "Registrar como transferencia marcada como gasto" (patrón de switch de `AddTransactionSheet`, línea ~1987) que escribe `accountModes[accountId]`. Alcance: solo este ticket, no toca el objeto cuenta.
  - Si algún `accountModes[...]` está activo → fila de chips "Cuenta de origen" (el `fromAccountId` común de todas las transferencias).
  - Sección "Descuentos": por descuento → `label` (input) + `amount` (input `$`) + chips de cuenta + toggle. Botón "+ Agregar descuento" para uno manual. Nota: "Se registran como ingreso en la categoría Descuentos".
  - Tarjeta de totales: `Suma de artículos $X − Descuentos $Y = $Z` vs `Total del ticket $T`; si `mismatch`, línea ámbar "La suma no cuadra con el total del ticket; revisa los montos." (no bloquea).
  - Dos botones: **"Descartar"** (secundario) → `onClose()` sin guardar nada — pensado para probar el reconocimiento sin registrar; y **"Agregar N movimientos"** → `step='saving'` → `onConfirm(payload)` → `onClose()`. La X del header y tocar fuera del sheet también descartan (nada se persiste hasta `onConfirm`).
  - El CTA de agregar se deshabilita si hay alguna cuenta en modo transferencia y no hay `originAccountId` elegido, o si no hay ninguna fila/descuento incluido.
- `payload` a `onConfirm`: `{ date, store, originAccountId, rows: [{ description, amount, categoryId, accountId, quantity, viaTransfer: !!accountModes[accountId] }], discounts: [{ label, amount, accountId }] }` (solo los `included`).

### 5. Wiring en `App`

- Estado nuevo: `const [ocrSettings, setOcrSettings] = useState({ apiKey: null, model: '' })`, `const [receiptModalOpen, setReceiptModalOpen] = useState(false)`.
- En el efecto de mount (junto a `loadState()`): `loadOcrSettings().then(s => { if (s) setOcrSettings(s); }).catch(() => {})`. **No** se añade al `useEffect` que persiste las 5 colecciones.
- `handleSaveOcrSettings(next)`: `saveOcrSettings(next)` + `setOcrSettings(next)` + `setToast(next.apiKey ? 'Config de escaneo guardada' : 'API key eliminada')`.
- `handleAddReceiptTransactions(payload)`:
  1. Asegurar categoría "Descuentos" de tipo `income`: `categories.find(c => c.type==='income' && c.name.trim().toLowerCase()==='descuentos')`; si falta, crear `{ id: uid('cat'), name:'Descuentos', icon:'Ticket', color:'#6FA8A0', type:'income', createdAt, updatedAt }` con `setCategories(prev => [...prev, cat])` (solo si hay descuentos incluidos).
  2. Por cada `row`: si `row.viaTransfer` → registro `transfer` `{ type:'transfer', fromAccountId: payload.originAccountId, toAccountId: row.accountId, taggedAsExpense:true, categoryId: row.categoryId, installmentPlanId:null, store: payload.store||null, size:null, brand:null, quantity: row.quantity||null, amount, date: payload.date, description: row.description }`. Si no → registro `expense` `{ type:'expense', accountId: row.accountId, categoryId: row.categoryId, store: payload.store||null, installmentPlanId:null, size:null, brand:null, quantity: row.quantity||null, amount, date: payload.date, description: row.description }`. (Formas espejo de `handleSaveTransaction`, líneas ~3199–3223.)
  3. Por cada `discount`: registro `income` `{ type:'income', accountId: discount.accountId, categoryId: discountCat.id, amount, date: payload.date, description: discount.label || 'Descuento' }`.
  4. `setTransactions(prev => [...prev, ...built.map(t => ({ ...t, id: uid('txn'), createdAt: Date.now(), updatedAt: Date.now() }))])`.
  5. `setToast(`${built.length} movimientos agregados desde el ticket`)`.
- **Entrada móvil**: botón circular secundario arriba del FAB `+` (línea ~3525). `w-11 h-11`, icono `ScanLine`, `right-5`, `bottom` ~150, `backgroundColor: COLORS.surface` + borde (estilo secundario), `onClick={() => setReceiptModalOpen(true)}`.
- **Entrada escritorio**: en `DesktopSidebar` (línea ~1535), botón secundario bajo "Nueva transacción": "Escanear ticket" con `ScanLine`. Nuevo prop `onScanReceipt`, propagado por `DesktopShell` (destructuring de props ~2858 + JSX del sidebar ~2884) desde `App` (`<DesktopShell ... onScanReceipt={() => setReceiptModalOpen(true)} />`).
- **Render del modal en los dos árboles** (espejo de cómo se monta `MonefyImportModal`: móvil ~3581, escritorio ~3006):
  ```jsx
  {receiptModalOpen && (
    <ReceiptScanModal
      accounts={accounts} categories={categories}
      apiKey={ocrSettings.apiKey} model={ocrSettings.model} knownStores={knownStores}
      onClose={() => setReceiptModalOpen(false)}
      onConfirm={handleAddReceiptTransactions}
      onOpenSettings={() => { setReceiptModalOpen(false); setSettingsOpen(true); }}
      /* desktop  <- solo en el árbol de escritorio */
    />
  )}
  ```

### 6. `SettingsModal` — sección de escaneo de tickets

Props nuevos: `ocrSettings`, `onSaveOcrSettings`. Bloque nuevo (junto al botón de Monefy, línea ~2832):
- Card "Escaneo de tickets (IA)".
- Texto de ayuda: la key se guarda solo en este dispositivo, se envía directo a Anthropic junto con la foto, **no** se incluye en sincronización ni respaldos; se recomienda una key dedicada con límite de gasto mensual. URL en texto plano: `https://console.anthropic.com/settings/keys` (no se abre sola).
- `<input type="password">` (estado local sembrado de `ocrSettings.apiKey`, placeholder `sk-ant-...`).
- `<input type="text">` para el modelo (estado local sembrado de `ocrSettings.model`, placeholder `claude-haiku-4-5`, ayuda: "Déjalo vacío para usar el modelo por defecto (Haiku, más barato). Puedes poner otro id si quieres más precisión.").
- Botón "Guardar" → `onSaveOcrSettings({ apiKey: keyVal.trim(), model: modelVal.trim() })`. Botón "Quitar" (si hay key) → `onSaveOcrSettings({ apiKey:'', model:'' })`.
- Indicador enmascarado cuando hay key (`•••• ` + últimos 4).
- Propagar `ocrSettings` + `onSaveOcrSettings={handleSaveOcrSettings}` en los dos render de `<SettingsModal>` (móvil ~3577, escritorio ~3002).

## Archivos tocados

- **[hilo-finanzas.jsx](../../hilo-finanzas.jsx)** — todo lo anterior: constantes + `Descuentos` en defaults + import `ScanLine`; `loadOcrSettings`/`saveOcrSettings`; helpers `downscaleImage`/`fileToBase64`/`scanReceipt`/`buildReceiptDraft` + `RECEIPT_TOOL`; componente `ReceiptScanModal` (toggle de tipo por cuenta dentro del ticket y botón "Descartar"); estado y handlers en `App`; botón de entrada en móvil y en `DesktopSidebar` (+ prop por `DesktopShell`); sección de escaneo en `SettingsModal`. Sin cambios al modelo de cuenta.
- **agents/plans/receipt-ocr.md** — este plan (archivo nuevo).
- **tasks/receipt-ocr.md** — frontmatter `status`: `pendiente` → `en-progreso` (al empezar) → `implementada` (al cerrar).
- **tasks/README.md** — fila de la tabla de "Reconocimiento de tickets de súper" → estado correspondiente.
- **[CLAUDE.md](../../CLAUDE.md)** — bajo "Product direction": nota de que el escaneo de tickets es la única función que llama a una API externa (Anthropic) con key + modelo provistos por el usuario, guardados localmente y excluidos de sync/backup — no hay servidor del proyecto, pero deja de ser cierto que "nada sale del navegador". Añadir `ReceiptScanModal` a la lista de modales, `loadOcrSettings`/`saveOcrSettings` a la nota de persistencia, y la categoría `Descuentos` (income) + el modelado "descuento = ingreso" al modelo de dominio.

## Verificación (`npm run dev`, ver [README.md](../../README.md))

Probar en viewport de escritorio (≥1024) y en uno móvil (devtools):

1. Ajustes → "Escaneo de tickets": pegar una key real, dejar el modelo vacío, Guardar; recargar → persiste (indicador enmascarado). "Quitar" → desaparece tras recargar.
2. Sin key: tocar el botón de escaneo → el modal explica que falta la key y el botón lleva a Ajustes.
3. Con key: botón de escaneo → paso captura → elegir foto de un ticket real de súper (en teléfono abre cámara por `capture="environment"`; en escritorio, selector de archivo).
4. Processing → review: verificar tienda, fecha, renglones con categorías razonables, descuentos listados aparte, tarjeta de totales `suma − descuentos = net` vs total del ticket.
5. Editar el monto de un renglón hasta descuadrar → aparece advertencia ámbar, sigue guardable. Corregir → desaparece.
6. "Cuenta principal" = cuenta de débito/vales, su toggle "vía transferencia" **apagado** → confirmar → se crean N `expense` en esa cuenta + 1 `income` por descuento en "Descuentos"; el balance de la cuenta baja exactamente lo pagado (subtotal − descuento).
7. Repetir dejando la cuenta principal con su toggle **encendido** y eligiendo "Cuenta de origen" → los renglones se crean como `transfer` (origen → esa cuenta, `taggedAsExpense: true`); `totalBalance` no cambia, el gasto por categoría sí refleja los artículos.
8. Mixto: mover 2 renglones a la cuenta de vales (toggle apagado) y el resto a la cuenta de "ahorro para el súper" (toggle encendido) → los 2 se crean como `expense` y el resto como `transfer` desde la cuenta de origen.
9. **Descartar**: escanear, llegar a revisión, tocar "Descartar" (y por separado la X / tocar fuera) → no se crea ninguna transacción, el conteo del historial no cambia.
10. Modelo: escribir un id inválido en Ajustes → el escaneo falla con mensaje de error; borrarlo → vuelve al default y funciona.
11. Respaldo (Ajustes → Respaldo de datos → exportar): el JSON exportado **no** contiene la API key ni el modelo. Igual para el payload de "Sincronizar dispositivos".
12. Errores: key inválida → "clave no válida"; sin conexión → error de red; ambos regresan al paso de captura sin romper la app.
13. Categoría en usuario existente: en un perfil sin "Descuentos", el primer escaneo con descuento la crea una sola vez; un segundo escaneo la reutiliza (sin duplicar).

Casos borde: ticket sin descuentos (no se crean `income` ni la categoría "Descuentos"); `categoryId` devuelto por la IA que no existe → el renglón cae en la primera categoría de gasto sin romper; alguna cuenta en modo transferencia sin "cuenta de origen" elegida → el CTA de agregar se bloquea hasta elegirla; ticket largo (20+ artículos) hace scroll dentro del sheet; imagen basura/vacía → error controlado.
