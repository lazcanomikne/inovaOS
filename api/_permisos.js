// Reglas de autorización del servidor. Espejo de src/js/pendientes.js, pero
// aquí son las que mandan: el cliente puede mentir, el servidor no.

const esDireccion = (u) => u?.rol === 'direccion';
const esCreador = (p, u) => Number(p.creado_por) === Number(u.id);
const esResponsable = (p, u) => Number(p.responsable_id) === Number(u.id);

export const puedeComoCreador = (p, u) => esCreador(p, u) || esDireccion(u);
export const puedeComoResponsable = (p, u) => esResponsable(p, u) || esDireccion(u);

// Quién puede pasar a cada estatus.
const QUIEN_CAMBIA = {
  aceptado: puedeComoResponsable,
  reagendado: puedeComoResponsable,
  en_progreso: (p, u) => puedeComoResponsable(p, u) || puedeComoCreador(p, u), // 'retomar' o 'devolver'
  en_espera: puedeComoResponsable,
  concluido: puedeComoResponsable,
  aprobado: puedeComoCreador,
  delegado: puedeComoCreador,
};

/**
 * Valida una actualización. Devuelve null si está permitida,
 * o un mensaje de error si no.
 */
export function validarActualizacion(pendiente, usuario, { estatus, editaCampos }) {
  if (!pendiente) return 'No encontrado';

  if (pendiente.estatus === 'aprobado' && (editaCampos || estatus)) {
    return 'Un pendiente aprobado ya no se puede modificar';
  }

  if (editaCampos && !puedeComoCreador(pendiente, usuario)) {
    return 'Sólo quien delegó el pendiente puede editarlo';
  }

  if (estatus) {
    const permite = QUIEN_CAMBIA[estatus];
    if (!permite) return `Estatus no válido: ${estatus}`;
    if (!permite(pendiente, usuario)) return 'No tienes permiso para este cambio de estatus';
  }

  return null;
}

export function puedeEliminar(pendiente, usuario) {
  return puedeComoCreador(pendiente, usuario);
}
