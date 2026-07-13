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

// Mensaje según el estatus al que pasó el pendiente. `soyCreador` indica si
// quien hizo la acción es el creador (para distinguir "iniciar" de "devolver").
function mensajeCambio(estatus, quien, titulo, soyCreador) {
  const t = `"${titulo}"`;
  switch (estatus) {
    case 'delegado': return { title: '📌 Nuevo pendiente', body: `${quien} te asignó ${t}` };
    case 'aceptado': return { title: '✅ Aceptado', body: `${quien} aceptó ${t}` };
    case 'reagendado': return { title: '📅 Reagendado', body: `${quien} propuso otra fecha para ${t}` };
    case 'en_espera': return { title: '⏸️ En espera', body: `${quien} puso en espera ${t}` };
    case 'concluido': return { title: '🎯 Por revisar', body: `${quien} concluyó ${t}` };
    case 'aprobado': return { title: '🎉 Aprobado', body: `${quien} aprobó ${t}` };
    case 'en_progreso':
      return soyCreador
        ? { title: '↩️ Devuelto', body: `${quien} te devolvió ${t} para ajustes` }
        : { title: '▶️ En progreso', body: `${quien} inició ${t}` };
    default: return null;
  }
}

/**
 * Notifica al usuario correspondiente cuando un pendiente cambia de estatus.
 * Siempre avisa a la OTRA parte (no a quien hizo la acción):
 *   - si actúa el creador  -> avisa al responsable
 *   - si actúa el responsable -> avisa al creador
 * `pendiente` requiere: id, titulo, creado_por, responsable_id.
 * `actor` requiere: id, nombre.
 */
export async function notificarCambio(pendiente, estatus, actor) {
  const creador = Number(pendiente.creado_por);
  const responsable = Number(pendiente.responsable_id);
  const actorId = Number(actor.id);
  const soyCreador = actorId === creador;
  const destinatario = soyCreador ? responsable : creador;
  if (!destinatario || destinatario === actorId) return 0; // nadie más a quien avisar

  const quien = (actor.nombre || 'Alguien').split(' ')[0];
  const msg = mensajeCambio(estatus, quien, pendiente.titulo, soyCreador);
  if (!msg) return 0;

  try {
    return await enviarPush(destinatario, { ...msg, url: '/', tag: `pend-${pendiente.id}` });
  } catch {
    return 0; // una push fallida nunca debe tumbar la acción del ticket
  }
}
