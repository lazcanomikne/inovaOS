import { db, sendJson, sendError, readBody } from '../_db.js';
import { requiereSesion } from '../_auth.js';
import { puedeVer } from '../_permisos.js';

// Un solo endpoint para todo el checklist (así ahorramos una función serverless):
//   GET  /api/checklist?pendiente_id=1   → lista
//   POST /api/checklist                   → { pendiente_id, texto }
//   PATCH  /api/checklist?item=5          → { completado, texto }
//   DELETE /api/checklist?item=5
// (El id del ítem va por query, no por path: una función index.js sí matchea
//  la ruta base en Vercel; un catch-all [[...]] no matchea /api/checklist a secas.)

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

export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;

  const client = db();
  const itemId = req.query.item;

  // --- Operaciones sobre un ítem: /checklist?item=5 ---
  if (itemId) {
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

  // --- Colección: /checklist ---
  if (req.method === 'GET') {
    const { pendiente_id } = req.query;
    if (!pendiente_id) return sendError(res, 'Falta pendiente_id');
    if (!(await pendienteVisible(client, res, pendiente_id, sesion))) return;
    const { rows } = await client.execute({
      sql: 'SELECT * FROM checklist WHERE pendiente_id = ? ORDER BY orden, id',
      args: [pendiente_id],
    });
    return sendJson(res, rows);
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.pendiente_id || !b.texto) return sendError(res, 'Faltan pendiente_id o texto');
    if (!(await pendienteVisible(client, res, b.pendiente_id, sesion))) return;
    const { rows } = await client.execute({
      sql: 'INSERT INTO checklist (pendiente_id, texto, orden) VALUES (?, ?, ?) RETURNING *',
      args: [b.pendiente_id, b.texto, b.orden ?? 0],
    });
    return sendJson(res, rows[0], 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Método no permitido', 405);
}
