---
status: pendiente
priority: 4
---

# Importar backups de Monefy

Quien migre a Hilo desde Monefy (u otra app similar) hoy tendría que volver a capturar todo su historial a mano usando `AddTransactionSheet`.

## Idea

Una pantalla (probablemente colgada de `SettingsModal` en [hilo-finanzas.jsx](../hilo-finanzas.jsx)) para subir un archivo de backup/export de Monefy y convertirlo en `accounts`, `categories` y `transactions` de Hilo.

## Abierto / por decidir

- Formato exacto del backup de Monefy a soportar (CSV export vs. su backup cifrado/propietario) — falta confirmar qué puede exportar la app.
- Cómo mapear categorías y cuentas de Monefy a las de Hilo (¿match por nombre, o el usuario las revisa/ajusta antes de importar?).
- Qué hacer con datos que no tienen equivalente directo en el modelo de Hilo (p. ej. Monefy no tiene el concepto de `taggedAsExpense` ni de MSI — ver [CLAUDE.md](../CLAUDE.md)).
- Si la importación debe ser todo-o-nada o permitir revisar/editar antes de confirmar.
