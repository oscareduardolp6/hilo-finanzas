---
status: pendiente
priority: 8
---

# Agregar testing

Hoy no hay linter ni test suite (ver [CLAUDE.md](../CLAUDE.md)) — toda la confianza en que un cambio no rompe nada viene de probar a mano en `npm run dev`. Eso ya es frágil con un solo componente gigante en [hilo-finanzas.jsx](../hilo-finanzas.jsx); se vuelve insostenible si además se busca refactorizar hacia una arquitectura en capas (ver [layered-architecture.md](layered-architecture.md)) — un refactor grande sin red de seguridad es mucho más riesgoso.

## Idea

Empezar por la lógica pura, que es la más fácil de testear y la que más valor da por esfuerzo: `computeAccountBalance`, `groupByDate`, `formatMoney`, helpers de fecha (`monthKey`, `monthLabel`, `formatDateLabel`), y el cálculo de `planProgress` (paid/remaining/pct/isPaidOff de los planes MSI) — esta última especialmente sensible porque ya soporta pagos parciales/desiguales y es fácil romperla sin darse cuenta. Después, si tiene sentido, sumar tests de comportamiento sobre la UI (React Testing Library) para los flujos críticos: agregar/editar/eliminar una transacción, transferencia marcada como `taggedAsExpense`, alta de un plan MSI.

Dado que el repo ya usa Vite ([package.json](../package.json)), Vitest es el candidato natural por integrarse directo sin config adicional.

## Abierto / por decidir

- Vitest vs. otro runner — no debería haber mucha discusión dado que ya se usa Vite, pero falta confirmarlo.
- Si vale la pena testear componentes de UI desde ahora (React Testing Library) o si por ahora basta con la lógica pura de negocio.
- Qué tan mecánico es extraer la lógica pura de dentro de [hilo-finanzas.jsx](../hilo-finanzas.jsx) para poder importarla en tests, dado que hoy todo vive en un solo archivo/componente.
- Esta task idealmente se resuelve antes de [layered-architecture.md](layered-architecture.md) — tener cobertura de la lógica de negocio actual da una red de seguridad para verificar que el refactor no cambia comportamiento.
