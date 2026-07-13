import { db, sendJson, sendError, readBody } from '../_db.js';
import { requiereSesion } from '../_auth.js';
import { puedeVer } from '../_permisos.js';
import { enviarPush } from '../_push.js';

// Un solo endpoint para todo el checklist:
//   GET    /api/checklist?pendiente_id=1   → lista (con asignado_a + nombre)
//   POST   /api/checklist                   → { pendiente_id, texto, asignado_a? }
//   PATCH  /api/checklist?item=5            → { completado?, texto?, asignado_a? }
//   DELETE /api/checklist?item=5

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

// Un ítem es accesible para el creador/responsable del pendiente, o para el
// usuario etiquetado en ese ítem (que puede marcarlo como completado).
async function traerItem(client, itemId) {
  const { rows } = await client.execute({
    sql: `SELECT c.*, p.creado_por, p.responsable_id
          FROM checklist c JOIN pendientes p ON p.id = c.pendiente_id
          WHERE c.id = ?`,
    args: [itemId],
  });
  return rows[0] || null;
}

async function notificarTag(client, pendienteId, asignadoA, actor) {
  if (!asignadoA || Number(asignadoA) === Number(actor.id)) return;
  const { rows } = await client.execute({ sql: 'SELECT titulo FROM pendientes WHERE id = ?', args: [pendienteId] });
  const titulo = rows[0]?.titulo || 'un pendiente';
  const quien = (actor.nombre || 'Alguien').split(' ')[0];
  await enviarPush(asignadoA, {
    title: '📋 Te etiquetaron en un checklist',
    body: `${quien} te asignó un paso en «${titulo}»`,
    url: '/', tag: `pend-${pendienteId}`,
  }).catch(() => {});
}

export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;

  const client = db();
  const itemId = req.query.item;

  // --- Operaciones sobre un ítem: /checklist?item=5 ---
  if (itemId) {
    const item = await traerItem(client, itemId);
    if (!item) return sendError(res, 'No encontrado', 404);
    const esDueño = puedeVer(item, sesion);            // creador o responsable del pendiente
    const esEtiquetado = Number(item.asignado_a) === sesion.id;
    if (!esDueño && !esEtiquetado) return sendError(res, 'No encontrado', 404);

    if (req.method === 'PATCH') {
      const b = readBody(req);
      const campos = [];
      const args = [];
      if (b.completado !== undefined) { campos.push('completado = ?'); args.push(b.completado ? 1 : 0); }
      // Editar el texto o la asignación sólo lo hace el dueño del pendiente.
      if ((b.texto !== undefined || b.asignado_a !== undefined) && !esDueño) {
        return sendError(res, 'Sólo el creador o responsable puede editar el paso', 403);
      }
      if (b.texto !== undefined) { campos.push('texto = ?'); args.push(b.texto); }
      let nuevoTag = null;
      if (b.asignado_a !== undefined) {
        nuevoTag = b.asignado_a ? Number(b.asignado_a) : null;
        campos.push('asignado_a = ?'); args.push(nuevoTag);
      }
      if (!campos.length) return sendError(res, 'Nada que actualizar');
      args.push(itemId);
      await client.execute({ sql: `UPDATE checklist SET ${campos.join(', ')} WHERE id = ?`, args });

      // Notifica sólo si la etiqueta CAMBIÓ a un usuario nuevo.
      if (nuevoTag && nuevoTag !== Number(item.asignado_a)) {
        await notificarTag(client, item.pendiente_id, nuevoTag, sesion);
      }

      const { rows } = await client.execute({
        sql: `SELECT c.*, u.nombre AS asignado_nombre FROM checklist c
              LEFT JOIN usuarios u ON u.id = c.asignado_a WHERE c.id = ?`,
        args: [itemId],
      });
      return sendJson(res, rows[0]);
    }
    if (req.method === 'DELETE') {
      if (!esDueño) return sendError(res, 'Sólo el creador o responsable puede borrar el paso', 403);
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
      sql: `SELECT c.*, u.nombre AS asignado_nombre FROM checklist c
            LEFT JOIN usuarios u ON u.id = c.asignado_a
            WHERE c.pendiente_id = ? ORDER BY c.orden, c.id`,
      args: [pendiente_id],
    });
    return sendJson(res, rows);
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.pendiente_id || !b.texto) return sendError(res, 'Faltan pendiente_id o texto');
    if (!(await pendienteVisible(client, res, b.pendiente_id, sesion))) return;
    const asignado = b.asignado_a ? Number(b.asignado_a) : null;
    const { rows } = await client.execute({
      sql: 'INSERT INTO checklist (pendiente_id, texto, orden, asignado_a) VALUES (?, ?, ?, ?) RETURNING *',
      args: [b.pendiente_id, b.texto, b.orden ?? 0, asignado],
    });
    const item = rows[0];
    if (asignado) {
      await notificarTag(client, b.pendiente_id, asignado, sesion);
      const { rows: n } = await client.execute({ sql: 'SELECT nombre FROM usuarios WHERE id = ?', args: [asignado] });
      item.asignado_nombre = n[0]?.nombre || null;
    }
    return sendJson(res, item, 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Método no permitido', 405);
}
