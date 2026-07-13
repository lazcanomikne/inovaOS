import { db, sendJson, sendError, readBody } from '../_db.js';
import { requiereSesion } from '../_auth.js';
import { puedeVer } from '../_permisos.js';

async function pendienteVisible(client, res, pendienteId, sesion) {
  const { rows } = await client.execute({
    sql: 'SELECT creado_por, responsable_id FROM pendientes WHERE id = ?',
    args: [pendienteId],
  });
  if (!rows.length || !puedeVer(rows[0], sesion)) {
    sendError(res, 'No encontrado', 404);
    return null;
  }
  return rows[0];
}

// /api/evidencias?pendiente_id=1  → GET lista
// /api/evidencias                 → POST { pendiente_id, url, nombre, tipo, tamano }
//   (registra el metadato tras subir el archivo a Blob)
export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;
  const client = db();

  if (req.method === 'GET') {
    const { pendiente_id } = req.query;
    if (!pendiente_id) return sendError(res, 'Falta pendiente_id');
    if (!(await pendienteVisible(client, res, pendiente_id, sesion))) return;
    const { rows } = await client.execute({
      sql: `SELECT e.*, u.nombre AS autor
            FROM evidencias e LEFT JOIN usuarios u ON u.id = e.subido_por
            WHERE e.pendiente_id = ? ORDER BY e.created_at DESC`,
      args: [pendiente_id],
    });
    return sendJson(res, rows);
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.pendiente_id || !b.url || !b.nombre) return sendError(res, 'Faltan datos de la evidencia');
    if (!(await pendienteVisible(client, res, b.pendiente_id, sesion))) return;

    const { rows } = await client.execute({
      sql: `INSERT INTO evidencias (pendiente_id, nombre, url, tipo, tamano, comentario, subido_por)
            VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [b.pendiente_id, b.nombre, b.url, b.tipo ?? null, b.tamano ?? null, b.comentario ?? null, sesion.id],
    });
    await client.execute({
      sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Evidencia adjunta', ?, ?)`,
      args: [b.pendiente_id, `${b.nombre} · por ${sesion.nombre}`, sesion.id],
    });
    return sendJson(res, rows[0], 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Método no permitido', 405);
}
