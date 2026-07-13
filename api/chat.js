// /api/chat  → el asistente de IA. Corre el bucle de "tool use" contra Claude:
// el modelo pide herramientas, nosotros las ejecutamos contra Turso (con los
// permisos del usuario) y le devolvemos los datos hasta que redacta la respuesta.
import Anthropic from '@anthropic-ai/sdk';
import { db, sendJson, sendError, readBody } from './_db.js';
import { requiereSesion } from './_auth.js';
import { HERRAMIENTAS, ejecutarHerramienta, sistema } from './_ia.js';

const MODELO = 'claude-haiku-4-5';
const MAX_VUELTAS = 6; // tope de rondas de herramientas por mensaje

export default async function handler(req, res) {
  const sesion = await requiereSesion(req, res);
  if (!sesion) return;
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendError(res, 'Método no permitido', 405); }

  if (!process.env.ANTHROPIC_API_KEY) {
    return sendError(res, 'El asistente no está configurado (falta ANTHROPIC_API_KEY).', 503);
  }

  const b = readBody(req);
  const historial = Array.isArray(b.mensajes) ? b.mensajes : [];
  // Convertimos el historial visible (texto) al formato de la API.
  const messages = historial
    .filter((m) => m && m.texto && (m.rol === 'user' || m.rol === 'assistant'))
    .slice(-20)
    .map((m) => ({ role: m.rol, content: String(m.texto) }));

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return sendError(res, 'Falta el mensaje del usuario.');
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const client = db();
  const usadas = [];

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
      const respuesta = await anthropic.messages.create({
        model: MODELO,
        max_tokens: 1024,
        system: sistema(sesion),
        tools: HERRAMIENTAS,
        messages,
      });

      if (respuesta.stop_reason === 'tool_use') {
        const usos = respuesta.content.filter((c) => c.type === 'tool_use');
        messages.push({ role: 'assistant', content: respuesta.content });
        const resultados = [];
        for (const u of usos) {
          usadas.push(u.name);
          let salida;
          try {
            salida = await ejecutarHerramienta(client, sesion, u.name, u.input || {});
          } catch (e) {
            salida = { error: e.message };
          }
          resultados.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(salida) });
        }
        messages.push({ role: 'user', content: resultados });
        continue; // otra vuelta para que el modelo lea los resultados
      }

      // Sin más herramientas: juntamos el texto y respondemos.
      const texto = respuesta.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
      return sendJson(res, { respuesta: texto || '(sin respuesta)', herramientas: usadas });
    }

    return sendJson(res, { respuesta: 'Me enredé consultando los datos. ¿Puedes reformular la pregunta?', herramientas: usadas });
  } catch (e) {
    const status = e?.status || e?.statusCode;
    if (status === 401) return sendError(res, 'La clave del asistente no es válida.', 502);
    if (status === 429) return sendError(res, 'El asistente está saturado, intenta en un momento.', 429);
    return sendError(res, `El asistente falló: ${e.message}`, 502);
  }
}
