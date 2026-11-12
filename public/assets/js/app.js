/**
 * Lógica de la interfaz: render de tarjetas, filtros, paginación,
 * formulario con validación (cliente + servidor) y notificaciones.
 * Usa api.js (CoursesApi) y la variable global `bootstrap` (Modal, Toast) del script del CDN.
 */
import { CoursesApi, isDemo } from './api.js';

const $ = (selector) => document.querySelector(selector);

const els = {
  grid: $('#grid'),
  status: $('#status'),
  pager: $('#pager'),
  filters: $('#filters'),
  q: $('#f-q'),
  level: $('#f-level'),
  sort: $('#f-sort'),
  form: $('#course-form'),
  formAlert: $('#form-alert'),
  modalTitle: $('#modal-title'),
  btnSave: $('#btn-save'),
  deleteText: $('#delete-text'),
  toasts: $('#toasts'),
};

const formModal = new bootstrap.Modal('#course-modal');
const deleteModal = new bootstrap.Modal('#delete-modal');

const state = { page: 1, perPage: 6, pendingDelete: null, controller: null };

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const LEVEL_LABEL = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

/* ---------- utilidades ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent evita inyección de HTML (XSS)
  return node;
}

function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function toast(message, type = 'success') {
  const node = el('div', `toast align-items-center text-bg-${type} border-0`);
  node.setAttribute('role', 'status');
  const flex = el('div', 'd-flex');
  flex.append(el('div', 'toast-body', message));
  const close = el('button', 'btn-close btn-close-white me-2 m-auto');
  close.type = 'button';
  close.setAttribute('data-bs-dismiss', 'toast');
  close.setAttribute('aria-label', 'Cerrar');
  flex.append(close);
  node.append(flex);
  els.toasts.append(node);
  const instance = new bootstrap.Toast(node, { delay: 3500 });
  node.addEventListener('hidden.bs.toast', () => node.remove());
  instance.show();
}

/* ---------- estados de la lista ---------- */

function showStatus(kind, title, detail, retry) {
  els.status.replaceChildren();
  els.grid.replaceChildren();
  els.pager.replaceChildren();

  const box = el('div', `state-box${kind === 'error' ? ' state-box--error' : ''}`);
  if (kind === 'loading') {
    const spinner = el('div', 'spinner-border text-primary mb-3');
    spinner.setAttribute('role', 'status');
    box.append(spinner);
  } else {
    box.append(el('div', 'state-icon', kind === 'error' ? '⚠️' : '📚'));
  }
  box.append(el('strong', '', title));
  if (detail) box.append(el('span', '', detail));
  if (retry) {
    const btn = el('button', 'btn btn-outline-primary btn-sm mt-3', 'Reintentar');
    btn.type = 'button';
    btn.addEventListener('click', retry);
    box.append(btn);
  }
  els.status.append(box);
}

/* ---------- render ---------- */

function renderCourses(courses) {
  els.status.replaceChildren();
  els.grid.replaceChildren();

  for (const course of courses) {
    const col = el('div', 'col-12 col-md-6 col-lg-4');
    const card = el('article', `card course-card${course.active ? '' : ' is-inactive'}`);
    const body = el('div', 'card-body');

    const top = el('div', 'd-flex justify-content-between align-items-start gap-2');
    top.append(el('h2', 'card-title', course.title));
    top.append(el('span', `badge level-badge level-badge--${course.level}`, LEVEL_LABEL[course.level]));

    const meta = el('div', 'meta');
    meta.append(el('span', '', `${course.hours} h${course.active ? '' : ' · Inactivo'}`));
    meta.append(el('span', 'price', money.format(course.price)));

    const actions = el('div', 'actions');
    const edit = el('button', 'btn btn-outline-primary btn-sm', 'Editar');
    edit.type = 'button';
    edit.addEventListener('click', () => openForm(course));
    const del = el('button', 'btn btn-outline-danger btn-sm', 'Eliminar');
    del.type = 'button';
    del.addEventListener('click', () => askDelete(course));
    actions.append(edit, del);

    body.append(top, el('p', 'card-text', course.description), meta, actions);
    card.append(body);
    col.append(card);
    els.grid.append(col);
  }
}

function renderPager(meta) {
  els.pager.replaceChildren();
  if (meta.total_pages <= 1) return;

  const item = (label, page, { disabled = false, active = false, name = `Página ${label}` } = {}) => {
    const li = el('li', `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`);
    const a = el('button', 'page-link', label);
    a.type = 'button';
    a.disabled = disabled;
    a.setAttribute('aria-label', name);
    if (active) a.setAttribute('aria-current', 'page');
    a.addEventListener('click', () => {
      state.page = page;
      load();
    });
    li.append(a);
    return li;
  };

  els.pager.append(item('«', meta.page - 1, { disabled: meta.page === 1, name: 'Página anterior' }));
  for (let p = 1; p <= meta.total_pages; p++) {
    els.pager.append(item(String(p), p, { active: p === meta.page }));
  }
  els.pager.append(item('»', meta.page + 1, { disabled: meta.page === meta.total_pages, name: 'Página siguiente' }));
}

/* ---------- carga de datos ---------- */

async function load() {
  const [sort, dir] = els.sort.value.split('|');
  const params = { page: state.page, per_page: state.perPage, sort, dir };
  if (els.q.value.trim()) params.q = els.q.value.trim();
  if (els.level.value) params.level = els.level.value;

  // Si el usuario sigue escribiendo, se cancela la petición anterior: así una respuesta
  // lenta y antigua nunca pisa a una más reciente.
  state.controller?.abort();
  state.controller = new AbortController();
  const { signal } = state.controller;

  showStatus('loading', 'Cargando cursos…');

  try {
    const { data, meta } = await CoursesApi.list(params, { signal });

    // Si se borró el último elemento de la última página, retrocede una.
    if (data.length === 0 && meta.total > 0 && state.page > 1) {
      state.page -= 1;
      return load();
    }

    if (data.length === 0) {
      showStatus('empty', 'No se encontraron cursos', 'Pruebe con otros filtros o cree un curso nuevo.');
      return;
    }

    renderCourses(data);
    renderPager(meta);
  } catch (error) {
    if (error.name === 'AbortError') return; // fue reemplazada por una petición más nueva
    showStatus('error', 'No se pudieron cargar los cursos', error.message, load);
  }
}

/* ---------- formulario crear / editar ---------- */

const FIELDS = ['title', 'description', 'level', 'hours', 'price'];

function field(name) {
  return els.form.elements[name];
}

function clearErrors() {
  els.formAlert.classList.add('d-none');
  els.formAlert.textContent = '';
  for (const name of FIELDS) {
    field(name).classList.remove('is-invalid');
    field(name).parentElement.querySelector('.invalid-feedback').textContent = '';
  }
}

function setFieldError(name, message) {
  const input = field(name);
  input.classList.add('is-invalid');
  input.parentElement.querySelector('.invalid-feedback').textContent = message;
}

/** Validación previa en el cliente (la API vuelve a validar siempre). */
function validateClient(data) {
  const errors = {};
  if (data.title.length < 3) errors.title = 'El título debe tener al menos 3 caracteres.';
  if (data.description.length < 10) errors.description = 'La descripción debe tener al menos 10 caracteres.';
  if (!data.level) errors.level = 'Seleccione un nivel.';
  if (!Number.isInteger(data.hours) || data.hours < 1 || data.hours > 500) {
    errors.hours = 'Ingrese un entero entre 1 y 500.';
  }
  if (!Number.isFinite(data.price) || data.price < 0) errors.price = 'Ingrese un precio válido (0 o más).';
  return errors;
}

function openForm(course = null) {
  els.form.reset();
  clearErrors();
  $('#c-id').value = course ? course.id : '';
  els.modalTitle.textContent = course ? 'Editar curso' : 'Nuevo curso';

  if (course) {
    field('title').value = course.title;
    field('description').value = course.description;
    field('level').value = course.level;
    field('hours').value = course.hours;
    field('price').value = course.price;
    field('active').checked = course.active;
  }
  formModal.show();
}

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const data = {
    title: field('title').value.trim(),
    description: field('description').value.trim(),
    level: field('level').value,
    hours: Number(field('hours').value),
    price: Number(field('price').value),
    active: field('active').checked,
  };

  const clientErrors = validateClient(data);
  if (Object.keys(clientErrors).length) {
    for (const [name, message] of Object.entries(clientErrors)) setFieldError(name, message);
    return;
  }

  const id = $('#c-id').value;
  els.btnSave.disabled = true;
  els.btnSave.textContent = 'Guardando…';

  try {
    if (id) {
      await CoursesApi.update(id, data);
    } else {
      await CoursesApi.create(data);
    }
    formModal.hide();
    toast(id ? 'Curso actualizado correctamente.' : 'Curso creado correctamente.');
    await load();
  } catch (error) {
    // Con 422 la API detalla el error de cada campo; se muestra junto a su input.
    if (error.status === 422) {
      for (const [name, messages] of Object.entries(error.errors)) {
        if (FIELDS.includes(name)) setFieldError(name, messages[0]);
      }
    }
    els.formAlert.textContent = error.message;
    els.formAlert.classList.remove('d-none');
  } finally {
    els.btnSave.disabled = false;
    els.btnSave.textContent = 'Guardar';
  }
});

/* ---------- eliminación ---------- */

function askDelete(course) {
  state.pendingDelete = course;
  els.deleteText.textContent = `¿Eliminar el curso "${course.title}"? Esta acción no se puede deshacer.`;
  deleteModal.show();
}

$('#btn-confirm-delete').addEventListener('click', async () => {
  const course = state.pendingDelete;
  if (!course) return;

  try {
    await CoursesApi.remove(course.id);
    deleteModal.hide();
    toast('Curso eliminado.');
  } catch (error) {
    deleteModal.hide();
    // 404: ya no existía (otra pestaña lo borró); igualmente se refresca la lista.
    toast(error.message, 'danger');
  } finally {
    state.pendingDelete = null;
    load();
  }
});

/* ---------- eventos ---------- */

$('#btn-new').addEventListener('click', () => openForm());
els.filters.addEventListener('submit', (event) => event.preventDefault());
els.q.addEventListener('input', debounce(() => { state.page = 1; load(); }));
els.level.addEventListener('change', () => { state.page = 1; load(); });
els.sort.addEventListener('change', () => { state.page = 1; load(); });

if (isDemo) $('#demo-badge').classList.remove('d-none');
load();
