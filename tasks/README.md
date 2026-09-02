# Tasks

Ideas y funcionalidades que queremos agregar a Hilo, una por archivo. No es un backlog formal con prioridades ni fechas — solo un lugar para anotar la idea antes de que se nos olvide y darle contexto a quien la vaya a implementar (humano o Claude).

## Tasks

| Task | Prioridad | Status |
| --- | --- | --- |
| [Visualización de escritorio](desktop-view.md) | 1 | Implementada |
| [Migrar a IndexedDB (o similar) para guardado local](local-storage-migration.md) | 2 | Implementada |
| [Instalar como PWA](pwa-install.md) | 3 | Implementada |
| [Buscador en el historial](buscador-historial.md) | 3 | Implementada |
| [Conservar el monto al cambiar entre gasto / ingreso / transferencia](cantidad-persiste-al-cambiar-tipo.md) | 4 | Implementada |
| [Sincronizar escritorio y móvil](desktop-mobile-sync.md) | 4 | Implementada |
| [Sincronización incremental (delta) entre dispositivos](sync-incremental.md) | 5 | Implementada |
| [Campos de producto en transferencias marcadas como gasto](campos-producto-en-transferencia-gasto.md) | 5 | Implementada |
| [Modo de presupuesto](budget-mode.md) | 5 | Pendiente |
| [Importar backups de Monefy](monefy-import.md) | 6 | Implementada |
| [Convención de Oscar en la importación de Monefy](monefy-import-oscar-convention.md) | 6 | Implementada |
| [Reconocimiento de tickets de súper](receipt-ocr.md) | 7 | Implementada |
| [Agregar testing](testing.md) | 8 | Implementada |
| [Buscador de cuentas](buscador-de-cuentas.md) | 9 | Implementada |
| [Caso especial para gastos de gasolina](gasolina-tracking.md) | 15 | Pendiente |
| [Ocultar / mostrar saldos](ocultar-saldos.md) | 16 | Pendiente |
| [Refactorizar hacia una arquitectura en capas](layered-architecture.md) | 20 | Pendiente |

## Formato

Cada archivo lleva un frontmatter con dos propiedades:

```yaml
---
status: pendiente   # pendiente / en-progreso / implementada
priority: 1         # número entero, 1 = más urgente
---
```

Debajo del frontmatter, el contenido es libre, pero conviene incluir: qué problema resuelve, cómo se vería a alto nivel, y cualquier duda abierta o decisión pendiente. Si cambias `status` o `priority` de una task, actualiza también la tabla de arriba.
