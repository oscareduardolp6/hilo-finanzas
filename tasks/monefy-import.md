---
status: implementada
priority: 6
---

# Importar backups de Monefy

Quien migre a Hilo desde Monefy (u otra app similar) hoy tendría que volver a capturar todo su historial a mano usando `AddTransactionSheet`.

## Idea

Una pantalla colgada de `SettingsModal` en [hilo-finanzas.jsx](../hilo-finanzas.jsx) para subir un archivo de backup/export de Monefy y convertirlo en `accounts`, `categories` y `transactions` de Hilo.

## Decisiones tomadas

Ver [agents/plans/monefy-import.md](../agents/plans/monefy-import.md) para el detalle completo. En resumen:

- **Formato**: solo el **CSV export** de Monefy — su backup nativo es un blob binario/cifrado, no parseable. El importador valida el encabezado del CSV y rechaza archivos que no calcen.
- **Mapeo de cuentas**: se le muestra al usuario la lista de cuentas detectadas en el CSV (incluyendo las que solo aparecen del lado de una transferencia, por ejemplo cuentas renombradas o cerradas) con un tipo sugerido por heurística de nombre, para que confirme, edite o excluya cada una antes de importar. Las que coinciden por nombre con una cuenta ya existente en Hilo se fusionan.
- **Mapeo de categorías**: se crean automáticamente las que falten, matcheando por (nombre, tipo) contra las categorías existentes; el tipo (gasto/ingreso) se infiere por el signo del monto, e ícono se adivina por palabras clave.
- **Conceptos sin equivalente en Hilo** (`taggedAsExpense`, MSI): Monefy no los tiene, así que las transferencias importadas siempre quedan con `taggedAsExpense: false` y `installmentPlanId: null`.
- **Todo-o-nada vs. revisar**: es un híbrido — se revisan las cuentas antes de confirmar, pero no hay revisión fila por fila de las ~18k transacciones; una vez confirmado, la importación es atómica (fusiona con lo que ya existe en Hilo, no reemplaza nada).
