import { db, sendJson, sendError, readBody, nombreUsuario } from '../_db.js';

function etiqueta(e) {
  return {
    aceptado: 'Aceptado', en_progreso: 'En progreso', en_espera: 'En espera',
    concluido: 'Concluido', aprobado: 'Aprobado', reagendado: 'Reagendado', delegado: 'Delegado',
  }[e] || e;
}

// /api/pendientes/:id  → GET detalle+historial · PATCH · DELETE
export default async function handler(req, res) {
  const client = db();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { rows } = await client.execute({
      sql: `SELECT p.*, u.nombre AS responsable_nombre, c.nombre AS creador_nombre
            FROM pendientes p
            LEFT JOIN usuarios u ON u.id = p.responsable_id
            LEFT JOIN usuarios c ON c.id = p.creado_por
            WHERE p.id = ?`,
      args: [id],
    });
    if (!rows.length) return sendError(res, 'No encontrado', 404);

    // created_at viene en UTC ('YYYY-MM-DD HH:MM:SS'); el cliente lo pasa a hora local.
    const { rows: historial } = await client.execute({
      sql: `SELECT created_at, evento, detalle
            FROM historial WHERE pendiente_id = ? ORDER BY created_at ASC`,
      args: [id],
    });
    const { rows: checklist } = await client.execute({
      sql: 'SELECT * FROM checklist WHERE pendiente_id = ? ORDER BY orden, id',
      args: [id],
    });
    return sendJson(res, { pendiente: rows[0], historial, checklist });
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const b = readBody(req);
    const EDITABLES = ['titulo', 'descripcion', 'prioridad', 'area', 'responsable_id', 'fecha_compromiso', 'comentario_cierre'];

    const campos = [];
    const args = [];
    const editados = [];
    for (const key of EDITABLES) {
      if (b[key] !== undefined) { campos.push(`${key} = ?`); args.push(b[key]); editados.push(key); }
    }
    // Al asignar responsable a algo que estaba sin asignar, pasa a 'delegado'.
    let estatus = b.estatus;
    if (!estatus && b.responsable_id) {
      const actual = await client.execute({ sql: 'SELECT estatus FROM pendientes WHERE id = ?', args: [id] });
      if (actual.rows[0]?.estatus === 'capturado') estatus = 'delegado';
    }
    if (estatus) { campos.push('estatus = ?'); args.push(estatus); }

    if (!campos.length) return sendError(res, 'Nada que actualizar');
    campos.push(`updated_at = datetime('now')`);
    args.push(id);

    await client.execute({ sql: `UPDATE pendientes SET ${campos.join(', ')} WHERE id = ?`, args });

    const actor = await nombreUsuario(client, b.actor_id);
    const porActor = actor ? `por ${actor}` : null;

    if (estatus) {
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, ?, ?, ?)`,
        args: [id, etiqueta(estatus), b.detalle ?? porActor, b.actor_id ?? null],
      });
    } else if (editados.length) {
      // Edición sin cambio de estatus: queda registrada en la trazabilidad.
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Editado', ?, ?)`,
        args: [id, [porActor, `campos: ${editados.join(', ')}`].filter(Boolean).join(' · '), b.actor_id ?? null],
      });
    }

    const { rows } = await client.execute({ sql: 'SELECT * FROM pendientes WHERE id = ?', args: [id] });
    return sendJson(res, rows[0]);
  }

  if (req.method === 'DELETE') {
    await client.execute({ sql: 'DELETE FROM pendientes WHERE id = ?', args: [id] });
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH, PUT, DELETE');
  return sendError(res, 'Método no permitido', 405);
}
