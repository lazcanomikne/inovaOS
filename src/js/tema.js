// Temas de color de la app. El tema es una preferencia local (por dispositivo):
// se guarda en localStorage y se aplica poniendo data-tema en <html>. El CSS
// (app.css) sobrescribe las variables de color por tema.

export const TEMAS = [
  { id: 'indigo', nombre: 'Índigo', emoji: '💜', c1: '#5b5bd6', c2: '#7c6cf0' },
  { id: 'esmeralda', nombre: 'Esmeralda', emoji: '💚', c1: '#0ea472', c2: '#22c993' },
  { id: 'atardecer', nombre: 'Atardecer', emoji: '🧡', c1: '#f2603a', c2: '#ff9f43' },
  { id: 'perritos', nombre: 'Perritos', emoji: '🐶', c1: '#c07a2e', c2: '#e6a95c' },
];

const CLAVE = 'inova_tema';

export function temaActual() {
  const id = localStorage.getItem(CLAVE);
  return TEMAS.some((t) => t.id === id) ? id : 'indigo';
}

export function aplicarTema(id) {
  const t = TEMAS.find((x) => x.id === id) || TEMAS[0];
  document.documentElement.dataset.tema = t.id;
  localStorage.setItem(CLAVE, t.id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.c1);
}

export function iniciarTema() {
  aplicarTema(temaActual());
}
