# Plan: escaneo de tickets que genera un movimiento desglosado (y tickets de varias fotos)

Implementa [tasks/ocr-ticket-desglosado.md](../../tasks/ocr-ticket-desglosado.md). **Estado: implementado** (ver "Desviaciones respecto al plan" al final).

> Este plan es una foto del enfoque al momento de escribirlo. Si la implementación se desvía, o un cambio posterior toca el código que describe, **actualiza este archivo en el mismo cambio** (ver "Keeping specs and plans in sync with the code" en CLAUDE.md).

## Context

El escaneo de tickets (`src/features/receipt-ocr/`) tiene cuatro problemas que reportó el usuario:

1. **En el teléfono falla con "La clave de API no es válida."** (un 401 de Anthropic). La key se guarda por dispositivo (IndexedDB), así que la del teléfono es otra captura. Causas probables, todas del lado del campo de Ajustes ([SettingsModal.tsx](../../src/features/settings/ui/components/SettingsModal.tsx)):
   - es un `<input type="password">` sin `autoComplete="off"`: el gestor de contraseñas de Chrome Android puede autocompletarlo con una contraseña guardada, y además ofrece "guardar contraseña" con la key adentro;
   - no se ve lo que se pegó (campo de contraseña), así que una key truncada o con caracteres invisibles/espacios intermedios al copiar desde el teléfono pasa sin notarse — `cleanOcrSettings` solo hace `trim()`;
   - no hay forma de comprobar la key antes de escanear.
2. **Solo deja tomar la foto con la cámara**: el input tiene `capture="environment"`, que en Android abre directo la cámara sin opción de galería.
3. **Genera N movimientos sueltos** (uno por renglón + un `income` en "Descuentos"), cuando ya existe el desglose de un movimiento ([cuentas-completas-tickets.md](../../tasks/cuentas-completas-tickets.md)).
4. **Un ticket largo no cabe en una foto**, y al reducir una foto alta a 1600 px de lado largo el texto queda ilegible.

Decisiones confirmadas con el usuario:

- **Revisión = el formulario normal de "Nuevo movimiento"**, abierto ya lleno (total, tienda, fecha, categoría, y el desglose activado con artículos y descuentos). Mismo editor que la captura manual; una sola cuenta por ticket (ahí se elige gasto simple o transferencia marcada como gasto).
- **Reemplazar el modo viejo** (N movimientos + `income` en Descuentos). Los movimientos ya guardados con él no se tocan.
- **Modelo por defecto: `claude-haiku-5-5`** (lee a 2576 px de lado largo vs 1568 px de Haiku 4.5, y cuesta ~10× menos). Solo afecta a quien deja el campo de modelo vacío.
- Varias fotos por ticket; el modelo detecta el traslape entre fotos ("el corte") y no repite renglones.

## Diseño

### 1. La key en el teléfono (feature `settings` + `receipt-ocr`)

- `cleanOcrSettings` (ahora en [shared/domain/ocr-settings.ts](../../src/shared/domain/ocr-settings.ts), re-exportado por [save-ocr-settings.ts](../../src/features/settings/application/save-ocr-settings.ts)): la key pierde **todo** espacio en blanco e invisible, no solo en los bordes (`/[\s\u00A0\u200B-\u200D\u2060\uFEFF]/g`). Una key de Anthropic nunca lleva espacios, así que es seguro.
- Campo de la key en `SettingsModal`: `type="text"` enmascarado con `-webkit-text-security: disc` + botón ojo (mostrar/ocultar), `autoComplete="off"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`. Sin `type="password"` el gestor de contraseñas no lo toca.
- Botón **"Probar clave"**: `GET https://api.anthropic.com/v1/models/{modelo}` con los mismos headers del escaneo (gratis, sin foto). Resultado inline: "Clave válida · modelo disponible" / "La clave de API no es válida." / "El modelo «X» no existe." / "No hay conexión…". Puerto nuevo `verify` en `ReceiptGateway` ([ports.ts](../../src/features/receipt-ocr/domain/ports.ts)) + su doble en memoria; caso de uso `verifyOcrSettings` (`ReaderTaskEither`) en `receipt-ocr/application/`; acción `verifyOcrSettings(apiKey, model) → Promise<{ok, message}>` en `receipt-slice`, que el container de Ajustes llama (como `scanReceipt` hoy: el resultado vuelve al componente, no como toast).
- Mensaje del 401 al escanear: "La clave de API no es válida. Revisa la de este dispositivo en Ajustes (cada dispositivo guarda la suya)." y, junto al error en la hoja de escaneo, un botón "Ir a Ajustes".

### 2. La llamada al modelo ([anthropic.ts](../../src/features/receipt-ocr/infrastructure/anthropic.ts))

- `ScanReceiptRequest.images: EncodedImage[]` (antes `image`). El mensaje lleva, por cada foto, un texto `Foto i de N:` seguido del bloque `image` (patrón recomendado de la doc de visión), y al final el prompt.
- **Salida estructurada (`output_config.format` con `json_schema`) en vez de *forced tool use*.** `tool_choice: {type:'tool'}` da 400 en Opus 5.5 / Sonnet 5.5 / Fable 5.1 —modelos que el usuario puede escribir en Ajustes— y en Haiku 5.5 se salta el razonamiento; los JSON outputs funcionan en todos los modelos actuales, Haiku 4.5 incluido. El esquema conserva los campos de hoy (`store`, `date`, `ticketTotal`, `lineItems[{description, listPrice, quantity, categoryId}]`, `discounts[{label, amount}]`) y agrega `unitPrice` (nullable) por renglón; todos los objetos con `additionalProperties:false` y nulos vía `anyOf`. `categoryId` sigue siendo string libre validado en `buildReceiptDraft` (un `enum` por usuario rompería la caché del esquema). La respuesta se lee del bloque `text` con `JSON.parse`.
- Prompt nuevo, con la regla del corte: las fotos son partes consecutivas del **mismo** ticket, de arriba hacia abajo, y se enciman; los renglones del final de la foto N pueden reaparecer al inicio de la N+1 — alinear la secuencia de renglones en la zona de traslape (ej. si la foto 1 termina en "…, Leche, Bananas" y la foto 2 empieza "Leche, Bananas, Pan", los dos primeros ya se contaron y se sigue desde "Pan") y registrar cada renglón una sola vez; pero dos renglones idénticos que **no** están en la zona de traslape son dos compras y se conservan. Encabezado, total y descuentos se toman una vez para todo el ticket.
- `max_tokens: 16000` (antes 4096: un ticket de 40 artículos + razonamiento lo truncaba). Sin `effort` ni `thinking` (Haiku 4.5 da 400 con `effort`).
- Errores nuevos: `stop_reason: "max_tokens"` → "El ticket es demasiado largo para leerlo de una vez; intenta con menos fotos."; `"refusal"` o JSON inválido → el "No se pudo interpretar el ticket…" de hoy.
- `RECEIPT_MODEL_DEFAULT = 'claude-haiku-5-5'` ([config.ts](../../src/features/receipt-ocr/domain/config.ts)); texto de ayuda de Ajustes ajustado.

### 3. Las fotos ([image.ts](../../src/shared/infrastructure/image.ts) + hoja de escaneo)

- `downscaleImage(file, maxDim = 2576)` (el tope de Haiku 5.5; Haiku 4.5 lo reduce del lado del API). Si el navegador no pudo decodificar la foto y el tipo no es JPEG/PNG/GIF/WebP (p. ej. HEIC), `prepare` lanza "Formato de imagen no soportado; usa JPG o PNG." en vez de mandar algo que el API rechaza.
- Paso de captura del `ReceiptScanModal`:
  - Dos botones: **"Tomar foto"** (`capture="environment"`, una a la vez) y **"Elegir de la galería"** (sin `capture`, `multiple`). Ambos **agregan** a la lista; el input se resetea para poder volver a elegir.
  - Miniaturas numeradas en orden (1, 2, 3…) con botón de quitar; máximo `MAX_RECEIPT_PHOTOS = 8`.
  - Tip: "¿Ticket largo? Tómale varias fotos de arriba hacia abajo, dejando que se encimen un poco: Hilo junta los renglones repetidos."
  - Botón **"Leer ticket (N fotos)"**. Si falla, el error aparece y **las fotos se quedan** para reintentar.
- Los pasos `review`/`saving` desaparecen: la hoja queda en `capture | processing`.
- El container guarda los `File[]` y las URLs de miniatura (`URL.createObjectURL`, revocadas al quitar/desmontar) — borrador de UI, como hoy.

### 4. Del ticket leído al formulario (domain + application de `receipt-ocr`)

- `buildReceiptDraft` ([draft.ts](../../src/features/receipt-ocr/domain/draft.ts)) se queda como normalizador de lo que devuelve el modelo (los tests de regresión lo cubren); gana `unitPrice` por renglón.
- Nuevo `receiptToFormDraft(draft, { accounts, categories, newId })` en `receipt-ocr/domain/to-form.ts` (puro; reemplaza a `to-transactions.ts`), que parte de `initialFormState('expense', …)` ([form.ts](../../src/features/transactions/domain/form.ts)) y llena:
  - `date`, `store`, `description` = tienda (o "Ticket");
  - `amount` = `ticketTotal` si el modelo lo leyó, si no `Σ renglones − Σ descuentos`;
  - `categoryId` = la categoría con más monto entre los renglones (fallback: la primera de gasto);
  - `breakdown.items`: uno por renglón (`description`, `quantity`, `unitPrice`, `amount` = precio de lista; `categoryId: null` cuando coincide con la del movimiento, para que la herede y cambiarla arrastre a todos);
  - `breakdown.discounts`: uno por descuento (`label`, `amount`, `categoryId: null`, `benefitProgramId: null` — el programa se elige en el formulario con el `BenefitProgramPicker` que ya tiene).
  - ids `bitem_…` / `bdisc_…` con `deps.idGenerator` (por eso lo llama el caso de uso, no el render).
- `scanReceipt` ([scan-receipt.ts](../../src/features/receipt-ocr/application/scan-receipt.ts)) recibe `files: File[]`, prepara cada una, escanea una sola vez y devuelve el `TransactionFormDraft`.
- Cuadre: si los renglones suman menos que el total, la diferencia aparece como "Sin especificar" (ya lo hace el editor). Si suman **más** (renglón repetido que se le escapó al modelo, o total mal leído), el formulario ya bloquea guardar con su aviso; el usuario quita el repetido o corrige el total.
- Se borran `to-transactions.ts`, `review.ts`, `add-receipt-transactions.ts` y sus tests. El escaneo ya no crea la categoría "Descuentos": un descuento del desglose es ahorro, no ingreso.

### 5. Store y entrega al formulario

- `transactions-slice`: acción nueva `openPrefilledSheet(type, form)` — abre la hoja de alta (`editingId: null`) con un borrador dado. Genérica, no sabe de tickets.
- `receipt-slice.scanReceipt(files)`: corre el RTE; en `Right` cierra la hoja de escaneo y llama `get().openPrefilledSheet('expense', form)` en el mismo paso; en `Left` devuelve `{ ok:false, message }` a la hoja. `addReceiptTransactions` desaparece.
- `switchFormType` entre **gasto ↔ transferencia** conserva además `breakdown`, `store`, `date`, `description` y `categoryId`, y si hay desglose deja la transferencia ya marcada como gasto. Así un ticket escaneado pagado con tarjeta no se pierde al cambiar de pestaña. A ingreso solo se lleva el monto (como hoy). Esto también mejora la captura manual.
- Móvil y escritorio: sin cambios de cableado — los dos árboles ya montan `ReceiptScanContainer` y `AddTransactionContainer` y les pasan `desktop`.

## Archivos tocados

- `src/features/receipt-ocr/`: `domain/{config,draft,ports}.ts`, `domain/to-form.ts` (+test, nuevo), `application/scan-receipt.ts`, `application/verify-ocr-settings.ts` (nuevo), `infrastructure/{anthropic,browser-receipt-gateway,in-memory}.ts`, `store/receipt-slice.ts`, `ui/components/ReceiptScanModal.tsx`, `ui/containers/ReceiptScanContainer.tsx`, `ui/receipt-ocr.test.tsx`. Borrados: `domain/{to-transactions,review}.ts`, `domain/review.test.ts`, `application/add-receipt-transactions{,.test}.ts`.
- `src/features/transactions/store/transactions-slice.ts` (+ test de `switchFormType` en `ui/add-transaction.test.tsx`).
- `src/features/settings/application/save-ocr-settings.ts`, `ui/components/SettingsModal.tsx`, su container (cablear "Probar clave").
- `src/shared/infrastructure/image.ts`.
- `hilo-finanzas.jsx` (barrel) solo si cambia el origen de algún símbolo exportado.
- Regresión que cambia **a propósito** (es el checklist del cambio de comportamiento): `test/unit/receipt.test.js` (args `images: [...]`; el test del request pasa de `tool_choice` a `output_config.format` y de bloque `tool_use` a `text`) y `test/integration/receipt.test.jsx` (foto → "Leer ticket" → formulario lleno → guardar → una fila con "Desglose · 2 conceptos · Ahorro $5"). El resto de la suite no se toca.
- `CLAUDE.md` (escaneo = un movimiento desglosado, varias fotos, ya no crea `income` en Descuentos ni re-crea la categoría; Haiku 5.5 por defecto; salida estructurada), `agents/plans/receipt-ocr.md` (nota de que el diseño de salida lo reemplaza este plan), `agents/plans/ocr-ticket-desglosado.md` (este plan), `tasks/ocr-ticket-desglosado.md` (status + dudas resueltas), `tasks/README.md`.

## Verificación

- `npm test` y `npm run typecheck`. Tests nuevos/ajustados:
  - `to-form.test.ts`: total impreso vs. derivado, categoría dominante, renglones que heredan, descuentos como ahorro, ids del generador.
  - `receipt-ocr.test.tsx` (`renderFeature` + `fakeReceiptGateway`): tomar foto y elegir varias de galería se acumulan y se pueden quitar; se mandan todas en un solo `scan` y en orden; el error conserva las fotos y ofrece "Ir a Ajustes"; un escaneo exitoso cierra la hoja y deja el formulario abierto con el desglose.
  - `cleanOcrSettings` quita espacios intermedios/invisibles; "Probar clave" muestra cada resultado con el doble del gateway.
  - `switchFormType` gasto → transferencia conserva el desglose y lo deja marcado como gasto.
  - `anthropic.ts` (fetch mockeado): N imágenes con su etiqueta `Foto i de N:`, `output_config.format` en el body, `max_tokens` y `refusal` → mensajes.
- `npm run dev` en el navegador del panel, viewport móvil y ≥1024 px: con un `fakeReceiptGateway`-equivalente no hay forma de llamar a Anthropic sin key real, así que se verifica: la hoja de captura (dos botones, miniaturas, quitar, tope de 8, tip), "Probar clave" con una key falsa → "no es válida" (confirma además que el endpoint de modelos responde con CORS desde el navegador), y el formulario prellenado vía la acción del store. La lectura real de un ticket con varias fotos queda para que el usuario la pruebe en su teléfono con su key (se le dirá exactamente qué probar: key nueva + "Probar clave", ticket largo en 2–3 fotos con traslape).

## Desviaciones respecto al plan

- `cleanOcrSettings` se movió a `src/shared/domain/ocr-settings.ts`: lo usan `settings` (guardar) y `receipt-ocr` ("Probar clave", que prueba la key ya limpia), y una feature no puede importar la capa `application/` de otra. `save-ocr-settings.ts` lo re-exporta.
- La acción del slice devuelve `ReceiptOutcome` (`{ ok: true } | { ok: false, message }`), compartido por `scanReceipt` y `verifyOcrSettings`; el borrador ya no viaja al componente porque el store abre el formulario directamente.
- `ReceiptRow` conserva `accountId`/`included` aunque ya nadie los lee: son parte de la forma que fija `test/unit/receipt.test.js` para `buildReceiptDraft`.
- Las fotos se preparan una por una, no en paralelo: en un teléfono, decodificar varias fotos de 12 MP a la vez en `<canvas>` es lo que se queda sin memoria.
- `fakeReceiptGateway` registra además los nombres de archivo preparados (y los codifica en `data`) para poder asertar el orden de las fotos.
- Verificación en el navegador: con el `fetch` de la página sustituido por una respuesta simulada del modelo (ninguna llamada real a Anthropic): 2 fotos → request con `Foto 1 de 2:` / `Foto 2 de 2:`, `json_schema`, `claude-haiku-5-5`, `max_tokens: 16000` → formulario lleno y cuadrado ($283.40 − $20 = $263.40) → cambio a Transferencia conservando el desglose → guardado como una sola fila "Desglose · 5 conceptos · Ahorro $20.00". Escritorio y móvil. "Probar clave" no se probó con una key (no hay una real en el entorno); sí se comprobó que `GET /v1/models/{id}` responde con CORS desde el navegador (401 legible sin key). **Falta la prueba con un ticket real y la key del usuario.**
