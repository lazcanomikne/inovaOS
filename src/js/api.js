// Cliente API ligero contra las Pages Functions (/api/*)
const BASE = '/api';

async function request(path, { method = 'GET', body, headers } = {}) {
  const opts = { method, headers: { ...headers } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = (data && data.error) || res.statusText || 'Error de red';
    throw new Error(message);
  }
  return data;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),

  // Helpers de dominio
  pendientes: {
    list: (query = '') => request(`/pendientes${query}`),
    get: (id) => request(`/pendientes/${id}`),
    create: (body) => request('/pendientes', { method: 'POST', body }),
    update: (id, body) => request(`/pendientes/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/pendientes/${id}`, { method: 'DELETE' }),
  },
  usuarios: {
    list: () => request('/usuarios'),
  },
  tablero: {
    resumen: () => request('/tablero'),
  },
  checklist: {
    list: (pendienteId) => request(`/checklist?pendiente_id=${pendienteId}`),
    create: (body) => request('/checklist', { method: 'POST', body }),
    toggle: (itemId, completado) => request(`/checklist/${itemId}`, { method: 'PATCH', body: { completado } }),
    remove: (itemId) => request(`/checklist/${itemId}`, { method: 'DELETE' }),
  },
};
