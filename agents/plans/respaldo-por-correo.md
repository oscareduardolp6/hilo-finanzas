# Plan: respaldo por correo cada 3 días

Implementa [tasks/respaldo-por-correo.md](../../tasks/respaldo-por-correo.md).

## Diseño

Un workflow programado de GitHub Actions
([.github/workflows/email-backup.yml](../../.github/workflows/email-backup.yml)) corre
cada día a las 09:00 UTC (03:00 en Ciudad de México), y cada 3 días un script de Node
([scripts/email-backup/](../../scripts/email-backup/)) que:

1. Lee `users/{BACKUP_UID}` de Firestore con `firebase-admin`.
2. Lo decodifica igual que `firestoreStateRepository.load`: el blob gzip en `blob`, o
   el objeto plano del formato viejo.
3. Arma el mismo payload que `buildExportPayload` (`partial: false`,
   `device: github-actions`) y lo codifica como `hilo1:<base64 gzip>` — el texto
   comprimido que `parseExportText` ya sabe leer. Pesa ~10 veces menos que el JSON
   plano (506 KB contra 5.2 MB con el historial real de octubre de 2026), para no
   llenar el correo.
4. Lo manda por Gmail SMTP (`nodemailer`) como `hilo-respaldo-AAAA-MM-DD.json`. La
   extensión `.json` es para que el selector de archivos de `BackupModal`
   (`accept=".json,application/json"`) lo deje elegir; el contenido no es JSON plano
   pero `parseExportText` detecta el prefijo `hilo1:`.

Por qué así y no otra cosa:

- **Cada 3 días, no diario**, para no saturar el correo (pedido del usuario). El cron
  corre diario y un primer paso decide si toca: días desde 1970 módulo 3 igual a 1
  (13, 16, 19… de noviembre de 2026). Un cron `*/3` en el día del mes daría saltos de
  1 o 2 días al cambiar de mes (31 → 1). `workflow_dispatch` siempre envía.
- **No necesita el plan Blaze.** Leer un documento al día con `firebase-admin` cabe
  en la cuota gratis de Spark; no hay Cloud Function. Los respaldos programados
  nativos de Firestore y PITR sí requieren facturación (y el respaldo no te llega a
  ti, se queda en Google Cloud).
- **El respaldo nunca se guarda en GitHub.** El repo es público; un artefacto de
  Actions lo podría bajar cualquier cuenta. El script tampoco imprime datos en el log,
  solo el conteo y el tamaño.
- **Sin llaves guardadas: Workload Identity Federation.** GitHub cambia su token OIDC
  por credenciales de corta vida de la cuenta de servicio
  `hilo-email-backup@hilo-finanzas.iam.gserviceaccount.com`, que solo tiene
  `roles/datastore.viewer` (leer Firestore). El pool `github` / proveedor
  `github-actions` solo acepta tokens con
  `assertion.repository == 'oscareduardolp6/hilo-finanzas' && assertion.repository_owner_id == '63324861'`
  (el id evita que alguien recree un repo con el mismo nombre). La cuenta de servicio
  le da `roles/iam.workloadIdentityUser` a todo el pool
  (`principalSet://…/workloadIdentityPools/github/*`), que por esa condición es solo
  este repo.
- **Paquete aparte.** `scripts/email-backup/package.json` tiene sus propias
  dependencias, con versiones exactas, para no sumar `firebase-admin` al `npm ci` /
  build de la app.

## Configuración (secretos de GitHub Actions)

| Secreto | Valor |
| --- | --- |
| `VITE_FIREBASE_PROJECT_ID` | ya existía (lo usa el deploy) |
| `BACKUP_UID` | uid de Firebase Auth del dueño (Authentication → Users) |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/1005719393948/locations/global/workloadIdentityPools/github/providers/github-actions` |
| `GCP_BACKUP_SERVICE_ACCOUNT` | `hilo-email-backup@hilo-finanzas.iam.gserviceaccount.com` |
| `GMAIL_USER` | la cuenta de Gmail que envía y recibe |
| `GMAIL_APP_PASSWORD` | contraseña de aplicación de esa cuenta (requiere verificación en dos pasos) |

`BACKUP_TO` (opcional, en el script) manda a otra dirección; el workflow no lo pasa.

## Tests

[scripts/email-backup/lib.test.mjs](../../scripts/email-backup/lib.test.mjs) (corre con
`npm test`; `vite.config.js` incluye `scripts/**/*.test.mjs`): decodificar los dos
formatos del documento, que el adjunto se restaure con el **mismo** `parseExportText`
de la app, y el resumen / aviso de datos viejos. La parte de red (`index.mjs`) se
probó a mano con `workflow_dispatch`.

## Riesgos conocidos

- GitHub **desactiva los workflows programados de un repo público tras 60 días sin
  actividad** en el repo (y avisa por correo antes). Si pasa, se reactiva desde la
  pestaña Actions.
- La contraseña de aplicación de Gmail se invalida si se cambia la contraseña de la
  cuenta; el workflow empezaría a fallar con error de SMTP (y GitHub avisa).
