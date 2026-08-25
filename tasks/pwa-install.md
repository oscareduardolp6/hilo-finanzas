---
status: implementada
priority: 3
---

# Instalar como PWA

Hoy Hilo solo corre como pestaña de navegador (dev local) o como Claude Artifact. Para que se sienta como una app de verdad en el celular/escritorio, hace falta que el navegador la ofrezca como "instalable" (ícono, splash, modo standalone).

## Idea

Agregar lo necesario para que sea una Progressive Web App: manifest.json, ícono(s), y un service worker mínimo (aunque sea solo para cumplir el criterio de instalabilidad, sin necesariamente cachear para uso offline todavía). Tiene más sentido una vez resuelto [local-storage-migration.md](local-storage-migration.md), porque instalar la app solo vale la pena si los datos ya persisten fuera del contexto de Artifact.

## Decisiones tomadas

- El service worker cachea el app shell (network-first para el documento, stale-while-revalidate para el resto) para soportar uso offline desde ahora, no solo el mínimo de instalabilidad.
- Ícono: glifo de billetera en dorado (`#C9A24B`) sobre fondo verde oscuro (`#0F1A17`), reutilizando la paleta de marca ya definida en `hilo-finanzas.jsx`. `short_name` del manifest: "Hilo".

Ver [agents/plans/pwa-install.md](../agents/plans/pwa-install.md) para el diseño detallado.
