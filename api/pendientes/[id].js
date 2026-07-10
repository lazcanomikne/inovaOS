import { db, sendJson, sendError, readBody, nombreUsuario } from '../_db.js';
import { requiereSesion } from '../_auth.js';
import { validarActualizacion, puedeEliminar } from '../_permisos.js';

function etiqueta(e) {
  return {
    aceptado: 'Aceptado', en_progreso: 'En progreso', en_espera: 'En espera',
    concluido: 'Concluido', aprobado: 'Aprobado', reagendado: 'Reagendado', delegado: 'Delegado',
  }[e] || e;
}

const traer = async (client, id) =>
  (await client.execute({ sql: 'SELECT * FROM pendientes WHERE id = ?', args: [id] })).rows[0] ?? null;

// /api/pendientes/:id  → GET detalle · PATCH · DELETE   (requiere sesión)
export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;

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

    const actual = await traer(client, id);
    if (!actual) return sendError(res, 'No encontrado', 404);

    const campos = [];
    const args = [];
    const editados = [];
    for (const key of EDITABLES) {
      if (b[key] !== undefined) { campos.push(`${key} = ?`); args.push(b[key]); editados.push(key); }
    }

    // Al asignar responsable a algo sin asignar, pasa a 'delegado'.
    let estatus = b.estatus;
    if (!estatus && b.responsable_id && actual.estatus === 'capturado') estatus = 'delegado';

    // Autorización: reagendar cambia la fecha, así que no cuenta como "edición".
    const camposDeEdicion = editados.filter((k) => !(estatus === 'reagendado' && k === 'fecha_compromiso'));
    const negado = validarActualizacion(actual, sesion, {
      estatus,
      editaCampos: camposDeEdicion.length > 0,
    });
    if (negado) return sendError(res, negado, 403);

    if (estatus) { campos.push('estatus = ?'); args.push(estatus); }
    if (!campos.length) return sendError(res, 'Nada que actualizar');
    campos.push(`updated_at = datetime('now')`);
    args.push(id);

    await client.execute({ sql: `UPDATE pendientes SET ${campos.join(', ')} WHERE id = ?`, args });

    const porActor = `por ${sesion.nombre}`;
    if (estatus) {
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, ?, ?, ?)`,
        args: [id, etiqueta(estatus), b.detalle ?? porActor, sesion.id],
      });
    } else if (editados.length) {
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Editado', ?, ?)`,
        args: [id, `${porActor} · campos: ${editados.join(', ')}`, sesion.id],
      });
    }

    return sendJson(res, await traer(client, id));
  }

  if (req.method === 'DELETE') {
    const actual = await traer(client, id);
    if (!actual) return sendError(res, 'No encontrado', 404);
    if (!puedeEliminar(actual, sesion)) return sendError(res, 'Sólo quien delegó el pendiente puede eliminarlo', 403);

    await client.execute({ sql: 'DELETE FROM pendientes WHERE id = ?', args: [id] });
    return sendJson(res, { ok: true });
  }

  res.setHeader('Allow', 'GET, PATCH, PUT, DELETE');
  return sendError(res, 'Método no permitido', 405);
}
