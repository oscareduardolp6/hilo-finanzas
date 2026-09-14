---
status: implementada
priority: 17
---

# Seguimiento de beneficios y recompensas de tarjetas de crédito

Con Amex hoy, y viendo la posibilidad de sacar otras tarjetas (Costco, etc.) por los beneficios que ofrecen, quiero poder llevar el registro de cuánto se gana en programas de recompensas: cashback, puntos, millas, promociones de tarjeta y promociones ocasionales de comercios.

## Estado

Implementado el MVP: catálogo de programas (`src/features/benefits/`), etiquetable en cualquier `income` (`benefitProgramId`), y un modal desde Ajustes ("Beneficios y promociones") con alta/edición/borrado de programas y el resumen por programa ("este mes" / "últimos 6 meses"). Ver [agents/plans/beneficios-tarjetas.md](../agents/plans/beneficios-tarjetas.md) para el diseño completo.

Deliberadamente fuera del MVP (quedan como ideas para una iteración futura, ver "Dudas abiertas" abajo): tipos de beneficio (cashback %, puntos con tasa de conversión), topes de gasto/vigencia con enforcement, y conectar la redención de puntos/cashback con un `income` real sin duplicar.

## Problema que resuelve

Hoy Hilo registra el gasto (lo que sale) pero no tiene forma de capturar lo que un gasto *genera* de vuelta: el % de cashback de una compra, los puntos que da una promoción vigente, o una promoción puntual ("15% de bonificación esta quincena en tal tienda"). Sin esto, decidir si vale la pena sacar una tarjeta nueva (o usar una u otra según la compra) es a ojo — no hay dato acumulado de cuánto realmente se ha ganado.

## Ejemplo concreto

Voy a Starbucks y pago con la promoción de Starbucks de Amex (descuento directo en el ticket, no cashback ni puntos). Quiero poder capturar ese ticket — cuánto me ahorré, en qué tienda, con qué tarjeta/promoción — y que al final de cada mes (o cada 6 meses) pueda ver el total ahorrado con esa promoción específica para decidir si de verdad me conviene seguir usando/pagando esa tarjeta.

## Idea a alto nivel

- Un beneficio ganado se parece a un plan MSI en que **no guarda progreso, se deriva**: cada "captura" de beneficio (ligada o no a una transacción) se suma para dar el total ganado por tarjeta/programa y en general.
- Tipos de beneficio a soportar, todos expresables en MXN o convertibles a MXN con una tasa:
  - **Cashback** — % o monto fijo devuelto, directo en dinero.
  - **Puntos / millas** — cantidad de puntos, con una tasa de conversión opcional (ej. "1000 puntos ≈ $150 MXN") para poder sumarlos al valor total aunque no sean dinero líquido.
  - **Promociones de tarjeta** — bonificaciones por categoría rotativa o por tiempo limitado (ej. "5x puntos en gasolina este trimestre"), que típicamente tienen un tope de gasto y una fecha de vigencia.
  - **Promociones ocasionales de comercio** — descuentos o bonos puntuales no ligados a ninguna tarjeta en particular.
- Cada captura se podría (opcionalmente) ligar a una `transaction` existente — el gasto que generó el beneficio — igual que un `expense` se liga a un `installmentPlanId`. También debe poder registrarse suelta (ej. un bono de bienvenida al abrir la tarjeta, que no corresponde a un gasto puntual).
- Un beneficio ganado es **especulativo hasta que se redime**: no debería sumarse a `totalBalance` automáticamente. Cuando el usuario efectivamente recibe el cashback/puntos canjeados como dinero, eso ya es un `income` normal — la pregunta abierta es cómo conectar ambos sin duplicar.
- Vista de resumen: cuánto se ha ganado (total y por tarjeta/programa/promoción) en un periodo — mensual y semestral son los cortes que interesan — para poder decidir si una tarjeta o promoción sigue valiendo la pena (ej. comparar lo ahorrado en 6 meses contra la anualidad de la tarjeta), y quizás un comparativo simple entre tarjetas para ayudar a decidir cuál conviene usar para cada tipo de compra.

## Dudas abiertas

- ¿El programa de beneficios se define por `account` (cada tarjeta tiene su(s) programa(s)) o es una entidad aparte que opcionalmente se liga a una cuenta?
- ¿Cómo se captura el % o la regla de cashback/puntos — el usuario la teclea cada vez, o se configura una regla por categoría/tarjeta y la app la sugiere al registrar el gasto?
- ¿Cómo y cuándo se marca un beneficio como "redimido"? ¿Se crea automáticamente el `income` correspondiente, o el usuario lo registra aparte y solo se enlazan para no duplicar el total?
- Tasa de conversión puntos→MXN: ¿fija por programa, o el usuario la actualiza cuando cambia (los programas la mueven con frecuencia)?
- Promociones con tope de gasto o vigencia: ¿vale la pena modelar el tope/fecha para alertar cuando ya se alcanzó, o por ahora basta con registrar lo ganado sin enforcement?
- ¿Esto necesita una feature nueva (`src/features/benefits/`) o encaja como una extensión de `accounts`/`categories`? Dado que toca cuentas, transacciones y reportes, probablemente feature propia con sus casos de uso y su store, siguiendo la arquitectura en capas.
