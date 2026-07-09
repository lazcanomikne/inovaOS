import { db, sendJson, sendError, readBody } from '../_db.js';

// /api/pendientes  → GET lista · POST crear/delegar
export default async function handler(req, res) {
  const client = db();

  if (req.method === 'GET') {
    const responsable = req.query.responsable_id;
    let sql = `
      SELECT p.*, u.nombre AS responsable_nombre
      FROM pendientes p
      LEFT JOIN usuarios u ON u.id = p.responsable_id
    `;
    const args = [];
    if (responsable) { sql += ' WHERE p.responsable_id = ?'; args.push(responsable); }
    sql += ' ORDER BY p.fecha_compromiso IS NULL, p.fecha_compromiso ASC';
    const { rows } = await client.execute({ sql, args });
    return sendJson(res, rows);
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.titulo) return sendError(res, 'El título es obligatorio');

    const { rows } = await client.execute({
      sql: `INSERT INTO pendientes
        (titulo, descripcion, cliente, tipo, prioridad, area, origen, creado_por, responsable_id, fecha_compromiso, estatus)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        b.titulo,
        b.descripcion ?? null,
        b.cliente ?? null,
        b.tipo ?? null,
        b.prioridad ?? 'Media',
        b.area ?? null,
        b.origen ?? 'manual',
        b.creado_por ?? 1,
        b.responsable_id ?? null,
        b.fecha_compromiso ?? null,
        b.responsable_id ? 'delegado' : 'capturado',
      ],
    });
    const pendiente = rows[0];

    await client.execute({
      sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Creado', ?, ?)`,
      args: [pendiente.id, `origen: ${b.origen ?? 'manual'}`, b.creado_por ?? 1],
    });
    if (b.responsable_id) {
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Delegado', ?, ?)`,
        args: [pendiente.id, `a responsable ${b.responsable_id}`, b.creado_por ?? 1],
      });
    }
    return sendJson(res, pendiente, 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Método no permitido', 405);
}
