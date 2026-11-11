/* Respaldo por correo (cada 3 días, ver el workflow): lee el documento del usuario en Firestore y lo
   manda como adjunto a su Gmail. Lo corre `.github/workflows/email-backup.yml`.

   Variables de entorno:
     FIREBASE_PROJECT_ID  el proyecto de Firebase (p. ej. hilo-finanzas)
     BACKUP_UID           el uid de Firebase Auth del dueño de los datos
     GMAIL_USER           la cuenta de Gmail que envía (y recibe, salvo BACKUP_TO)
     GMAIL_APP_PASSWORD   contraseña de aplicación de esa cuenta
     BACKUP_TO            opcional: a quién mandarlo, si no es a GMAIL_USER
   Las credenciales de Google Cloud llegan por Application Default
   Credentials (en el workflow, vía Workload Identity Federation: sin llave).

   Nunca imprime los datos: el repositorio es público y los logs de Actions
   también. */

import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { buildBackupPayload, decodeStateDocument, emailBody, emailSubject, encodeBackup, summarize } from './lib.mjs';

function env(name, { optional = false } = {}) {
  const value = process.env[name]?.trim();
  if (!value && !optional) throw new Error(`Falta la variable de entorno ${name}.`);
  return value || null;
}

async function main() {
  const projectId = env('FIREBASE_PROJECT_ID');
  const uid = env('BACKUP_UID');
  const gmailUser = env('GMAIL_USER');
  const gmailPassword = env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
  const to = env('BACKUP_TO', { optional: true }) || gmailUser;

  initializeApp({ credential: applicationDefault(), projectId });
  const snap = await getFirestore().collection('users').doc(uid).get();
  const state = decodeStateDocument(snap.exists ? snap.data() : null);

  const now = new Date();
  const summary = summarize(state, now);
  const fileName = `hilo-respaldo-${summary.today}.json`;
  const attachment = encodeBackup(buildBackupPayload(state, now));

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPassword },
  });
  await transport.sendMail({
    from: `Hilo <${gmailUser}>`,
    to,
    subject: emailSubject(summary),
    text: emailBody(summary, fileName),
    attachments: [{ filename: fileName, content: attachment, contentType: 'application/json' }],
  });

  console.log(
    `Respaldo enviado: ${summary.totalTransactions} movimientos, ${(attachment.length / 1024).toFixed(0)} KB` +
      (summary.stale ? ' (con aviso: movimiento más reciente viejo)' : ''),
  );
}

main().catch((error) => {
  // Solo el mensaje: un error de Firestore o SMTP no trae datos del usuario.
  console.error(`No se pudo enviar el respaldo: ${error?.message ?? error}`);
  process.exit(1);
});
