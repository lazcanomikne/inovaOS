// Envío de notificaciones push (Web Push + VAPID).
import webpush from 'web-push';
import { db } from './_db.js';

let configurado = false;
function configurar() {
  if (configurado) return;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('Faltan llaves VAPID');
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:no-reply@inovatech.com.mx', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configurado = true;
}

/**
 * Envía una push a TODOS los dispositivos de un usuario.
 * payload: { title, body, url?, tag? }. Devuelve cuántas se entregaron.
 */
export async function enviarPush(usuarioId, payload) {
  configurar();
  const client = db();
  const { rows } = await client.execute({
    sql: 'SELECT id, endpoint, p256dh, auth FROM push_subs WHERE usuario_id = ?',
    args: [usuarioId],
  });

  let entregadas = 0;
  const cuerpo = JSON.stringify(payload);
  for (const s of rows) {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try {
      await webpush.sendNotification(sub, cuerpo, { TTL: 3600 });
      entregadas++;
    } catch (e) {
      // 404/410 = la suscripción ya no existe (app desinstalada, permiso revocado): la borramos.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await client.execute({ sql: 'DELETE FROM push_subs WHERE id = ?', args: [s.id] });
      }
    }
  }
  return entregadas;
}
