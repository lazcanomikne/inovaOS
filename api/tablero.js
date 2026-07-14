import { db, sendJson, colorEstatus } from './_db.js';
import { requiereSesion } from './_auth.js';

const hoyMx = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);

// Métricas por colaborador. Dirección ve a todos; un colaborador, sólo lo suyo.
// Se mide sobre los pendientes donde la persona es RESPONSABLE.
async function metricas(res, client, sesion) {
  const esDir = sesion.rol === 'direccion';
  const hoy = hoyMx();
  const filtro = esDir ? '' : 'AND p.responsable_id = ?';
  const fArgs = esDir ? [] : [sesion.id];

  const { rows: usuarios } = await client.execute({
    sql: esDir
      ? 'SELECT id, nombre, rol FROM usuarios ORDER BY nombre'
      : 'SELECT id, nombre, rol FROM usuarios WHERE id = ?',
    args: esDir ? [] : [sesion.id],
  });

  // Conteos: total asignados, completados, retrasos (vencidos sin cerrar).
  const base = await client.execute({
    sql: `SELECT p.responsable_id AS uid,
            COUNT(*) AS total,
            SUM(CASE WHEN p.estatus IN ('concluido','aprobado') THEN 1 ELSE 0 END) AS completados,
            SUM(CASE WHEN p.fecha_compromiso < ? AND p.estatus NOT IN ('concluido','aprobado') THEN 1 ELSE 0 END) AS retrasos
          FROM pendientes p
          WHERE p.responsable_id IS NOT NULL AND COALESCE(p.archivado, 0) = 0 ${filtro}
          GROUP BY p.responsable_id`,
    args: [hoy, ...fArgs],
  });

  // Tiempo de respuesta: horas promedio de "Creado" a "Aceptado".
  const tiempos = await client.execute({
    sql: `SELECT p.responsable_id AS uid,
            AVG((julianday(h.created_at) - julianday(p.created_at)) * 24.0) AS horas
          FROM pendientes p
          JOIN historial h ON h.pendiente_id = p.id AND h.evento = 'Aceptado'
          WHERE p.responsable_id IS NOT NULL AND COALESCE(p.archivado, 0) = 0 ${filtro}
          GROUP BY p.responsable_id`,
    args: fArgs,
  });

  // Calidad de evidencia: evidencias promedio por pendiente completado.
  const evid = await client.execute({
    sql: `SELECT p.responsable_id AS uid,
            COUNT(DISTINCT p.id) AS completados,
            COUNT(e.id) AS evidencias
          FROM pendientes p
          LEFT JOIN evidencias e ON e.pendiente_id = p.id
          WHERE p.estatus IN ('concluido','aprobado') AND p.responsable_id IS NOT NULL AND COALESCE(p.archivado, 0) = 0 ${filtro}
          GROUP BY p.responsable_id`,
    args: fArgs,
  });

  const porUid = (rows) => Object.fromEntries(rows.map((r) => [Number(r.uid), r]));
  const B = porUid(base.rows), T = porUid(tiempos.rows), E = porUid(evid.rows);

  const colaboradores = usuarios.map((u) => {
    const b = B[u.id] || {}, t = T[u.id] || {}, e = E[u.id] || {};
    const total = Number(b.total || 0);
    const completados = Number(b.completados || 0);
    const evCompletados = Number(e.completados || 0);
    return {
      id: u.id,
      nombre: u.nombre,
      rol: u.rol,
      total,
      completados,
      retrasos: Number(b.retrasos || 0),
      cumplimiento: total ? Math.round((completados / total) * 100) : null,
      tiempo_respuesta_horas: t.horas != null ? Math.round(Number(t.horas) * 10) / 10 : null,
      calidad_evidencia: evCompletados ? Math.round((Number(e.evidencias || 0) / evCompletados) * 10) / 10 : null,
    };
  }).sort((a, b) => b.total - a.total);

  return sendJson(res, { direccion: esDir, colaboradores });
}

// /api/tablero            → resumen semáforo + próximos a vencer
// /api/tablero?metricas=1 → métricas por colaborador
export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;

  const client = db();
  if (req.query.metricas !== undefined) return metricas(res, client, sesion);
  // Sólo los pendientes del usuario: asignados a él o delegados por él.
  const { rows } = await client.execute({
    sql: `SELECT p.*, u.nombre AS responsable_nombre
          FROM pendientes p LEFT JOIN usuarios u ON u.id = p.responsable_id
          WHERE (p.creado_por = ? OR p.responsable_id = ?) AND COALESCE(p.archivado, 0) = 0`,
    args: [sesion.id, sesion.id],
  });

  const semaforo = { vencido: 0, hoy: 0, manana: 0, tiempo: 0, concluido: 0, espera: 0 };
  for (const p of rows) {
    const c = colorEstatus(p);
    semaforo[c] = (semaforo[c] || 0) + 1;
  }

  const proximos = rows
    .filter((p) => !['concluido', 'aprobado'].includes(p.estatus) && p.fecha_compromiso)
    .sort((a, b) => new Date(a.fecha_compromiso) - new Date(b.fecha_compromiso))
    .slice(0, 5);

  return sendJson(res, { semaforo, proximos });
}
