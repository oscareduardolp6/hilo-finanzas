---
status: pendiente
priority: 6
---

# Métricas / analíticas de uso de la web

Agregar alguna forma de saber cuánta gente visita y usa Hilo — hoy no hay ningún dato de tráfico ni de uso.

## Problema que resuelve

No hay visibilidad de nada: ni cuánta gente entra a la app, ni qué tanto la usa, ni qué tan seguido vuelve. Sin eso es imposible tomar decisiones informadas sobre hacia dónde llevar el producto, y es un prerequisito para poder validar cosas como [validar-disposicion-a-pagar.md](validar-disposicion-a-pagar.md) (no se puede medir interés en pagar si no se puede medir nada).

## Idea a alto nivel

- Integrar una herramienta de analíticas web para trackear visitas y, más adelante, eventos de producto clave (p. ej. cuántos usuarios crean su primera transacción, usan sync, exportan backup, etc.).
- Herramientas típicas: algo privacy-friendly tipo Plausible/Umami (self-hosted o cloud), o algo más estándar tipo Google Analytics.

## Dudas abiertas

- Esto es una excepción más al principio de "nada sale del navegador salvo la foto del ticket en `ReceiptScanModal`" (ver sección "Product direction" de [CLAUDE.md](../CLAUDE.md)) — habría que documentar esta nueva excepción igual que se documentó la de OCR.
- ¿Qué herramienta elegir? Trade-off entre privacidad (dado que Hilo maneja datos financieros personales, aunque las analíticas de uso no deberían tocar esos datos), costo, y facilidad de integración en una SPA sin backend propio.
- ¿Solo pageviews/visitas, o también eventos de producto? Si es lo segundo, definir cuáles valen la pena desde el inicio.
- Consideraciones de aviso de privacidad / cookies si aplica según la herramienta elegida.
