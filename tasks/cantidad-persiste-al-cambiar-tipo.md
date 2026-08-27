---
status: pendiente
priority: 4
---

# Conservar el monto al cambiar entre gasto / ingreso / transferencia

En `AddTransactionSheet`, al cambiar el tipo de movimiento (gasto ↔ ingreso ↔ transferencia) se borra el valor que el usuario ya había escrito en el campo de cantidad.

## Problema que resuelve

Es muy común empezar a capturar el monto y luego darse cuenta de que el tipo estaba mal (o probar cómo se ve como transferencia). Hoy eso obliga a volver a teclear la cantidad. El monto es un dato que no depende del tipo, así que debería sobrevivir el cambio.

## Idea a alto nivel

Al alternar el tipo, mantener el valor actual del input de cantidad en el estado del formulario en vez de resetearlo. Los demás campos que sí son específicos del tipo (cuenta origen/destino, categoría, comercio, etc.) pueden seguir limpiándose o re-mapeándose como hoy; el cambio es solo para la cantidad.

## Dudas abiertas

- Revisar `initialFormState` / el handler que cambia `type` en `AddTransactionSheet` para ver exactamente dónde se pierde el valor.
- ¿Conservar también la descripción? (probablemente sí, por el mismo argumento, pero el pedido explícito es la cantidad).
