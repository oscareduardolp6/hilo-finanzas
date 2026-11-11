---
status: en-progreso
priority: 1
---

# Respaldo diario por correo

En noviembre de 2026 se perdieron octubre y noviembre completos: un arranque sin señal
hizo que la app subiera a Firestore una copia vieja del teléfono encima de los datos
reales (el bug ya está corregido, ver el punto 6 de "Ajuste post-lanzamiento" en
[agents/plans/backend-sync.md](../agents/plans/backend-sync.md)). Firestore no tenía
recuperación por fecha ni respaldos programados, así que lo único que sirvió fue un
respaldo manual de días antes.

Para que no vuelva a depender de acordarse de exportar: **cada noche llega a tu correo
un respaldo completo**, en el mismo formato que Ajustes → Respaldo, listo para
restaurar.

## Comportamiento

- Todos los días a las 03:00 (Ciudad de México) llega un correo "Respaldo de Hilo —
  AAAA-MM-DD (N movimientos)" con el archivo `hilo-respaldo-AAAA-MM-DD.json` adjunto.
- Se restaura como cualquier respaldo: Ajustes → Respaldo → Restaurar desde archivo.
- El correo resume cuántos movimientos hay, cuántos por mes en los últimos tres y la
  fecha del más reciente. Si el más reciente tiene más de 7 días, el asunto lleva ⚠️ y
  el cuerpo avisa que los datos podrían haberse perdido — la pérdida de noviembre se
  habría notado al día siguiente.
- No depende de abrir la app ni de ningún dispositivo: corre en GitHub Actions.
- Si falla (Firestore, Gmail, credenciales), GitHub manda su correo de "workflow
  failed" al dueño del repo.

Detalles y decisiones en [agents/plans/respaldo-por-correo.md](../agents/plans/respaldo-por-correo.md).
