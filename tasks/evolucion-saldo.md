---
status: implementada
priority: 3
---

# Evolución del saldo por plazos

Una pestaña con una gráfica que muestra cómo ha subido y bajado el dinero (el saldo total) en un plazo elegido: último mes, 3 meses, 6 meses, 1 año, 2 años, 3 años o todo el historial.

## Problema que resuelve

Inicio muestra el saldo de *ahora* y los totales de *un mes*, pero no deja ver la tendencia: cuánto se ahorró (o se perdió) en los últimos meses o años, ni en qué momento subió o bajó el dinero.

## Idea a alto nivel

- Pestaña propia "Evolución", en móvil y escritorio.
- Selector de plazos 1M / 3M / 6M / 1A / 2A / 3A / Todo.
- Gráfica de área del saldo total día a día (o agrupado, si el plazo es largo) y un resumen: saldo inicial, saldo final y cambio del plazo (el "ahorro", con signo y %).
- El saldo no se guarda, se deriva: la serie se reconstruye con `initialBalance` + ingresos − gastos; las transferencias no lo mueven. Sin cambios al modelo de datos.

## Dudas abiertas (resueltas)

- ¿Qué graficar? → **El saldo total en el tiempo**; el ahorro del plazo es saldo final − saldo inicial.
- ¿Dónde vive? → **Pestaña propia**.
- ¿Qué plazos? → **1M, 3M, 6M, 1A, 2A, 3A y Todo**.

Ver [agents/plans/evolucion-saldo.md](../agents/plans/evolucion-saldo.md) para el diseño técnico.
