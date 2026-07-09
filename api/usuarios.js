import { db, sendJson } from './_db.js';

// /api/usuarios
export default async function handler(req, res) {
  const client = db();
  const { rows } = await client.execute('SELECT id, nombre, email, rol, avatar FROM usuarios ORDER BY nombre');
  return sendJson(res, rows);
}
