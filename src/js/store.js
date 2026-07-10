import { reactive } from 'vue';

// Estado compartido mínimo entre pantallas.
export const store = reactive({
  // Usuario en sesión. Por ahora se elige a mano (no hay login todavía).
  usuario: { id: 1, nombre: 'Carolina G.', rol: 'direccion' },

  // Catálogo de usuarios (se carga una vez desde /api/usuarios).
  usuarios: [],

  // Filtro que la lista de Pendientes debe aplicar (lo fija Inicio al tocar
  // una tarjeta del semáforo).
  filtro: 'todos',

  // Contador que las pantallas observan para recargar datos.
  tick: 0,
});

// Avisa a las pantallas que hay datos nuevos (tras crear/editar un pendiente).
export function refrescar() {
  store.tick += 1;
}

export function setUsuarios(lista) {
  store.usuarios = lista;
}

export function setUsuario(u) {
  store.usuario = { id: u.id, nombre: u.nombre, rol: u.rol };
}

export function setFiltro(f) {
  store.filtro = f;
}
