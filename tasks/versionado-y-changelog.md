---
status: pendiente
priority: 5
---

# Versionado de la app y changelog público

Agregar un número de versión visible a Hilo y un changelog público que documente qué cambió entre versiones.

## Problema que resuelve

Hoy no hay ninguna versión visible en la app, ni un registro de qué cambió de una release a otra. Ni el usuario ni quien le da seguimiento al desarrollo tiene forma de saber "en qué versión estoy" o "qué cambió la semana pasada". Se vuelve más importante conforme la app tenga usuarios reales: es la base para poder comunicar mejoras sin que se sientan como cambios arbitrarios.

## Idea a alto nivel

- Un número de versión (semver o basado en fecha) visible en algún lugar de la UI, probablemente en `SettingsModal`.
- Un changelog público: puede ser tan simple como un archivo `CHANGELOG.md` renderizado dentro de la app, o una sección/página aparte.
- Idealmente el número de versión y el changelog se mantienen fáciles de actualizar como parte del flujo normal de cambios (p. ej., se toca junto con cada PR relevante), no como un trabajo aparte que se le olvide a alguien.

## Dudas abiertas

- ¿Versión manual (se sube a mano en cada release) o derivada automáticamente de `package.json` / tags de git?
- ¿Changelog escrito a mano o generado a partir de mensajes de commit/PRs?
- ¿Dónde vive exactamente dentro de la app (¿tab en `SettingsModal`?) y si también debería existir como página pública fuera de la app.
- Esta tarea es la base para poder anunciar cambios a usuarios reales conforme se explore capitalizar la app — ver [validar-disposicion-a-pagar.md](validar-disposicion-a-pagar.md) y [analiticas-web.md](analiticas-web.md).
