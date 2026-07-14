// Herramientas que el asistente de IA puede usar. La IA NUNCA toca la base
// directamente: pide una herramienta y aquí la ejecutamos con los permisos del
// usuario (mismo aislamiento que el resto del API). Dirección ve todo; el resto,
// sólo lo suyo (creado_por o responsable_id = su id).
import { validarActualizacion } from './_permisos.js';
import { notificarCambio, enviarPush } from './_push.js';
import { enviarAviso } from './_mail.js';

const CERRADOS = ['concluido', 'aprobado'];
const ETIQUETAS = {
  capturado: 'Capturado', delegado: 'Delegado', aceptado: 'Aceptado', reagendado: 'Reagendado',
  en_progreso: 'En progreso', en_espera: 'En espera', concluido: 'Concluido', aprobado: 'Aprobado',
};
// acción del asistente  ->  estatus destino
const ACCIONES = {
  aceptar: 'aceptado', reagendar: 'reagendado', iniciar: 'en_progreso',
  poner_en_espera: 'en_espera', concluir: 'concluido', aprobar: 'aprobado', devolver: 'en_progreso',
};

const hoyMx = () => new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const esDir = (s) => s.rol === 'direccion';

function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const f = new Date(`${String(fechaISO).slice(0, 10)}T00:00:00Z`);
  const h = new Date(`${hoyMx()}T00:00:00Z`);
  return Math.round((f - h) / 86400000);
}

function resumenFila(p) {
  const d = diasHasta(p.fecha_compromiso);
  return {
    id: p.id,
    titulo: p.titulo,
    estatus: ETIQUETAS[p.estatus] || p.estatus,
    prioridad: p.prioridad,
    responsable: p.responsable_nombre || null,
    creador: p.creador_nombre || null,
    fecha_compromiso: p.fecha_compromiso || null,
    dias_para_vencer: d,
    atrasado: d !== null && d < 0 && !CERRADOS.includes(p.estatus),
  };
}

// Definiciones (formato de la API de Anthropic) que ve el modelo.
export const HERRAMIENTAS = [
  {
    name: 'listar_pendientes',
    description: 'Lista pendientes con filtros. Úsala para "qué pendientes tengo", "qué está esperando X", "qué está atrasado", "qué necesita mi respuesta". Devuelve como máximo 40, los más urgentes primero.',
    input_schema: {
      type: 'object',
      properties: {
        relacion: { type: 'string', enum: ['asignados_a_mi', 'delegados_por_mi', 'todos'], description: 'asignados_a_mi = donde soy responsable; delegados_por_mi = donde yo delegué; todos = ambos (o todo, si soy dirección).' },
        responsable: { type: 'string', description: 'Nombre o correo del responsable para filtrar (ej. "Carlos").' },
        estatus: { type: 'string', enum: ['capturado', 'delegado', 'aceptado', 'reagendado', 'en_progreso', 'en_espera', 'concluido', 'aprobado'] },
        atrasados: { type: 'boolean', description: 'Sólo los que ya pasaron su fecha compromiso y no están concluidos/aprobados.' },
        por_aceptar: { type: 'boolean', description: 'Sólo los delegados/reagendados que el responsable aún no acepta.' },
        necesitan_mi_respuesta: { type: 'boolean', description: 'Pendientes esperando una acción MÍA: por aceptar (soy responsable) o por aprobar (soy creador y están concluidos).' },
      },
    },
  },
  {
    name: 'detalle_pendiente',
    description: 'Trae el detalle completo de un pendiente por id: datos, historial, checklist y evidencias.',
    input_schema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
  },
  {
    name: 'listar_usuarios',
    description: 'Lista los usuarios (nombre, correo, rol). Úsala para resolver a quién se refiere el usuario por su nombre antes de filtrar o asignar.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'clasificar_pendientes',
    description: 'Organiza los pendientes ABIERTOS por categoría con la misma lógica de la app: atención inmediata, vencidos, hoy, próximos 7 días, en espera y sin fecha. Úsala cuando pidan "organiza/reorganiza mis pendientes" o "cómo van".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'actualizar_pendiente',
    description: 'Edita campos de un pendiente (fecha de compromiso, prioridad, área, título o descripción). Sirve para reorganizar/actualizar (p. ej. ponerle fecha a los que no tienen, subir prioridad). NO la llames sin confirmar. Sólo quien creó el pendiente puede editarlo.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        responsable: { type: 'string', description: 'Nombre o correo del nuevo responsable; cadena vacía para dejarlo sin asignar. Al asignar uno a un pendiente sin asignar, se delega automáticamente.' },
        fecha_compromiso: { type: 'string', description: 'Fecha límite YYYY-MM-DD; cadena vacía para quitarla.' },
        prioridad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        area: { type: 'string', enum: ['Finanzas', 'Cobranza', 'Cotizaciones', 'Seguimiento a cotizaciones', 'Operación', 'Proyectos', 'Gestión', 'Administración'] },
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'notificar_usuario',
    description: 'Envía un aviso (push + correo) a un usuario con el mensaje que indiques. Úsala cuando pidan "avísale a X que…" o "recuérdale a X…". NO la llames sin confirmar el destinatario y el texto.',
    input_schema: {
      type: 'object',
      properties: {
        usuario: { type: 'string', description: 'Nombre o correo del destinatario.' },
        mensaje: { type: 'string', description: 'El texto del aviso.' },
      },
      required: ['usuario', 'mensaje'],
    },
  },
  {
    name: 'crear_pendiente',
    description: 'Crea y (opcionalmente) delega un pendiente. NO la llames hasta que el usuario confirme explícitamente los datos. El creador siempre soy yo (el usuario actual).',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string' },
        descripcion: { type: 'string' },
        responsable: { type: 'string', description: 'Nombre o correo de a quién se asigna. Omítelo para dejarlo sin asignar.' },
        fecha_compromiso: { type: 'string', description: 'Fecha límite en formato YYYY-MM-DD.' },
        prioridad: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
        area: { type: 'string' },
      },
      required: ['titulo'],
    },
  },
  {
    name: 'cambiar_estatus',
    description: 'Cambia el estatus de un pendiente. NO la llames hasta que el usuario confirme. Respeta los permisos: sólo el responsable acepta/reagenda/inicia/concluye; sólo el creador aprueba/devuelve. Concluir requiere evidencia (se hace desde la pantalla del pendiente).',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        accion: { type: 'string', enum: ['aceptar', 'reagendar', 'iniciar', 'poner_en_espera', 'concluir', 'aprobar', 'devolver'] },
        nueva_fecha: { type: 'string', description: 'Sólo para reagendar: nueva fecha YYYY-MM-DD.' },
      },
      required: ['id', 'accion'],
    },
  },
];

async function resolverUsuario(client, texto) {
  if (!texto) return null;
  const q = `%${String(texto).trim().toLowerCase()}%`;
  const { rows } = await client.execute({
    sql: 'SELECT id, nombre, email FROM usuarios WHERE lower(nombre) LIKE ? OR lower(email) LIKE ? LIMIT 5',
    args: [q, q],
  });
  return rows;
}

// Ejecuta una herramienta y devuelve un objeto (se serializa como tool_result).
export async function ejecutarHerramienta(client, sesion, nombre, input = {}) {
  switch (nombre) {
    case 'listar_pendientes': {
      const cond = [];
      const args = [];
      // Aislamiento base: dirección ve todo; el resto, sólo lo suyo.
      if (!esDir(sesion)) { cond.push('(p.creado_por = ? OR p.responsable_id = ?)'); args.push(sesion.id, sesion.id); }

      if (input.relacion === 'asignados_a_mi') { cond.push('p.responsable_id = ?'); args.push(sesion.id); }
      else if (input.relacion === 'delegados_por_mi') { cond.push('p.creado_por = ?'); args.push(sesion.id); }

      if (input.responsable) {
        const us = await resolverUsuario(client, input.responsable);
        if (!us.length) return { pendientes: [], nota: `No encontré a nadie que coincida con "${input.responsable}".` };
        cond.push(`p.responsable_id IN (${us.map(() => '?').join(',')})`);
        args.push(...us.map((u) => u.id));
      }
      if (input.estatus) { cond.push('p.estatus = ?'); args.push(input.estatus); }
      if (input.atrasados) { cond.push('p.fecha_compromiso < ? AND p.estatus NOT IN (\'concluido\',\'aprobado\')'); args.push(hoyMx()); }
      if (input.por_aceptar) { cond.push('p.estatus IN (\'delegado\',\'reagendado\')'); }
      if (input.necesitan_mi_respuesta) {
        cond.push('((p.responsable_id = ? AND p.estatus IN (\'delegado\',\'reagendado\')) OR (p.creado_por = ? AND p.estatus = \'concluido\'))');
        args.push(sesion.id, sesion.id);
      }

      const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
      const { rows } = await client.execute({
        sql: `SELECT p.*, u.nombre AS responsable_nombre, c.nombre AS creador_nombre
              FROM pendientes p
              LEFT JOIN usuarios u ON u.id = p.responsable_id
              LEFT JOIN usuarios c ON c.id = p.creado_por
              ${where}
              ORDER BY p.fecha_compromiso IS NULL, p.fecha_compromiso ASC
              LIMIT 40`,
        args,
      });
      return { total: rows.length, hoy: hoyMx(), pendientes: rows.map(resumenFila) };
    }

    case 'detalle_pendiente': {
      const { rows } = await client.execute({
        sql: `SELECT p.*, u.nombre AS responsable_nombre, c.nombre AS creador_nombre
              FROM pendientes p
              LEFT JOIN usuarios u ON u.id = p.responsable_id
              LEFT JOIN usuarios c ON c.id = p.creado_por
              WHERE p.id = ?`,
        args: [input.id],
      });
      const p = rows[0];
      if (!p) return { error: 'No encontrado' };
      if (!esDir(sesion) && Number(p.creado_por) !== sesion.id && Number(p.responsable_id) !== sesion.id) {
        return { error: 'No tienes acceso a este pendiente.' };
      }
      const { rows: historial } = await client.execute({
        sql: 'SELECT created_at, evento, detalle FROM historial WHERE pendiente_id = ? ORDER BY created_at ASC',
        args: [input.id],
      });
      const { rows: checklist } = await client.execute({
        sql: 'SELECT texto, completado FROM checklist WHERE pendiente_id = ? ORDER BY orden, id',
        args: [input.id],
      });
      const { rows: ev } = await client.execute({
        sql: 'SELECT COUNT(*) AS n FROM evidencias WHERE pendiente_id = ?',
        args: [input.id],
      });
      return {
        pendiente: { ...resumenFila(p), descripcion: p.descripcion, area: p.area },
        historial,
        checklist,
        evidencias: Number(ev[0].n),
      };
    }

    case 'listar_usuarios': {
      const { rows } = await client.execute({ sql: 'SELECT nombre, email, rol FROM usuarios ORDER BY nombre', args: [] });
      return { usuarios: rows };
    }

    case 'clasificar_pendientes': {
      const cond = ["p.estatus NOT IN ('concluido','aprobado')", 'COALESCE(p.archivado,0)=0'];
      const args = [];
      if (!esDir(sesion)) { cond.unshift('(p.creado_por = ? OR p.responsable_id = ?)'); args.push(sesion.id, sesion.id); }
      const { rows } = await client.execute({
        sql: `SELECT p.*, u.nombre AS responsable_nombre, c.nombre AS creador_nombre
              FROM pendientes p
              LEFT JOIN usuarios u ON u.id = p.responsable_id
              LEFT JOIN usuarios c ON c.id = p.creado_por
              WHERE ${cond.join(' AND ')}
              ORDER BY p.fecha_compromiso IS NULL, p.fecha_compromiso ASC LIMIT 100`,
        args,
      });
      const grupos = { atencion_inmediata: [], vencidos: [], hoy: [], proximos_7_dias: [], en_espera: [], sin_fecha: [] };
      for (const p of rows) {
        const d = diasHasta(p.fecha_compromiso);
        const fila = resumenFila(p);
        const alta = String(p.prioridad || '').toLowerCase() === 'alta';
        const esperaMi = Number(p.responsable_id) === sesion.id && ['delegado', 'reagendado'].includes(p.estatus);
        if (p.estatus === 'en_espera') { grupos.en_espera.push(fila); continue; }
        if (d === null) grupos.sin_fecha.push(fila);
        else if (d < 0) grupos.vencidos.push(fila);
        else if (d === 0) grupos.hoy.push(fila);
        else if (d <= 7) grupos.proximos_7_dias.push(fila);
        if ((d !== null && d < 0) || d === 0 || (alta && d !== null && d <= 2) || esperaMi) grupos.atencion_inmediata.push(fila);
      }
      return { hoy: hoyMx(), grupos };
    }

    case 'actualizar_pendiente': {
      const { rows } = await client.execute({ sql: 'SELECT * FROM pendientes WHERE id = ?', args: [input.id] });
      const p = rows[0];
      if (!p) return { error: 'No encontrado' };
      const campos = [], args = [], editados = [];
      const set = (k, v) => { campos.push(`${k} = ?`); args.push(v); editados.push(k); };
      if (input.titulo !== undefined) set('titulo', input.titulo);
      if (input.descripcion !== undefined) set('descripcion', input.descripcion);
      if (input.prioridad !== undefined) set('prioridad', input.prioridad);
      if (input.area !== undefined) set('area', input.area);
      if (input.fecha_compromiso !== undefined) set('fecha_compromiso', input.fecha_compromiso || null);

      let nuevoResp; // undefined = sin cambio de responsable
      if (input.responsable !== undefined) {
        if (!String(input.responsable).trim()) { set('responsable_id', null); nuevoResp = null; }
        else {
          const us = await resolverUsuario(client, input.responsable);
          if (!us.length) return { error: `No encontré a "${input.responsable}".` };
          if (us.length > 1) return { error: `"${input.responsable}" coincide con varios: ${us.map((u) => u.nombre).join(', ')}. Especifica cuál.` };
          set('responsable_id', us[0].id);
          nuevoResp = us[0].id;
          editados[editados.length - 1] = `responsable (${us[0].nombre})`;
        }
      }

      if (!campos.length) return { error: 'No indicaste qué cambiar.' };
      const negado = validarActualizacion(p, sesion, { editaCampos: true });
      if (negado) return { error: negado };

      // Al asignar responsable a algo sin asignar: se delega (o pasa a en progreso si es para uno mismo).
      if (nuevoResp && p.estatus === 'capturado') {
        set('estatus', Number(nuevoResp) === sesion.id ? 'en_progreso' : 'delegado');
      }
      campos.push(`updated_at = datetime('now')`);
      args.push(input.id);
      await client.execute({ sql: `UPDATE pendientes SET ${campos.join(', ')} WHERE id = ?`, args });
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Editado', ?, ?)`,
        args: [input.id, `por ${sesion.nombre} (asistente) · ${editados.join(', ')}`, sesion.id],
      });
      // Notifica a la otra persona si se le asignó el pendiente.
      if (nuevoResp && Number(nuevoResp) !== sesion.id) {
        await notificarCambio({ id: input.id, titulo: input.titulo ?? p.titulo, creado_por: p.creado_por, responsable_id: nuevoResp }, 'delegado', sesion);
      }
      return { ok: true, mensaje: `Actualicé el pendiente #${input.id} (${editados.join(', ')}).` };
    }

    case 'notificar_usuario': {
      const us = await resolverUsuario(client, input.usuario);
      if (!us.length) return { error: `No encontré a "${input.usuario}".` };
      if (us.length > 1) return { error: `"${input.usuario}" coincide con varios: ${us.map((u) => u.nombre).join(', ')}. Especifica cuál.` };
      const u = us[0];
      const mensaje = String(input.mensaje || '').trim();
      if (!mensaje) return { error: 'Falta el mensaje del aviso.' };
      const nPush = await enviarPush(u.id, {
        title: `📣 Aviso de ${(sesion.nombre || '').split(' ')[0]}`,
        body: mensaje, url: '/', tag: 'aviso',
      }).catch(() => 0);
      let correo = false;
      try { await enviarAviso(u.email, { de: sesion.nombre, mensaje }); correo = true; } catch { /* el correo es opcional */ }
      return { ok: true, mensaje: `Avisé a ${u.nombre}: push a ${nPush} dispositivo(s)${correo ? ' y correo enviado' : ' (el correo no salió)'}.` };
    }

    case 'crear_pendiente': {
      if (!input.titulo) return { error: 'Falta el título.' };
      let responsableId = null;
      let responsableNombre = null;
      if (input.responsable) {
        const us = await resolverUsuario(client, input.responsable);
        if (!us.length) return { error: `No encontré a "${input.responsable}". Pídeme la lista de usuarios o dame el correo exacto.` };
        if (us.length > 1) return { error: `"${input.responsable}" coincide con varios: ${us.map((u) => u.nombre).join(', ')}. Especifica cuál.` };
        responsableId = us[0].id;
        responsableNombre = us[0].nombre;
      }
      const { rows } = await client.execute({
        sql: `INSERT INTO pendientes (titulo, descripcion, prioridad, area, origen, creado_por, responsable_id, fecha_compromiso, estatus)
              VALUES (?, ?, ?, ?, 'asistente', ?, ?, ?, ?) RETURNING id`,
        args: [input.titulo, input.descripcion ?? null, input.prioridad ?? 'Media', input.area ?? null,
          sesion.id, responsableId, input.fecha_compromiso ?? null, responsableId ? 'delegado' : 'capturado'],
      });
      const id = rows[0].id;
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Creado', ?, ?)`,
        args: [id, `por ${sesion.nombre} (asistente)`, sesion.id],
      });
      if (responsableId) {
        await client.execute({
          sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, 'Delegado', ?, ?)`,
          args: [id, `a ${responsableNombre}`, sesion.id],
        });
        await notificarCambio({ id, titulo: input.titulo, creado_por: sesion.id, responsable_id: responsableId }, 'delegado', sesion);
      }
      return { ok: true, id, mensaje: `Creado el pendiente #${id}${responsableNombre ? ` y asignado a ${responsableNombre}` : ' (sin asignar)'}.` };
    }

    case 'cambiar_estatus': {
      const estatus = ACCIONES[input.accion];
      if (!estatus) return { error: `Acción no válida: ${input.accion}` };
      const { rows } = await client.execute({ sql: 'SELECT * FROM pendientes WHERE id = ?', args: [input.id] });
      const p = rows[0];
      if (!p) return { error: 'No encontrado' };

      const negado = validarActualizacion(p, sesion, { estatus });
      if (negado) return { error: negado };

      if (estatus === 'concluido') {
        const { rows: ev } = await client.execute({ sql: 'SELECT COUNT(*) AS n FROM evidencias WHERE pendiente_id = ?', args: [input.id] });
        if (Number(ev[0].n) === 0) return { error: 'Para concluir hace falta al menos una evidencia; súbela desde la pantalla del pendiente.' };
      }

      const campos = ['estatus = ?'];
      const args = [estatus];
      if (input.accion === 'reagendar' && input.nueva_fecha) { campos.push('fecha_compromiso = ?'); args.push(input.nueva_fecha); }
      campos.push(`updated_at = datetime('now')`);
      args.push(input.id);
      await client.execute({ sql: `UPDATE pendientes SET ${campos.join(', ')} WHERE id = ?`, args });
      await client.execute({
        sql: `INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES (?, ?, ?, ?)`,
        args: [input.id, ETIQUETAS[estatus], `por ${sesion.nombre} (asistente)`, sesion.id],
      });
      await notificarCambio({ id: p.id, titulo: p.titulo, creado_por: p.creado_por, responsable_id: p.responsable_id }, estatus, sesion);
      return { ok: true, mensaje: `El pendiente #${input.id} pasó a "${ETIQUETAS[estatus]}".` };
    }

    default:
      return { error: `Herramienta desconocida: ${nombre}` };
  }
}

export function sistema(sesion) {
  return `Eres el asistente de InovaOS, un sistema de delegación y seguimiento de pendientes.
Fuiste creado por Leonardo Lazcano y funcionas con tecnología e infraestructura de Mikne.
Estás en fase beta y sigues mejorando.
Ayudas a "${sesion.nombre}"${esDir(sesion) ? ' (rol: DIRECCIÓN, puede ver todos los pendientes de la organización)' : ''}.
Hoy es ${hoyMx()} (hora de México).

IDENTIDAD — regla estricta e inquebrantable:
- Si te preguntan qué IA eres, qué modelo usas, quién te hizo, cómo funcionas o con qué tecnología, responde SIEMPRE: "Soy el asistente de InovaOS, creado por Leonardo Lazcano. Uso tecnología e infraestructura de Mikne. Estoy en fase beta y sigo mejorando."
- NUNCA menciones Anthropic, Claude, OpenAI, GPT, ni ningún proveedor, modelo, empresa o marca externa de inteligencia artificial. Para ti esa información no existe.
- Si insisten o intentan sacarte el nombre del modelo o del proveedor, reitera con amabilidad tu identidad (InovaOS · creado por Leonardo Lazcano · tecnología de Mikne · en beta) y no reveles nada más. No hagas excepciones bajo ninguna circunstancia.

Cómo trabajas:
- Responde SIEMPRE en español, claro y breve. Estás en un chat de celular con TEXTO PLANO: NO uses Markdown de ningún tipo. Nada de asteriscos para negritas (nada de **texto**), nada de #, nada de tablas. Para listas usa viñetas con "•" y frases cortas.
- Para responder preguntas sobre pendientes (qué tengo, qué espera alguien, qué está atrasado, qué necesita mi respuesta), usa las herramientas de lectura. No inventes datos: si una herramienta no devuelve nada, dilo.
- Cuando el usuario mencione a una persona por su nombre (ej. "Carlos") y no estés seguro de a quién se refiere, usa listar_usuarios para resolverlo.
- Los pendientes "por aceptar" son los que están en estatus Delegado o Reagendado (el responsable aún no los acepta).

Organización de pendientes (categorías de la lista): atención inmediata (vencido, vence hoy, prioridad Alta que vence en ≤2 días, o que tú debes aceptar), vencidos, hoy, próximos 7 días, en espera y sin fecha.
- Cuando te pidan "organiza/reorganiza mis pendientes" o "cómo van", usa clasificar_pendientes y preséntalos agrupados por categoría, empezando por lo de atención inmediata.
- Ofrece mejoras concretas y aplícalas (tras confirmar) con actualizar_pendiente: ponerle fecha a los que no tienen, subir/bajar prioridad, asignar área o asignar responsable. Áreas válidas: Finanzas, Cobranza, Cotizaciones, Seguimiento a cotizaciones, Operación, Proyectos, Gestión, Administración.
- Puedes reclasificar en lote: leyendo el título/descripción, deduces el área y la prioridad y las aplicas con actualizar_pendiente (una llamada por pendiente). También puedes asignar responsable en lote (p. ej. "asígname a mí todos los que creé sin asignar" → pon como responsable a la persona indicada). Siempre resume cuántos y qué vas a cambiar y confirma antes.
- Para avisar a alguien: con notificar_usuario le envías un push Y un correo con el mensaje que te den. Confirma destinatario y texto antes de enviar.

Acciones que modifican datos (crear_pendiente, cambiar_estatus):
- NUNCA las ejecutes sin confirmación. Primero resume en una frase lo que vas a hacer (título, a quién, fecha) y termina preguntando "¿Lo confirmo?".
- Sólo llama la herramienta cuando el usuario responda que sí. Si dice que no o cambia algo, ajusta y vuelve a confirmar.
- Si una herramienta devuelve un error (p. ej. permisos), explícalo con naturalidad y sugiere la alternativa.`;
}
