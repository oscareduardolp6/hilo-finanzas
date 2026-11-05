---
status: pendiente
priority: 1
---

# Cuentas completas: agrupar los renglones de un ticket bajo un solo concepto

> Ojo con el nombre: aquí "cuenta" es la **cuenta del súper / del restaurante / de la compra** (el ticket completo), no una `Account` de Hilo (cartera, tarjeta, banco). En el código conviene llamarla `receipt` / `ticket` para no chocar con `accounts`.

## Problema que resuelve

Hoy un ticket con 30 artículos termina como 30 (o más) transacciones sueltas. El escaneo de tickets ([receipt-ocr.md](receipt-ocr.md)) genera un registro por renglón y, una vez guardados, **ya no hay forma de saber que venían del mismo ticket**: en el historial son 30 filas mezcladas con todo lo demás, el descuento del ticket es un `income` aparte en `Descuentos` sin vínculo con lo que descontó, y si quiero ver "cuánto fue la compra del sábado en Costco" tengo que sumar a mano.

Se pierde también la otra mitad del valor: al tener los renglones individuales (con `store`, `brand`, `size`, `quantity`) casi se puede hacer tracking de precios, pero sin un concepto que los agrupe y una vista por producto, no hay manera práctica de ver "la leche costaba $24 en marzo y hoy $29".

## Idea a alto nivel

Una **cuenta completa** (ticket) es una entidad de primer nivel que:

- Tiene su propio registro: tienda, fecha, cuenta de Hilo con la que se pagó, total pagado, y opcionalmente la foto/origen del escaneo.
- **Contiene** sus transacciones individuales (los renglones), que siguen siendo transacciones normales — cuentan en categorías, totales y balance exactamente como hoy.
- Se puede ver, editar y borrar **como un todo** (ver/abrir el ticket, borrar el ticket con sus renglones) o **renglón por renglón**.
- Agrupa también los descuentos: tanto los descuentos a nivel ticket como, idealmente, los de un renglón específico, para poder saber cuánto se ahorró en esa compra.

Vistas que habilita:

1. **Historial agrupado:** el ticket aparece como una sola fila expandible (tienda · fecha · total · # de artículos · ahorro) en vez de N filas sueltas. Al abrirla se ven los renglones.
2. **Detalle de ticket:** lista de renglones, descuentos, subtotal vs. total pagado, y si no cuadra, la misma advertencia no bloqueante que ya existe en la revisión del OCR.
3. **Seguimiento de precios por producto:** para un producto (nombre normalizado + marca/tamaño cuando existan) la historia de precios unitarios a lo largo de los tickets, por tienda; cuánto subió/bajó y dónde está más barato.
4. **Seguimiento de descuentos:** total ahorrado por ticket, por tienda y por periodo (se apoya en `Descuentos` y en `benefitProgramId` de [beneficios-tarjetas.md](beneficios-tarjetas.md)).

## Cómo encaja con lo que ya existe

- **Escaneo de tickets** (`src/features/receipt-ocr/`): hoy `handleAddReceiptTransactions` crea N transacciones + los `income` de descuento y se acaba ahí. Debe pasar a crear **primero el ticket** y luego sus renglones enlazados a él. Es el camino principal de entrada.
- **Captura manual:** también debe poderse armar un ticket a mano (agregar renglones a una cuenta abierta) y poder **agrupar a posteriori** transacciones ya existentes en un ticket, porque hay muchísimo dato histórico (incluido lo importado de Monefy) que son renglones huérfanos.
- **Campos de producto** (`size`/`brand`/`quantity`, ver [campos-producto-en-transferencia-gasto.md](campos-producto-en-transferencia-gasto.md)): son la base del tracking de precios; probablemente haya que agregar un campo de nombre de producto normalizado o apoyarse en `description`.
- **`taggedAsExpense` / MSI:** un ticket pagado con tarjeta de crédito genera renglones que pueden ser `expense` o `transfer` marcada como gasto; el ticket no debe asumir uno u otro.

## Notas de modelo y compatibilidad (leer antes de implementar)

Hilo tiene usuarios reales con datos escritos por builds anteriores en Firestore, y no hay forma de arreglárselos a mano (ver "Backward compatibility with saved data" en [CLAUDE.md](../CLAUDE.md)). Por eso:

- Los renglones siguen siendo `Transaction`; el vínculo es un campo **opcional** nuevo (p. ej. `receiptId?`) que cualquier lectura debe tolerar ausente. No cambiar el significado de ningún campo existente.
- Los tickets son una **séptima colección persistida** y debe tolerar estar ausente al cargar (hidratar a `[]`), y vivir en `OPTIONAL_SYNC_COLLECTIONS` de [src/shared/domain/export-payload.ts](../src/shared/domain/export-payload.ts), igual que se hizo con `benefitPrograms`. También entra en `persist`/la suscripción del store, en el respaldo y en `replaceDataState`.
- Como en las demás entidades: `createdAt`/`updatedAt`, y un tombstone al borrar.
- Probablemente sea una **feature propia** (`src/features/receipts/`: dominio, casos de uso, slice, UI) que otras features consumen solo por su `domain/` y sus `store/selectors`, siguiendo las cuatro reglas de la arquitectura en capas. `receipt-ocr` pasaría a depender de ella.
- Nada de esto cambia el balance: el balance sigue derivándose de las transacciones; el ticket no guarda totales que puedan desincronizarse (el total del ticket se **deriva** de sus renglones, igual que `computePlanProgress` o `computeAccountBalance`), salvo quizás el "total pagado" declarado, que se guarda solo para detectar discrepancias.

## Dudas abiertas

- ¿Qué pasa con el borrado? ¿Borrar el ticket borra sus renglones (con confirmación inline, como `confirmDelete`), o los desliga y los deja sueltos? Probablemente ambas opciones.
- ¿El descuento de ticket sigue siendo un `income` en `Descuentos` (como hoy, con `benefitProgramId` opcional) enlazado al ticket, o pasa a ser un renglón negativo del propio ticket? Lo primero conserva compatibilidad con el dato existente y con el cálculo de beneficios; hay que decidir cómo se muestra el descuento por renglón.
- Tracking de precios: ¿cómo se identifica "el mismo producto" entre tickets? ¿Normalizar `description` (sin acentos/mayúsculas, como `normalizeForSearch`), pedir al OCR un nombre canónico, o dejar que el usuario "vincule" renglones a un producto? Empezar simple (texto normalizado + marca/tamaño) y ver qué tan ruidoso sale.
- Precio unitario: ¿cómo se compara 2 piezas de $48 contra 1 pieza de $24 o gramajes distintos? Hay que decidir si se calcula `amount / quantity` y si se intenta normalizar por `size`.
- ¿Migrar el histórico? Agrupar transacciones viejas a un ticket ¿es solo manual, o hay heurística segura (misma tienda + misma fecha + mismo origen de escaneo)? Cualquier heurística automática sobre datos reales es riesgosa; mejor asistida con confirmación.
- ¿Se guarda la imagen del ticket? Hoy la foto solo se manda al OCR y se descarta; guardarla implica almacenamiento (Firestore tiene límite de 1 MB por documento y todo el estado vive en un solo doc), así que probablemente quede fuera de esta primera iteración.
- Vista de escritorio y móvil: la regla de los dos árboles dice que ambos montan los mismos containers y el container elige la vista con `desktop`, así que hay que diseñar las dos presentaciones (lista expandible en móvil, panel maestro-detalle en escritorio).
