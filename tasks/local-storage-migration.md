---
status: pendiente
priority: 2
---

# Migrar a IndexedDB (o similar) para guardado local

Hoy [hilo-finanzas.jsx](../hilo-finanzas.jsx) persiste usando `window.storage.get`/`.set`, la API del host de Claude Artifacts. Eso solo funciona cuando el archivo corre publicado como Artifact — al correrlo en el escritorio local (ver [README.md](../README.md)) o en cualquier otro navegador/dispositivo, esas llamadas fallan silenciosamente y nada se guarda entre recargas.

## Idea

Reemplazar ese mecanismo por algo que sí persista en el navegador — IndexedDB es el candidato natural dado el volumen de datos estructurados (cuentas, categorías, transacciones, planes MSI), aunque `localStorage` podría bastar si el volumen de datos se mantiene chico. Esto es parte de la dirección de producto ya documentada en [CLAUDE.md](../CLAUDE.md): Hilo debe ser una SPA sin backend que guarde todo localmente.

Importante: **no se trata de sincronizar datos entre dispositivos.** La meta es que la app guarde información de forma independiente en cada navegador/dispositivo (escritorio, celular, etc.) — cada instalación tiene sus propios datos, sin ningún backend ni cuenta de por medio que los conecte.

## Abierto / por decidir

- IndexedDB directo vs. una librería wrapper (p. ej. `idb`) para no lidiar con la API de bajo nivel a mano.
- Si vale la pena versionar el esquema de guardado desde ahora (para futuras migraciones), o mantenerlo simple mientras el modelo de datos siga cambiando.
- Si vale la pena un indicador de error de guardado una vez que el guardado ya no dependa de `window.storage` (el banner específico de Artifacts que existía se quitó — ver [hilo-finanzas.jsx](../hilo-finanzas.jsx)).
