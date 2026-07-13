// Reglas de autorización del servidor. Espejo de src/js/pendientes.js, pero
// aquí son las que mandan: el cliente puede mentir, el servidor no.
//
// Regla de visibilidad (decidida con el usuario): cada quien ve SÓLO lo suyo
// — lo que le asignaron o lo que él delegó. Dirección se comporta igual que
// un colaborador. El campo `rol` se conserva para usos futuros (reportes,
// una vista de supervisión opcional), pero hoy no da acceso extra.

const esCreador = (p, u) => Number(p.creado_por) === Number(u.id);
const esResponsable = (p, u) => Number(p.responsable_id) === Number(u.id);

// ¿Este usuario puede siquiera VER este pendiente?
export const puedeVer = (p, u) => esCreador(p, u) || esResponsable(p, u);

export const puedeComoCreador = (p, u) => esCreador(p, u);
export const puedeComoResponsable = (p, u) => esResponsable(p, u);

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

/** null si la actualización está permitida; si no, el mensaje de error. */
export function validarActualizacion(pendiente, usuario, { estatus, editaCampos }) {
  if (!pendiente) return 'No encontrado';
  if (!puedeVer(pendiente, usuario)) return 'No encontrado'; // no filtramos existencia

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
  return esCreador(pendiente, usuario);
}
