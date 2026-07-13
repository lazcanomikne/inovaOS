import { db, sendJson, sendError, readBody, nombreUsuario } from '../_db.js';
import { requiereSesion } from '../_auth.js';
import { notificarCambio } from '../_push.js';

// /api/pendientes  → GET lista · POST crear/delegar   (requiere sesión)
export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;

  const client = db();

  if (req.method === 'GET') {
    // Cada quien ve lo suyo: lo que le asignaron, lo que él delegó, o los
    // pendientes donde lo etiquetaron en un paso del checklist.
    const { rows } = await client.execute({
      sql: `
        SELECT p.*, u.nombre AS responsable_nombre
        FROM pendientes p
        LEFT JOIN usuarios u ON u.id = p.responsable_id
        WHERE p.creado_por = ? OR p.responsable_id = ?
           OR p.id IN (SELECT pendiente_id FROM checklist WHERE asignado_a = ?)
        ORDER BY p.fecha_compromiso IS NULL, p.fecha_compromiso ASC`,
      args: [sesion.id, sesion.id, sesion.id],
    });
    return sendJson(res, rows);
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    if (!b.titulo) return sendError(res, 'El título es obligatorio');

    // El autor sale de la sesión, nunca del cuerpo de la petición.
    const creadoPor = sesion.id;

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
        creadoPor,
        b.responsable_id ?? null,
        b.fecha_compromiso ?? null,
        b.responsable_id ? 'delegado' : 'capturado',
      ],
    });
    const pendiente = rows[0];

    await client.execute({
      sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Creado', ?, ?)`,
      args: [pendiente.id, `por ${sesion.nombre}`, creadoPor],
    });
    if (b.responsable_id) {
      const responsable = await nombreUsuario(client, b.responsable_id);
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Delegado', ?, ?)`,
        args: [pendiente.id, responsable ? `a ${responsable}` : null, creadoPor],
      });
      // Push en tiempo real al responsable: "te asignaron un pendiente".
      await notificarCambio(pendiente, 'delegado', sesion);
    }
    return sendJson(res, pendiente, 201);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendError(res, 'Método no permitido', 405);
}
