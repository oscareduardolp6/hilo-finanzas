---
status: implementada
priority: 2
---

# Modo local: usar la app sin iniciar sesión

Hilo se usa como pieza de portafolio: quien llega por primera vez debe **ver la app
funcionando**, no una pantalla que exige cuenta de Google. Sin sesión, la app corre
igual pero guarda todo en el IndexedDB del propio navegador; con sesión (el caso del
dueño) nada cambia — sigue siendo Firestore.

## Comportamiento

- Sin sesión → se monta la app directo (con los datos de ejemplo la primera vez), sin
  `LoginScreen`. Los datos viven en el IndexedDB local; nunca se toca Firestore.
- Con sesión → idéntico a antes (Firestore, migración de una vez desde el snapshot local).
- "Iniciar sesión con Google" pasó a **Ajustes**, junto a una nota de "Modo local".
  Si el usuario lo prueba en local y luego inicia sesión con Firestore vacío, la
  migración existente sube lo que armó en local.
- "Cerrar sesión" devuelve al modo local (no a una pantalla de login).

Detalles y decisiones en [agents/plans/modo-local-sin-login.md](../agents/plans/modo-local-sin-login.md).
