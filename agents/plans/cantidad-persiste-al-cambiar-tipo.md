# Plan — Conservar el monto al cambiar entre gasto / ingreso / transferencia

Implementa la tarea [tasks/cantidad-persiste-al-cambiar-tipo.md](../../tasks/cantidad-persiste-al-cambiar-tipo.md).

**Este plan es una foto de la intención al momento de escribirlo. Si el código diverge, actualiza este archivo en el mismo cambio** — un plan desactualizado engaña a quien lo lea después (regla de `CLAUDE.md`).

---

## Context

En `AddTransactionSheet`, el selector de tipo (Gasto / Ingreso / Transferencia, visible solo al crear, `!editingId`) llama `onSwitchType(t)`. En `App` ese handler estaba definido **dos veces, idéntico e inline** — para el árbol móvil y como prop `onSwitchFormType` de `DesktopShell`:

```js
onSwitchFormType={(t) => { setFormType(t); setForm(initialFormState(t, accounts, categories)); }}
```

`initialFormState` (helper, ~línea 227) siempre arranca de `base = { date: todayIso(), description: '', amount: '', store: '' }`, así que al cambiar de tipo se perdía el monto ya tecleado, obligando a re-escribirlo.

**Decisión confirmada con el usuario:** conservar **solo la cantidad** (`amount`). Descripción, fecha, comercio y los campos específicos del tipo (cuenta, categoría, origen/destino, plan MSI) se siguen reseteando.

## Diseño

Todo en `hilo-finanzas.jsx`.

1. **Nueva función `switchFormType(type)` en `App`**, junto a `openAddSheet`:

   ```js
   function switchFormType(type) {
     setFormType(type);
     setForm(f => {
       const fresh = initialFormState(type, accounts, categories);
       return f ? { ...fresh, amount: f.amount } : fresh;
     });
   }
   ```

   El updater funcional de `setForm` lee el `amount` actual sin depender de un `form` capturado en cláusura. `initialFormState` se reutiliza tal cual para todo lo demás.

2. **Sustituir las dos definiciones inline** por `switchFormType`:
   - Prop de `<DesktopShell>`: `onSwitchFormType={switchFormType}`.
   - Árbol móvil, `<AddTransactionSheet onSwitchType=...>`: `onSwitchType={switchFormType}`.

No se toca `AddTransactionSheet` ni `initialFormState`. El `useEffect([formType])` que resetea `expenseMode` sigue igual (no afecta al monto). El selector de tipo no se muestra al editar, así que no hay caso `editingId`.

## Archivos tocados

- **`hilo-finanzas.jsx`** — nueva función `switchFormType` en `App`; reemplazo de los dos handlers inline.
- **`agents/plans/cantidad-persiste-al-cambiar-tipo.md`** — este plan.
- **`tasks/cantidad-persiste-al-cambiar-tipo.md`** — `status`.
- **`tasks/README.md`** — fila de la tabla.
- **`CLAUDE.md`** — sin cambios.

## Verificación (`npm run dev`)

1. **Móvil (< 1024px):** "Nueva transacción" → escribir `150` → alternar Gasto → Ingreso → Transferencia → Gasto. El monto se mantiene en `150`.
2. **Campos específicos sí se resetean:** en Gasto, elegir categoría no-default + escribir descripción/comercio → cambiar a Ingreso y volver → categoría vuelve a default, descripción/comercio vacíos, monto sigue en `150`.
3. **Transferencia:** elegir cuentas origen/destino no-default → cambiar de tipo y volver → cuentas reseteadas, monto intacto.
4. **Escritorio (≥ 1024px):** repetir paso 1 en el modal de `DesktopShell`.
5. **Monto vacío:** alternar tipos sin teclear nada → sin errores, campo sigue vacío.
6. **Editar movimiento existente:** el selector de tipo no aparece → guardar sin problemas.
