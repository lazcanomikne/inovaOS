import { reactive } from 'vue';

// Estado compartido mínimo entre pantallas.
export const store = reactive({
  // Usuario en sesión. Por ahora fijo (Dirección General, id 1 del seed).
  // Cuando haya login real, esto se llena al autenticar.
  usuario: { id: 1, nombre: 'Carolina G.', rol: 'Dirección General' },

  // Catálogo de usuarios (se carga una vez desde /api/usuarios).
  usuarios: [],

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
