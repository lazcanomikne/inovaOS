// Helpers de dominio para pendientes (semáforo, fechas, etiquetas).

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

// Siguiente acción del flujo (pasos 3-6 del proceso)
export function siguienteAccion(estatus) {
  return {
    capturado: null,
    delegado: { estatus: 'aceptado', texto: 'Aceptar', color: '' },
    aceptado: { estatus: 'en_progreso', texto: 'Iniciar', color: '' },
    en_progreso: { estatus: 'concluido', texto: 'Marcar como concluido', color: '' },
    en_espera: { estatus: 'en_progreso', texto: 'Retomar', color: '' },
    concluido: { estatus: 'aprobado', texto: 'Aprobar', color: 'green' },
    aprobado: null,
    reagendado: { estatus: 'aceptado', texto: 'Aceptar', color: '' },
  }[estatus];
}
