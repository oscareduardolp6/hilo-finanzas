---
status: pendiente
priority: 13
---

# Soporte multiidioma (agregar inglés)

Agregar inglés como segundo idioma de la UI, hoy toda en español mexicano.

## Problema que resuelve

Hilo está construida pensando en un usuario mexicano (UI en español, moneda MXN), lo cual limita a quién le puede servir la app tal cual está. Agregar inglés abre la puerta a más usuarios, incluyendo para validar cosas como [validar-disposicion-a-pagar.md](validar-disposicion-a-pagar.md) fuera de un público exclusivamente hispanohablante.

## Idea a alto nivel

- Extraer los strings de UI (hoy hardcodeados en español dentro de `hilo-finanzas.jsx`) a un diccionario de traducciones.
- Agregar un selector de idioma (o detección automática por navegador) que alterne entre es-MX y en.

## Dudas abiertas

- Todo el producto vive en un solo archivo `.jsx` sin ninguna librería de i18n hoy — ¿vale la pena traer una (p. ej. i18next) o basta un diccionario simple hecho a mano?
- ¿El formato de moneda/fecha cambia con el idioma, o la app se queda en MXN/formato mexicano independientemente del idioma de la UI? (Cambiar la moneda es un problema bastante más grande que traducir texto.)
- ¿Cómo se decide y persiste el idioma elegido? ¿Nueva key de storage local-only, como ya existe para ajustes de OCR o de sync?
- Alcance: ¿se traduce toda la app de una vez, o se empieza por las vistas principales y se va ampliando?
