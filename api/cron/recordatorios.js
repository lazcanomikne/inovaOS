// Cron diario: revisa los pendientes y envía el recordatorio que corresponda
// al responsable, según cuántos días falten o lleve vencido. Idempotente: cada
// (pendiente, tipo) se envía una sola vez (tabla recordatorios_enviados).
//
// Lo dispara Vercel Cron (config en vercel.json) a las 14:00 UTC (~8am MX).
// Protegido con CRON_SECRET: Vercel manda `Authorization: Bearer <CRON_SECRET>`.
import { db, sendJson, sendError } from '../_db.js';
import { enviarRecordatorio } from '../_mail.js';

// días hasta el vencimiento  ->  tipo de recordatorio
const VENTANAS = { 3: '3dias', 2: '2dias', 1: '1dia', 0: 'hoy', '-1': 'vencido24', '-2': 'vencido48', '-3': 'vencido72' };
const CERRADOS = ['concluido', 'aprobado'];

function diasHasta(fechaISO, hoy) {
  const f = new Date(`${String(fechaISO).slice(0, 10)}T00:00:00Z`);
  const h = new Date(`${hoy}T00:00:00Z`);
  return Math.round((f - h) / 86400000);
}

export default async function handler(req, res) {
  // Autorización: sólo Vercel Cron (o quien tenga el secreto) puede dispararlo.
  const secreto = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (secreto && auth !== `Bearer ${secreto}`) return sendError(res, 'No autorizado', 401);

  const client = db();

  // "Hoy" en hora de México (UTC-6) para decidir las ventanas por día natural.
  const hoyMx = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

  const { rows: pendientes } = await client.execute({
    sql: `SELECT p.*, u.nombre AS responsable_nombre, u.email AS responsable_email,
                 c.nombre AS creador_nombre
          FROM pendientes p
          JOIN usuarios u ON u.id = p.responsable_id
          LEFT JOIN usuarios c ON c.id = p.creado_por
          WHERE p.fecha_compromiso IS NOT NULL
            AND p.estatus NOT IN ('concluido','aprobado')`,
    args: [],
  });

  const dryRun = new URL(req.url, 'http://local').searchParams.get('dry') === '1';
  const resumen = { revisados: pendientes.length, enviados: 0, omitidos: 0, detalle: [] };

  for (const p of pendientes) {
    const d = diasHasta(p.fecha_compromiso, hoyMx);
    const tipo = VENTANAS[d];
    if (!tipo || !p.responsable_email) { resumen.omitidos++; continue; }

    // ¿Ya se envió este tipo para este pendiente?
    const ya = await client.execute({
      sql: 'SELECT 1 FROM recordatorios_enviados WHERE pendiente_id = ? AND tipo = ?',
      args: [p.id, tipo],
    });
    if (ya.rows.length) { resumen.omitidos++; continue; }

    if (dryRun) {
      resumen.detalle.push({ id: p.id, titulo: p.titulo, tipo, a: p.responsable_email, dry: true });
      resumen.enviados++;
      continue;
    }

    try {
      await enviarRecordatorio(p.responsable_email, p, tipo);
      await client.execute({
        sql: 'INSERT OR IGNORE INTO recordatorios_enviados (pendiente_id, tipo, enviado_a) VALUES (?, ?, ?)',
        args: [p.id, tipo, p.responsable_email],
      });
      resumen.enviados++;
      resumen.detalle.push({ id: p.id, tipo, a: p.responsable_email });
    } catch (e) {
      resumen.detalle.push({ id: p.id, tipo, error: e.message });
    }
  }

  return sendJson(res, { ok: true, hoy: hoyMx, ...resumen });
}
