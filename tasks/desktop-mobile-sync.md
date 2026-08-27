---
status: implementada
priority: 4
---

# Sincronizar escritorio y móvil

Una vez que cada dispositivo guarde sus datos de forma independiente (ver [local-storage-migration.md](local-storage-migration.md)), el problema que sigue es que esos datos quedan aislados: lo que registras en el celular no aparece en la compu, y viceversa.

## Idea

Una forma de pasar los datos de un dispositivo a otro **sin backend por ahora** — por ejemplo:

- Código QR que codifique (o apunte a) un export de los datos, para escanearlo desde el otro dispositivo.
- Si un QR no es viable por el tamaño de los datos, un archivo exportable (JSON) que se descarga en un dispositivo y se importa en el otro.

Esto no es sincronización continua/automática, es un traspaso manual bajo demanda. Un backend real con sincronización automática entre dispositivos es la solución de fondo, pero queda para más adelante — no es prioridad ahora mismo.

## Cómo quedó (implementada)

Ver [agents/plans/desktop-mobile-sync.md](../agents/plans/desktop-mobile-sync.md) para el detalle. En resumen:

- **`SyncModal`** (Ajustes → "Sincronizar dispositivos"): pestaña *Enviar* con QR (solo si el estado comprimido con gzip cabe en ~2.9 KB — con historiales grandes se oculta y quedan las otras vías), botón de descargar `.json`, botón de copiar un string `hilo1:<base64 gzip>`, y `navigator.share` en móvil. Pestaña *Recibir* con escaneo de QR por cámara (`jsqr`), subir archivo, o pegar el texto.
- **Merge por `id`, no reemplazo.** En conflicto gana el registro con `updatedAt` más reciente (campo nuevo; los viejos caen a `createdAt`). Los **borrados sí viajan**: cada borrado deja un tombstone `{ id, deletedAt }` (quinta colección persistida), y el merge elimina un registro entrante si su borrado es posterior a su última edición. Los tombstones de más de 180 días se podan.
- **Respaldo aparte** (`BackupModal`, Ajustes → "Respaldo de datos"): exporta el mismo blob a `.json` y permite **restaurar reemplazando todo** (con confirmación). Distinto del sync: el sync combina, el respaldo pisa.
- Sin dependencia de compresión → se deshabilitan QR y texto comprimido, el `.json` plano sigue funcionando.

Un backend real con sincronización automática sigue siendo la solución de fondo para más adelante; esto es traspaso manual bajo demanda.
