---
status: implementada
priority: 16
---

# Ocultar / mostrar saldos

Un toggle para ocultar todos los montos de dinero de la UI (saldos, totales, montos de movimientos, progreso de MSI), dejándolos como `••••` o similar, y volver a mostrarlos.

## Problema que resuelve

Para tomar capturas de pantalla o enseñarle algo de la app a alguien sin que vea cuánto dinero tenemos. Hoy no hay forma: todo saldo y monto está siempre a la vista.

## Idea a alto nivel

- Un control rápido (ícono de ojo) para alternar "modo privado" on/off, probablemente en el header / sidebar.
- Con el modo activo, cada lugar que hoy imprime dinero (`formatMoney`, saldos de cuenta, totales de Inicio, montos en filas de Historial, `planProgress`, gráfica de gastos por categoría) muestra un placeholder en vez del número.
- La preferencia puede vivir solo en memoria (se reinicia al recargar) o persistirse como una más del blob de estado — a decidir.

## Dudas abiertas (resueltas)

- ¿Se oculta también en la vista de escritorio y en los modales, o solo en las vistas principales? → **Todo**, incluidos los modales secundarios (MSI, Beneficios, escaneo de tickets), tanto en móvil como en escritorio.
- ¿Qué pasa con la gráfica de dona de gastos por categoría? ¿Se oculta el monto pero se deja la proporción visual, o se difumina todo? → Se oculta solo el texto/monto (tooltip, texto central, leyenda); se conserva la forma de la dona y los porcentajes.
- ¿Persistir la preferencia o no? → Sí, en IndexedDB bajo su propia clave (mismo patrón que `OCR_SETTINGS_STORAGE_KEY`/`SYNC_STATE_STORAGE_KEY`), fuera del blob principal — no viaja en sync/QR/backup.
- ¿Un placeholder fijo (`••••`) o un blur sobre el texto real? → Placeholder fijo (`$••••`).

Ver [agents/plans/ocultar-saldos.md](../agents/plans/ocultar-saldos.md) para el diseño técnico.
