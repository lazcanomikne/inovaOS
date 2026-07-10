import { db, sendJson } from './_db.js';
import { requiereSesion } from './_auth.js';

// /api/usuarios
export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;

  const client = db();
  const { rows } = await client.execute('SELECT id, nombre, email, rol, avatar FROM usuarios ORDER BY nombre');
  return sendJson(res, rows);
}
