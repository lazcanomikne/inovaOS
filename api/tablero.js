import { db, sendJson, colorEstatus } from './_db.js';

// /api/tablero  → resumen semáforo + próximos a vencer
export default async function handler(req, res) {
  const client = db();
  const { rows } = await client.execute(`
    SELECT p.*, u.nombre AS responsable_nombre
    FROM pendientes p LEFT JOIN usuarios u ON u.id = p.responsable_id
  `);

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
