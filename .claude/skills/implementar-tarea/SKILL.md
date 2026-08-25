---
name: implementar-tarea
description: Recoge una tarea pendiente del backlog de Hilo (tasks/*.md) y la lleva de idea a implementación siguiendo la convención del repo (plan en agents/plans/, status en frontmatter, tabla en tasks/README.md). Usa esta skill siempre que el usuario pida implementar una tarea, trabajar en la siguiente funcionalidad, retomar el backlog, avanzar con tasks/, o diga cosas como "siguiente tarea", "qué sigue", "trabajemos en X funcionalidad", "implementemos el modo de presupuesto", incluso si no menciona la palabra "skill" o el nombre exacto de la tarea. También dispara si el usuario nombra directamente una tarea existente en tasks/ (por archivo o por título) y pide avanzarla.
---

# Implementar tarea

Convierte una entrada de `tasks/` en un plan aprobado por el usuario y luego en código, siguiendo exactamente el flujo que este repo ya usa (ver la sección "Keeping specs and plans in sync with the code" de `CLAUDE.md` y el precedente en `agents/plans/desktop-view.md`).

No asumas ni hardcodees qué tareas existen — **siempre lee `tasks/` en el momento**, el backlog cambia entre sesiones.

## 1. Encuentra las tareas pendientes

Lee `tasks/README.md` (tiene la tabla con prioridad y status) y el frontmatter de cada `tasks/*.md` (`status: pendiente | en-progreso | implementada`, `priority: <entero>`). Si el usuario ya nombró una tarea específica en su mensaje (por archivo, título, o número de la tabla), sáltate la selección y ve directo a esa — pero igual verifica que su `status` sea `pendiente` (si ya está `en-progreso` o `implementada`, dilo antes de continuar, puede que el usuario quiera retomarla o revisarla en vez de re-planearla desde cero).

Si no especificó ninguna, muéstrale las tareas `pendiente` ordenadas por `priority` (menor número = más urgente) con su título y una línea de resumen, y pregúntale cuál quiere atacar. No elijas tú solo la de mayor prioridad automáticamente — el usuario puede tener contexto (una fecha límite, algo que le urge más) que el backlog no refleja.

Si no hay ninguna tarea `pendiente`, dilo — no inventes trabajo ni tomes una `en-progreso` sin preguntar.

## 2. Reúne contexto antes de preguntar nada

Antes de involucrar al usuario en decisiones, lee tú lo que ya existe:

- El archivo completo de la tarea elegida (`tasks/<nombre>.md`) — presta especial atención a cualquier sección tipo "Abierto / por decidir", que suele listar exactamente las decisiones que faltan.
- `CLAUDE.md`, en particular la sección de Arquitectura, para entender cómo encaja la tarea en el componente único `hilo-finanzas.jsx` (qué patrones ya existen para cosas similares — p. ej. cómo se hizo la vista de escritorio si la tarea toca UI, o el modelo de datos si toca transacciones/cuentas).
- Si ya existe `agents/plans/<nombre-de-la-tarea>.md` — significa que esta tarea ya se planeó antes (quizá quedó a medias, o el plan está desactualizado respecto al código). Si existe, léelo y decide con el usuario si continúan ese plan, lo actualizan, o lo rehacen; no lo ignores silenciosamente.

Esta lectura previa importa porque las preguntas que le hagas al usuario deben ser las que *de verdad* no puedes resolver solo — no cosas que ya están documentadas en la propia tarea o en CLAUDE.md.

## 3. Pregunta lo que falte resolver

Con ese contexto, identifica qué sigue abierto y pregúntaselo al usuario antes de plantear un plan formal. Casi siempre incluye:

- Cualquier punto en la sección "Abierto / por decidir" de la tarea (elección de librería, alcance exacto, si algo es "nice to have" o parte del MVP).
- Decisiones de UX/flujo que la tarea no especifica (dónde vive un botón nuevo, qué pasa en el caso de error, si aplica tanto a la vista móvil como a la de escritorio — recuerda que este repo mantiene dos árboles de componentes paralelos, ver CLAUDE.md).
- Cualquier trade-off técnico no trivial que tú mismo detectes al leer el código (p. ej. si migrar el guardado implica un cambio de formato de datos y hay que decidir si se migra el estado existente o se empieza limpio).

Usa AskUserQuestion cuando las opciones sean discretas y comparables; si la duda es más abierta, pregúntala directamente en texto. No avances a un plan formal con huecos sin resolver — es mejor preguntar de más que planear sobre supuestos que luego haya que deshacer.

## 4. Entra en modo plan

Una vez resueltas las dudas abiertas, usa `EnterPlanMode` para diseñar la implementación. El plan que produzcas debe guardarse en **`agents/plans/<nombre-de-la-tarea>.md`** (mismo nombre base que el archivo en `tasks/`) y seguir la misma estructura que el precedente `agents/plans/desktop-view.md`:

- Encabezado con link a la tarea que implementa y nota de que el plan debe mantenerse sincronizado si el código diverge (copia el patrón exacto de esa nota, ya está en `agents/plans/desktop-view.md`).
- **Context** — qué pide la tarea y qué decisiones se confirmaron con el usuario (las del paso 3).
- **Diseño** — el diseño técnico concreto: qué funciones/componentes nuevos o modificados, dónde viven dentro de `hilo-finanzas.jsx` (recuerda: todo el producto vive en ese único archivo, salvo el scaffold de dev), cómo interactúa con el modelo de datos existente (accounts/categories/transactions/installmentPlans).
- **Archivos tocados** — lista explícita, normalmente incluye `hilo-finanzas.jsx`, el propio archivo de plan, `tasks/<nombre>.md` (status), y `tasks/README.md` (tabla), más `CLAUDE.md` si el cambio afecta algo que ese archivo documenta.
- **Verificación** — pasos concretos para probar el cambio corriendo `npm run dev` (ver README.md del repo), incluyendo casos borde relevantes a la tarea.

Preséntale este plan al usuario a través del flujo normal de `EnterPlanMode`/`ExitPlanMode` para que lo apruebe o pida ajustes antes de tocar código.

## 5. Implementa

Al arrancar la implementación (justo después de que el usuario apruebe el plan), cambia el frontmatter de `tasks/<nombre>.md` a `status: en-progreso` y refleja ese cambio en la tabla de `tasks/README.md` — así el backlog no miente sobre qué se está trabajando ahora mismo, aunque la sesión se corte a medias.

Implementa siguiendo el plan guardado. Si en el camino descubres que la realidad diverge del plan (algo no encaja, una decisión resulta distinta una vez dentro del código), actualiza `agents/plans/<nombre>.md` en el mismo cambio — CLAUDE.md es explícito en que un plan desactualizado es peor que no tener plan, porque engaña a quien lo lea después.

Prueba el cambio en `npm run dev` como indica la sección de Verificación del plan antes de darlo por terminado (recuerda: la persistencia vía `window.storage` no funciona en dev local, eso es esperado, no es un bug tuyo).

## 6. Cierra la tarea

Cuando el cambio esté implementado y verificado:

1. `tasks/<nombre>.md` → `status: implementada`.
2. `tasks/README.md` → actualiza la fila de la tabla a "Implementada".
3. Confirma que `agents/plans/<nombre>.md` refleja lo que realmente se construyó (no solo lo planeado originalmente).

No marques nada como `implementada` si quedó parcial o si el usuario pidió pausar — en ese caso déjalo en `en-progreso` y dile explícitamente qué falta.
