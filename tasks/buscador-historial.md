---
status: implementada
priority: 3
---

# Buscador en el historial

Agregar un buscador de texto dentro de la sección de Historial (`HistoryView` / `HistoryViewDesktop`) para encontrar movimientos rápido, buscando a lo largo de todo el tiempo (no solo el mes en curso).

## Problema que resuelve

Hoy el historial solo se puede acotar con los filtros de tipo / categoría / lugar y el toggle "Ver todo el tiempo". No hay forma de escribir "óxxo" o "pañales" o el nombre de un plan de MSI y ver directo los movimientos que coinciden. Con meses de captura acumulada, encontrar una compra concreta implica scrollear mucho.

## Idea a alto nivel

- Un input de búsqueda arriba de la lista, junto a los filtros existentes, tanto en móvil (`HistoryView`) como en escritorio (`HistoryViewDesktop`).
- El texto se hace match (case-insensitive, sin acentos idealmente) contra:
  - `description` del movimiento,
  - `store` (lugar comprado),
  - la descripción / `store` del **plan de MSI** asociado (`installmentPlanId` → `installmentPlans`), para poder buscar por nombre de plan aunque el movimiento no lo repita en su texto.
- Cuando hay texto en el buscador, la búsqueda es **siempre a lo largo de todo el tiempo**, ignorando `monthCursor` / `showAllTime` (o forzando `showAllTime` mientras haya query). Al limpiar el buscador se vuelve al comportamiento normal.
- Se combina con los filtros actuales (tipo / categoría / lugar): el buscador acota sobre lo que ya dejaron pasar esos filtros.
- **Autocompletado**: usar un `<datalist>` nativo colgado del input (`<input list="...">` + `<datalist>`), poblado con lo que ya existe en el historial:
  - lugares (`knownStores` ya se calcula y se pasa como prop),
  - descripciones usadas antes,
  - nombres de planes de MSI.
  - El navegador se encarga de filtrar y mostrar las sugerencias conforme se escribe; solo hay que construir la lista de `<option>` únicas. Nada de dropdown propio.

## Dudas abiertas

- ¿El buscador reemplaza visualmente al toggle "Ver por mes / Ver todo el tiempo" mientras hay query, o solo lo ignora por debajo y lo deja deshabilitado?
- ¿Incluir en el match otros campos de producto (`brand`, `size`) o dejarlo en descripción / lugar / plan como pidió la tarea?
- ¿Resaltar (highlight) el fragmento que coincide dentro de `TransactionRow`, o basta con filtrar la lista?
- ¿Persistir el último término buscado, o siempre arrancar vacío? (probablemente vacío, como el resto de filtros).
