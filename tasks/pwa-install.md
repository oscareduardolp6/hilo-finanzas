---
status: pendiente
priority: 3
---

# Instalar como PWA

Hoy Hilo solo corre como pestaña de navegador (dev local) o como Claude Artifact. Para que se sienta como una app de verdad en el celular/escritorio, hace falta que el navegador la ofrezca como "instalable" (ícono, splash, modo standalone).

## Idea

Agregar lo necesario para que sea una Progressive Web App: manifest.json, ícono(s), y un service worker mínimo (aunque sea solo para cumplir el criterio de instalabilidad, sin necesariamente cachear para uso offline todavía). Tiene más sentido una vez resuelto [local-storage-migration.md](local-storage-migration.md), porque instalar la app solo vale la pena si los datos ya persisten fuera del contexto de Artifact.

## Abierto / por decidir

- Si el service worker debe soportar uso offline desde ahora, o solo cumplir el requisito mínimo de instalabilidad.
- Ícono y branding (nombre corto, colores del manifest) para la pantalla de inicio.
