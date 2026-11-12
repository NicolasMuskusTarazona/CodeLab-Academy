/**
 * Cliente de la API REST. Única capa del front-end que conoce las URLs y el formato de respuesta.
 * Normaliza los errores en ApiError para que la interfaz los trate de forma uniforme.
 *
 * La URL base se lee de <meta name="api-base">:
 *   - una ruta o URL (p. ej. "api/v1/courses")  -> usa la API REST real;
 *   - "demo"                                    -> usa datos en memoria (GitHub Pages, sin PHP).
 */
import { ApiError } from './api-error.js';

const configured = document.querySelector('meta[name="api-base"]')?.content.trim() || 'api/v1/courses';

export const isDemo = configured === 'demo';
const API_BASE = configured;

async function request(path = '', options = {}) {
  if (isDemo) {
    // Carga diferida: el módulo de demostración solo se descarga cuando se necesita.
    const { demoRequest } = await import('./demo-api.js');
    return demoRequest(path, options);
  }

  let response;
  try {
    response = await fetch(API_BASE + path, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (networkError) {
    if (networkError.name === 'AbortError') throw networkError; // petición cancelada a propósito
    throw new ApiError('No se pudo conectar con el servidor. Verifique su conexión.');
  }

  if (response.status === 204) {
    return null;
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError('El servidor devolvió una respuesta inesperada.', response.status);
  }

  if (!response.ok || body.success === false) {
    throw new ApiError(body.message || 'Error desconocido.', response.status, body.errors || {});
  }

  return body;
}

export const CoursesApi = {
  list: (params, { signal } = {}) => request('?' + new URLSearchParams(params), { signal }),
  create: (data) => request('', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/${id}`, { method: 'DELETE' }),
};
