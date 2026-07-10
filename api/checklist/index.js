import { db, sendJson, sendError, readBody } from '../_db.js';

// /api/checklist?pendiente_id=1  → GET lista
// /api/checklist                 → POST { pendiente_id, texto }
export default async function handler(req, res) {
  const client = db();

  if (req.method === 'GET') {
    const { pendiente_id } = req.query;
    if (!pendiente_id) return sendError(res, 'Falta pendiente_id');
    const { rows } = await client.execute({
      sql: 'SELECT * FROM checklist WHERE pendiente_id = ? ORDER BY orden, id',
      args: [pendiente_id],
    });
    return sendJson(res, rows);
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.pendiente_id || !b.texto) return sendError(res, 'Faltan pendiente_id o texto');
    const { rows } = await client.execute({
      sql: 'INSERT INTO checklist (pendiente_id, texto, orden) VALUES (?, ?, ?) RETURNING *',
      args: [b.pendiente_id, b.texto, b.orden ?? 0],
    });
    return sendJson(res, rows[0], 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Método no permitido', 405);
}
