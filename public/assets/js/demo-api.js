/**
 * Modo demostración: imita el contrato de la API REST con datos en memoria.
 * Sirve para publicar el front-end en GitHub Pages, que solo aloja archivos estáticos (sin PHP).
 * Los cambios (crear, editar, eliminar) viven solo mientras la pestaña esté abierta.
 */
import { ApiError } from './api-error.js';

const SORTABLE = ['id', 'title', 'level', 'hours', 'price', 'created_at'];
let courses = null;

async function loadCourses() {
  if (courses === null) {
    try {
      const response = await fetch(new URL('assets/data/courses.json', document.baseURI));
      courses = await response.json();
    } catch {
      throw new ApiError('No se pudieron cargar los datos de demostración.');
    }
  }
  return courses;
}

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

function list(query) {
  const params = new URLSearchParams(query);
  const q = (params.get('q') ?? '').toLowerCase();
  const level = params.get('level') ?? '';
  const sort = SORTABLE.includes(params.get('sort')) ? params.get('sort') : 'id';
  const direction = params.get('dir') === 'desc' ? -1 : 1;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const perPage = Math.min(50, Math.max(1, Number(params.get('per_page')) || 10));

  const filtered = courses
    .filter((c) => (!q || `${c.title} ${c.description}`.toLowerCase().includes(q)) && (!level || c.level === level))
    .sort((a, b) => {
      const order = typeof a[sort] === 'string' ? a[sort].localeCompare(b[sort], 'es') : a[sort] - b[sort];
      return (order || a.id - b.id) * direction;
    });

  return {
    success: true,
    data: filtered.slice((page - 1) * perPage, page * perPage),
    meta: { page, per_page: perPage, total: filtered.length, total_pages: Math.ceil(filtered.length / perPage) },
  };
}

export async function demoRequest(path, options = {}) {
  await loadCourses();
  const method = options.method ?? 'GET';
  const id = Number(path.replace('/', '')) || null;

  if (method === 'GET') return list(path.replace(/^\?/, ''));

  if (method === 'POST') {
    const course = { id: Math.max(0, ...courses.map((c) => c.id)) + 1, ...JSON.parse(options.body), created_at: now(), updated_at: now() };
    courses.push(course);
    return { success: true, data: course };
  }

  const index = courses.findIndex((c) => c.id === id);
  if (index === -1) throw new ApiError(`No existe un curso con id ${id}.`, 404);

  if (method === 'PUT') {
    courses[index] = { ...courses[index], ...JSON.parse(options.body), updated_at: now() };
    return { success: true, data: courses[index] };
  }

  courses.splice(index, 1); // DELETE
  return null;
}
