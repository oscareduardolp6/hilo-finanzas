---
status: pendiente
priority: 5
---

# Reconocimiento de tickets de súper

Registrar un gasto a mano (monto, categoría, tienda) es el flujo actual vía `AddTransactionSheet` en [hilo-finanzas.jsx](../hilo-finanzas.jsx). Para compras de súper con muchos artículos, esto es tedioso.

## Idea

Poder tomarle foto (o subir imagen) a un ticket de súper y que la app extraiga automáticamente monto total, tienda y fecha para pre-llenar el formulario de gasto, en vez de capturarlo todo a mano.

## Abierto / por decidir

- Cómo/dónde correr el OCR: ¿en el navegador (sin backend, alineado con la dirección de SPA local en [CLAUDE.md](../CLAUDE.md)) o llamando a algún servicio externo? Esto último implicaría agregar el primer "backend" del proyecto, que hoy explícitamente no existe.
- Si vale la pena desglosar por artículo/categoría o basta con capturar el total y la tienda.
- Qué hacer cuando el reconocimiento falla o es ambiguo (¿siempre dejar editar antes de guardar?).
