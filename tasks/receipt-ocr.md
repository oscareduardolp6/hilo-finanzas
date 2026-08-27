---
status: implementada
priority: 7
---

# Reconocimiento de tickets de súper

Registrar un gasto a mano (monto, categoría, tienda) es el flujo actual vía `AddTransactionSheet` en [hilo-finanzas.jsx](../hilo-finanzas.jsx). Para compras de súper con muchos artículos, esto es tedioso.

## Idea

Poder tomarle foto (o subir imagen) a un ticket de súper y que la app extraiga automáticamente monto total, tienda y fecha para pre-llenar el formulario de gasto, en vez de capturarlo todo a mano.

## Abierto / por decidir — resuelto

Ver el detalle y el diseño en [agents/plans/receipt-ocr.md](../agents/plans/receipt-ocr.md).

- **OCR:** API de visión de Anthropic (Claude), llamada directa desde el navegador con una API key + modelo que el usuario pega en Ajustes (default `claude-haiku-4-5`). Sin backend del proyecto; la key vive solo en este dispositivo y se excluye de sync/QR/respaldo. Es la única función de Hilo que manda datos fuera del navegador.
- **Desglose:** un registro por renglón del ticket. El tipo de cada renglón (gasto simple vs. transferencia marcada como gasto) se decide con un toggle por cuenta dentro de la revisión del ticket. Los descuentos se registran como `income` en la categoría "Descuentos" (renglones a precio de lista), lo que además deja medir cuánto se ahorró.
- **Fallo / ambigüedad:** siempre hay una vista de revisión con todo editable fila por fila antes de guardar, más un botón "Descartar"; si la suma no cuadra con el total del ticket sale una advertencia no bloqueante. Los errores de la API (clave inválida, sin conexión, etc.) regresan al paso de captura con un mensaje.
