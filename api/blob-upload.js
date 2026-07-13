// Genera el token para que el navegador suba el archivo DIRECTO a Vercel Blob
// (evita el límite de 4.5MB del cuerpo de las funciones). Aquí sólo autorizamos.
import { handleUpload } from '@vercel/blob/client';
import { db, sendError } from './_db.js';
import { sesionDe } from './_auth.js';
import { puedeVer } from './_permisos.js';

const TIPOS = [
  'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif',
  'application/pdf',
];

export default async function handler(req, res) {
  try {
    const jsonResponse = await handleUpload({
      token: process.env.BLOB_READ_WRITE_TOKEN, // explícito: evita el modo OIDC
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // La cookie de sesión viaja en la petición (mismo origen).
        const sesion = await sesionDe(req);
        if (!sesion) throw new Error('No autenticado');

        const { pendiente_id } = clientPayload ? JSON.parse(clientPayload) : {};
        if (!pendiente_id) throw new Error('Falta pendiente_id');

        const { rows } = await db().execute({
          sql: 'SELECT creado_por, responsable_id FROM pendientes WHERE id = ?',
          args: [pendiente_id],
        });
        if (!rows.length || !puedeVer(rows[0], sesion)) throw new Error('No autorizado');

        return {
          allowedContentTypes: TIPOS,
          maximumSizeInBytes: 15 * 1024 * 1024, // 15 MB
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pendiente_id, usuario_id: sesion.id }),
        };
      },
      // El metadato se registra desde el cliente tras subir (funciona en local
      // y en prod); aquí no hace falta el webhook onUploadCompleted.
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (e) {
    return sendError(res, e.message || 'No se pudo autorizar la subida', 400);
  }
}
