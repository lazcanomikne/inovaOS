import { db, sendJson, sendError, readBody } from '../_db.js';
import { requiereSesion } from '../_auth.js';
import { puedeVer } from '../_permisos.js';

// El ítem sólo es accesible si el usuario puede ver su pendiente padre.
async function itemVisible(client, res, itemId, sesion) {
  const { rows } = await client.execute({
    sql: `SELECT c.id, p.creado_por, p.responsable_id
          FROM checklist c JOIN pendientes p ON p.id = c.pendiente_id
          WHERE c.id = ?`,
    args: [itemId],
  });
  if (!rows.length || !puedeVer(rows[0], sesion)) {
    sendError(res, 'No encontrado', 404);
    return false;
  }
  return true;
}

// /api/checklist/:itemId  → PATCH { completado, texto } · DELETE
export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;

  const client = db();
  const { itemId } = req.query;

  if (req.method === 'PATCH') {
    if (!(await itemVisible(client, res, itemId, sesion))) return;
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
    if (!(await itemVisible(client, res, itemId, sesion))) return;
    await client.execute({ sql: 'DELETE FROM checklist WHERE id = ?', args: [itemId] });
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  return sendError(res, 'Método no permitido', 405);
}
