// Helpers de dominio para pendientes (semáforo, fechas, etiquetas, permisos y flujo).

export const ETIQUETAS = {
  capturado: 'Capturado',
  delegado: 'Delegado',
  aceptado: 'Aceptado',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  concluido: 'Concluido',
  aprobado: 'Aprobado',
  reagendado: 'Reagendado',
};

export const CERRADOS = ['concluido', 'aprobado'];

export function diasRestantes(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  return Math.round((f - hoy) / 86400000);
}

export function estatusColor(p) {
  if (CERRADOS.includes(p.estatus)) return 'concluido';
  if (p.estatus === 'en_espera') return 'espera';
  const d = diasRestantes(p.fecha_compromiso);
  if (d === null) return 'tiempo';
  if (d < 0) return 'vencido';
  if (d === 0) return 'hoy';
  if (d === 1) return 'manana';
  return 'tiempo';
}

export function etiquetaEstatus(e) {
  return ETIQUETAS[e] || e;
}

export function formatFecha(fecha) {
  const d = diasRestantes(fecha);
  if (d === null) return '—';
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d === -1) return 'hace 1 día';
  if (d < 0) return `hace ${-d} días`;
  return `en ${d} días`;
}

// SQLite guarda 'YYYY-MM-DD HH:MM:SS' en UTC. Lo pasamos a hora local del dispositivo.
export function horaLocal(createdAt) {
  if (!createdAt) return '';
  const iso = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ------------------------- Permisos ------------------------- */

export const esCreador = (p, u) => !!u && p.creado_por === u.id;
export const esResponsable = (p, u) => !!u && p.responsable_id === u.id;
export const puedeVer = (p, u) => esCreador(p, u) || esResponsable(p, u);
// Tarea personal: el usuario es a la vez creador y responsable. Estas se
// cierran en un toque, sin evidencia ni revisión.
export const esPersonal = (p, u) => esCreador(p, u) && esResponsable(p, u);

// Cada quien actúa según su papel en el pendiente. Dirección no tiene poderes
// extra (decisión de negocio: ve y actúa igual que un colaborador).
const puedeComoResponsable = (p, u) => esResponsable(p, u);
const puedeComoCreador = (p, u) => esCreador(p, u);

// Relación del usuario con el pendiente (para filtrar/etiquetar en la UI).
export function relacionCon(p, u) {
  const mia = esResponsable(p, u); // me lo asignaron
  const delegada = esCreador(p, u); // yo lo delegué
  if (mia && delegada) return 'ambas';
  if (mia) return 'mia';
  if (delegada) return 'delegada';
  return null;
}

// El creador (o dirección) edita y elimina. No se edita lo ya aprobado.
export const puedeEditar = (p, u) => puedeComoCreador(p, u) && p.estatus !== 'aprobado';
export const puedeEliminar = (p, u) => puedeComoCreador(p, u);

/* ------------------------- Flujo (pasos 2-6) -------------------------
   Devuelve las acciones disponibles para ESTE usuario en ESTE estatus.
   tipo: 'estatus' aplica un cambio directo; 'reagendar' abre el selector de fecha.
--------------------------------------------------------------------- */
export function accionesDisponibles(p, u) {
  if (!p) return [];
  const acciones = [];
  const comoResp = puedeComoResponsable(p, u);
  const comoCre = puedeComoCreador(p, u);

  // Tarea personal (yo la creé y es para mí): cierre en un toque, sin
  // evidencia ni revisión. Corta el flujo normal de delegación.
  if (esPersonal(p, u)) {
    if (!CERRADOS.includes(p.estatus)) {
      acciones.push({ id: 'completar', texto: 'Completar', tipo: 'estatus', estatus: 'aprobado', color: 'green', fill: true });
      acciones.push({ id: 'editar', texto: 'Editar', tipo: 'editar' });
    }
    return acciones;
  }

  switch (p.estatus) {
    case 'capturado':
      // Sin responsable todavía: hay que delegarlo (se hace editando).
      if (comoCre) acciones.push({ id: 'editar', texto: 'Asignar responsable', tipo: 'editar', fill: true });
      break;

    case 'delegado':
    case 'reagendado':
      // Paso 3: el responsable acepta o propone otra fecha.
      if (comoResp) {
        acciones.push({ id: 'aceptar', texto: 'Aceptar', tipo: 'estatus', estatus: 'aceptado', fill: true });
        acciones.push({ id: 'reagendar', texto: 'Reagendar', tipo: 'reagendar' });
      }
      break;

    case 'aceptado':
      // Paso 4: empieza a trabajar.
      if (comoResp) acciones.push({ id: 'iniciar', texto: 'Iniciar', tipo: 'estatus', estatus: 'en_progreso', fill: true });
      break;

    case 'en_progreso':
      // Paso 5: concluye (la evidencia llega después) o queda esperando a un tercero.
      if (comoResp) {
        acciones.push({ id: 'concluir', texto: 'Marcar como concluido', tipo: 'estatus', estatus: 'concluido', fill: true });
        acciones.push({ id: 'espera', texto: 'Poner en espera', tipo: 'estatus', estatus: 'en_espera' });
      }
      break;

    case 'en_espera':
      if (comoResp) acciones.push({ id: 'retomar', texto: 'Retomar', tipo: 'estatus', estatus: 'en_progreso', fill: true });
      break;

    case 'concluido':
      // Paso 6: revisión. Sólo quien lo delegó aprueba o devuelve.
      if (comoCre) {
        acciones.push({ id: 'aprobar', texto: 'Aprobar', tipo: 'estatus', estatus: 'aprobado', color: 'green', fill: true });
        acciones.push({ id: 'devolver', texto: 'Devolver a revisión', tipo: 'estatus', estatus: 'en_progreso', color: 'red' });
      }
      break;

    case 'aprobado':
    default:
      break;
  }
  return acciones;
}

// Texto explicativo cuando el usuario no tiene acciones (para no dejar la pantalla muda).
export function motivoSinAcciones(p, u) {
  if (!p) return '';
  if (p.estatus === 'aprobado') return 'Este pendiente está cerrado y aprobado.';
  if (p.estatus === 'concluido') return 'Esperando la revisión de quien lo delegó.';
  if (['delegado', 'reagendado', 'aceptado', 'en_progreso', 'en_espera'].includes(p.estatus)) {
    return `Esperando a ${p.responsable_nombre || 'el responsable'}.`;
  }
  return '';
}
