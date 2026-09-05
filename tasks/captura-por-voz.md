---
status: pendiente
priority: 10
---

# Input de voz tipo "Ramble" para registrar gastos

Poder "narrar" en voz alta uno o varios gastos seguidos (como el input de voz "Ramble" de Todoist) y que la app los vaya registrando, en vez de llenar `AddTransactionSheet` a mano cada vez.

## Problema que resuelve

Capturar un gasto hoy requiere abrir la hoja de nuevo movimiento y llenar campo por campo (cuenta, categoría, comercio, monto). Para capturar varios gastos seguidos (p. ej. al llegar de hacer mandado) sería más rápido simplemente decirlos en voz alta y dejar que la app los interprete.

## Idea a alto nivel

- Grabar audio, transcribirlo, y de ahí extraer una o más transacciones (monto, comercio, categoría, cuenta) a partir del texto narrado.
- Debe poder combinarse con **convenciones que el usuario carga**: reglas propias de mapeo (p. ej. "cuando digo 'súper' es la categoría Despensa", o "cuando digo 'tarjeta' me refiero a la cuenta X"), similar en espíritu a la convención personal ya soportada en la importación de Monefy (ver [monefy-import-oscar-convention.md](monefy-import-oscar-convention.md)).
- Probablemente necesita un paso de revisión antes de guardar (como la hoja de revisión de `ReceiptScanModal`), para corregir lo que el reconocimiento interpretó mal antes de crear las transacciones.

## Dudas abiertas

- ¿Qué motor de voz-a-texto y de interpretación de lenguaje natural se usa? Si implica llamar una API externa (como ya hace `ReceiptScanModal` con la API de visión de Anthropic), sería una excepción más al principio de "todo se queda en el navegador" — ver sección "Product direction" de [CLAUDE.md](../CLAUDE.md).
- ¿Dónde y cómo se definen/almacenan las "convenciones" del usuario? ¿Nueva key de storage local-only, como `OCR_SETTINGS_STORAGE_KEY`?
- ¿Cómo se revisan y confirman las transacciones detectadas antes de guardarlas, y qué pasa cuando el reconocimiento es ambiguo o falla?
- ¿Cómo se distingue "un gasto" de "varios gastos" dentro de una sola narración continua?
