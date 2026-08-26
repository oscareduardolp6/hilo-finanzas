---
status: implementada
priority: 6
---

# Convención de Oscar en la importación de Monefy

Extensión de [Importar backups de Monefy](monefy-import.md): reconocer, de forma opcional, dos convenciones personales que Oscar usaba en la descripción de sus movimientos de Monefy, para que se traduzcan en algo mejor que texto plano al migrar.

## Idea

En su CSV de Monefy, Oscar anotaba manualmente dos cosas dentro del campo `description`:

1. **Fracciones de pago** entre paréntesis o corchetes, ej. `Televisión (0.5/12)` — representa el progreso de una compra a meses (él hace cuentas quincenales, así que un pago quincenal cuenta como medio "mes"). Cuando el numerador salta directo al denominador (ej. de `2/6` a `6/6`), significa que liquidó el saldo restante de una sola vez.
2. **Campos separados por guion**, ej. `Avena - HEB - 35g - Quaker - 4` → `item - lugar - tamaño - marca - cantidad`. No todos los movimientos lo traen (es más bien una minoría), pero cuando aparece, se quiere aprovechar.

Ninguna de las dos es una convención de Monefy — son un hábito personal de Oscar, así que la importación debe tratarlas como una opción explícita ("convención de Oscar"), no como comportamiento genérico por default.

## Decisiones tomadas

Ver [agents/plans/monefy-import-oscar-convention.md](../agents/plans/monefy-import-oscar-convention.md) para el detalle completo. En resumen:

- El 93% de las series con fracción son de una sola cuenta (no hay una segunda cuenta involucrada como en una transferencia real). El MSI de Hilo hoy solo calcula progreso sobre transferencias — se decidió **extender el modelo de Hilo** para que un `expense` normal también pueda vincularse a un `installmentPlanId`, en vez de inventar una cuenta puente sintética. Esto es una mejora real a la función de MSI de Hilo, no solo un truco de importación.
- Tamaño/marca/cantidad se agregan como **campos nuevos y opcionales** en el modelo de `expense` (no se aplastan dentro de descripción/comercio), con soporte completo: editables a mano en `AddTransactionSheet` para cualquier gasto, visibles solo al abrir/editar el movimiento (no en la fila compacta de Historial).
- Todo esto va detrás de un checkbox opcional en el wizard de importación ("Convención de Oscar"), prendido por default pero desactivable.
