// Subida de evidencias: el navegador sube el archivo DIRECTO a Vercel Blob
// (sin pasar por el límite de 4.5MB de las funciones), y luego registramos
// el metadato en nuestra base.
import { upload } from '@vercel/blob/client';
import { api } from './api.js';

const MAX_MB = 15;
const TIPOS_OK = /^(image\/(jpeg|png|heic|heif|webp|gif)|application\/pdf)$/i;

export function validarArchivo(file) {
  if (!file) return 'No se seleccionó archivo.';
  if (file.size > MAX_MB * 1024 * 1024) return `El archivo supera ${MAX_MB} MB.`;
  // Algunos navegadores no ponen type en HEIC; permitimos por extensión.
  const ok = TIPOS_OK.test(file.type) || /\.(jpe?g|png|heic|heif|webp|gif|pdf)$/i.test(file.name);
  if (!ok) return 'Solo imágenes o PDF.';
  return null;
}

export async function subirEvidencia(pendienteId, file) {
  const blob = await upload(file.name, file, {
    access: 'public',
    handleUploadUrl: '/api/blob-upload',
    clientPayload: JSON.stringify({ pendiente_id: pendienteId }),
  });
  return api.evidencias.registrar({
    pendiente_id: pendienteId,
    url: blob.url,
    nombre: file.name,
    tipo: file.type || null,
    tamano: file.size,
  });
}

export function esImagen(ev) {
  return /^image\//i.test(ev.tipo || '') || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(ev.nombre || '');
}

export function tamanoLegible(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
