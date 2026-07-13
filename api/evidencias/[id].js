import { del } from '@vercel/blob';
import { db, sendJson, sendError } from '../_db.js';
import { requiereSesion } from '../_auth.js';
import { puedeVer } from '../_permisos.js';

// /api/evidencias/:id  → DELETE (borra el archivo de Blob y el registro)
export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return sendError(res, 'Método no permitido', 405);
  }

  const client = db();
  const { id } = req.query;

  const { rows } = await client.execute({
    sql: `SELECT e.id, e.url, e.pendiente_id, p.creado_por, p.responsable_id
          FROM evidencias e JOIN pendientes p ON p.id = e.pendiente_id
          WHERE e.id = ?`,
    args: [id],
  });
  if (!rows.length || !puedeVer(rows[0], sesion)) return sendError(res, 'No encontrado', 404);

  // Borra el archivo de Blob (si falla, seguimos: no dejamos el registro colgado).
  try { await del(rows[0].url, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch { /* ignore */ }

  await client.execute({ sql: 'DELETE FROM evidencias WHERE id = ?', args: [id] });
  return sendJson(res, { ok: true });
}
