---
status: pendiente
priority: 20
---

# Refactorizar hacia una arquitectura en capas

Hoy todo el producto vive en un solo componente autocontenido, [hilo-finanzas.jsx](../hilo-finanzas.jsx) (ver "Architecture" en [CLAUDE.md](../CLAUDE.md)): diseño, datos estáticos, helpers, componentes compartidos, vistas, modales, y el estado completo de la app mezclados en un único archivo gigante. Eso fue una decisión deliberada mientras Hilo era un prototipo pensado para correr como Claude Artifact (un solo archivo autocontenido era requisito). Esa restricción ya no aplica — el modo Artifact se dejó de mantener en [local-storage-migration.md](local-storage-migration.md) — así que ya no hay una razón técnica dura para seguir en un solo archivo.

**Prioridad puesta deliberadamente alta (número grande = no urgente):** Hilo todavía es un MVP y el modelo de datos sigue cambiando; separar en capas demasiado pronto arriesga construir abstracciones sobre un diseño que todavía no se asienta. Esta nota existe para no perder la idea, no para atacarla pronto.

## Idea

Separar el código actual en capas con responsabilidades claras — a alto nivel, algo como:

- **Dominio / lógica de negocio**: el modelo de datos (accounts, categories, transactions, installmentPlans) y funciones puras sobre él (`computeAccountBalance`, `planProgress`, cálculos de totales por categoría/mes), sin nada de React ni de UI.
- **Persistencia**: la capa de IndexedDB (`openDb`/`loadState`/`saveState`, ver [local-storage-migration.md](local-storage-migration.md)), aislada detrás de una interfaz simple para que el resto de la app no sepa cómo se guarda.
- **UI / presentación**: los componentes de React (vistas, modales, piezas compartidas), que consumen la capa de dominio vía props/hooks sin conocer detalles de persistencia.

Esto probablemente implica pasar de un solo `.jsx` a varios archivos/módulos, algo que hoy CLAUDE.md documenta explícitamente que no existe ("no hay otros archivos fuente además del scaffold de dev local").

## Abierto / por decidir

- Depende de [testing.md](testing.md): conviene tener cobertura de la lógica de negocio actual antes de moverla de lugar, para verificar que el refactor no cambia comportamiento.
- Estructura de carpetas concreta (`src/domain`, `src/data`, `src/components`, etc.) — sin definir todavía.
- Si el refactor se hace de una sola vez o incremental (p. ej. primero extraer la capa de dominio pura, dejando la UI como está, y solo después tocar la organización de componentes).
- Si separar en capas empuja también a introducir algo de manejo de estado más estructurado (reducer/context) en vez del estado plano actual en `App`, o si eso queda fuera de alcance de esta task.
