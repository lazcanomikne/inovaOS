import { db, sendJson, sendError, readBody } from '../_db.js';

// /api/checklist/:itemId  → PATCH { completado, texto } · DELETE
export default async function handler(req, res) {
  const client = db();
  const { itemId } = req.query;

  if (req.method === 'PATCH') {
    const b = readBody(req);
    const campos = [];
    const args = [];
    if (b.completado !== undefined) { campos.push('completado = ?'); args.push(b.completado ? 1 : 0); }
    if (b.texto !== undefined) { campos.push('texto = ?'); args.push(b.texto); }
    if (!campos.length) return sendError(res, 'Nada que actualizar');
    args.push(itemId);
    await client.execute({ sql: `UPDATE checklist SET ${campos.join(', ')} WHERE id = ?`, args });
    const { rows } = await client.execute({ sql: 'SELECT * FROM checklist WHERE id = ?', args: [itemId] });
    return sendJson(res, rows[0]);
  }

  if (req.method === 'DELETE') {
    await client.execute({ sql: 'DELETE FROM checklist WHERE id = ?', args: [itemId] });
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return sendError(res, 'Método no permitido', 405);
}
