---
status: pendiente
priority: 25
---

# Chat de Telegram para registrar gastos

Poder crear gastos mandando un mensaje a un bot de Telegram, sin abrir la app.

## Problema que resuelve

Registrar un gasto siempre requiere abrir Hilo. Un bot de Telegram permitiría mandar un mensaje de texto (p. ej. "150 en el súper") y que se registre como transacción directamente desde el chat.

**Nota:** el propio Oscar no está seguro de qué tanto valor aporta esto sobre simplemente abrir la app, o sobre el input de voz tipo Ramble ([captura-por-voz.md](captura-por-voz.md)). Por eso queda como la prioridad más baja del backlog — vale la pena revisitarla solo si de verdad se extraña ese flujo en el uso diario.

## Idea a alto nivel

- Un bot de Telegram que reciba mensajes de texto (o voz) y los traduzca en transacciones dentro de Hilo.

## Dudas abiertas

- Esto **requiere backend**: un bot de Telegram necesita un servidor que reciba los webhooks de la API de Telegram y tenga forma de escribir en el estado del usuario. Choca directamente con el enfoque actual de "client-only, sin backend" (ver sección "Product direction" de [CLAUDE.md](../CLAUDE.md)) — sería la primera pieza de infraestructura de servidor propia del proyecto, no solo una llamada directa a una API externa como hace `ReceiptScanModal`.
- ¿Cómo se autentica/vincula una cuenta de Telegram con los datos locales de un dispositivo, si todo el estado vive en el IndexedDB del navegador de ese usuario y no hay backend que lo centralice?
- Antes de invertir en esto, tendría sentido validar la necesidad real (¿se usaría más que el input de voz o que abrir la app?) — posiblemente informado por [analiticas-web.md](analiticas-web.md) una vez exista.
