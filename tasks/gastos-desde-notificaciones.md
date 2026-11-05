---
status: pendiente
priority: 14
---

# Reaccionar a gastos detectados en notificaciones

Que la app detecte gastos a partir de las notificaciones del teléfono (banco, tarjeta, apps de pago) y reaccione: proponga registrarlos como transacción, o los guarde como pendientes, sin que el usuario tenga que capturarlos de memoria.

## Origen de la idea

Salió de este post de Instagram: <https://www.instagram.com/p/DeTfMJmsj1G/?psln=cGdkcXp5dWc4c3cw>

## Problema que resuelve

Un cargo con tarjeta genera una notificación del banco casi al instante ("Compra por $245.00 en OXXO con tu tarjeta terminación 1234"), pero registrarlo en Hilo depende de que el usuario se acuerde y abra la app. Esa notificación ya trae lo esencial — monto, comercio, a veces tarjeta y fecha — así que capturarlo a mano es trabajo repetido, y lo que se olvida simplemente se pierde.

## Idea a alto nivel

- Leer las notificaciones entrantes de apps configuradas (banco, wallet) y extraer monto, comercio y tarjeta/cuenta con reglas por emisor (los textos de cada banco son distintos y estables) y, opcionalmente, con ayuda de un modelo para los formatos que las reglas no cubran.
- Reaccionar con una de estas salidas, a decidir:
  1. **Notificación de Hilo con acción rápida** ("Registrar $245 · OXXO") que abre `AddTransactionSheet` prellenado, o la guarda con un toque.
  2. **Gasto pendiente** que se acumula para el flujo de [consolidar-gastos-pendientes.md](consolidar-gastos-pendientes.md) — esa tarea define qué hacer con los pendientes; esta define **cómo se detectan**. Conviene diseñarlas juntas (el "pendiente" es el contrato entre ambas).
- Nunca registrar nada solo sin que el usuario lo confirme, al menos al inicio: un parseo equivocado ensucia el balance.
- Deduplicar: si el usuario ya capturó ese gasto a mano, o llega la notificación dos veces (compra + confirmación), no debe duplicarse.

## Dudas abiertas

- **Requiere app nativa.** Leer notificaciones del sistema no es posible desde una PWA; en Android implica un `NotificationListenerService` (con permiso especial que el usuario concede a mano) y en iOS directamente no hay equivalente. Depende de [app-movil-nativa.md](app-movil-nativa.md), que hoy es prioridad baja — esta tarea no puede arrancar antes, o hay que subir la prioridad de esa. Alternativas sin app nativa: reenviar los correos/SMS del banco a algún lado, o atajos del sistema (Shortcuts en iOS, Tasker/MacroDroid en Android) que llamen a Hilo.
- **Privacidad:** leer notificaciones es acceso muy sensible. El procesamiento debería ser local al dispositivo, filtrar solo las apps que el usuario elija y no guardar ni subir el texto crudo de la notificación (si hubiera que mandar texto a una API de modelo, como `ReceiptScanModal` hace con la imagen, debe ser opt-in y explícito).
- ¿Dónde viven los pendientes? Hoy los datos persisten en un único documento de Firestore por usuario; una colección nueva (`pendingExpenses`) debe tolerar estar ausente al cargar, como el resto (ver "Backward compatibility" en [CLAUDE.md](../CLAUDE.md)).
- ¿Cómo se mapea "tarjeta terminación 1234" a una `Account` de Hilo? Probablemente un campo opcional nuevo en la cuenta (últimos 4 dígitos) o una tabla de equivalencias configurable.
- Cargos que no son gasto (abonos, devoluciones, retiros, transferencias propias): ¿se ignoran, o se proponen como `income`/`transfer`?
- Fiabilidad: Android puede matar el servicio en segundo plano por ahorro de batería; hay que medir cuántas notificaciones se pierden antes de confiar en el flujo.
