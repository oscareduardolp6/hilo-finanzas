---
status: pendiente
priority: 12
---

# Acceso rápido en la cortina de accesos rápidos de Android

Poder registrar un gasto rápido desde el "quick settings tile" de la cortina de notificaciones de Android, sin abrir la app completa.

## Problema que resuelve

Agregar un gasto hoy requiere abrir la app y navegar hasta `AddTransactionSheet`. Para el caso común (un gasto rápido, recién hecho) sería más cómodo tener un acceso directo desde la cortina de accesos rápidos de Android, como tienen apps de linterna, notas rápidas, etc.

## Idea a alto nivel

- Un tile en la cortina de quick settings de Android que abra directo a un formulario mínimo de captura rápida (monto + cuenta, categorizando después si hace falta).

## Dudas abiertas

- La API de Quick Settings Tile de Android normalmente **no está expuesta a PWAs**, solo a apps nativas — esto probablemente depende de resolver primero [app-movil-nativa.md](app-movil-nativa.md). Como PWA, lo más cercano hoy son los "app shortcuts" del manifest (iconos de acceso directo al mantener presionado el ícono de la app), que es una alternativa mucho más simple si el tile nativo no se justifica todavía.
- Definir el alcance mínimo de "gasto rápido": ¿solo monto y cuenta con categoría por default, o se pide categoría también?
- ¿Qué pasa si el usuario abre el acceso rápido pero no completa la captura (se descarta, se guarda como borrador)?
