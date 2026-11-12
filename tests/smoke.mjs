/**
 * Pruebas de humo de la API (multiplataforma: solo requiere Node 18+ y PHP).
 * Levanta el servidor embebido de PHP con una base SQLite temporal, ejecuta las
 * peticiones y verifica códigos de estado, formato de respuestas y validaciones.
 * Uso: npm test
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PORT = process.env.PORT ?? '8099';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = `${ORIGIN}/api/v1/courses`;
const TMP = mkdtempSync(join(tmpdir(), 'codelab-'));

const server = spawn(
  'php',
  ['-S', `127.0.0.1:${PORT}`, '-t', join(ROOT, 'public'), join(ROOT, 'public', 'index.php')],
  { env: { ...process.env, DB_PATH: join(TMP, 'test.sqlite') }, stdio: 'ignore' },
);
let serverError = null;
server.on('error', (error) => { serverError = error; });

function cleanup() {
  server.kill();
  rmSync(TMP, { recursive: true, force: true });
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    if (serverError) throw new Error(`No se pudo iniciar PHP: ${serverError.message}. ¿Está "php" en el PATH?`);
    try {
      await fetch(BASE);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('El servidor PHP no respondió a tiempo.');
}

let pass = 0;
let fail = 0;
const check = (description, condition) => {
  condition ? pass++ : fail++;
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${description}`);
};

async function req(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body,
  });
  return { code: response.status, headers: response.headers, text: await response.text() };
}

const VALID = JSON.stringify({
  title: 'Git y GitHub',
  description: 'Control de versiones para equipos.',
  level: 'basico',
  hours: 20,
  price: 99000,
});

try {
  await waitForServer();
  let r;

  console.log('GET /courses');
  r = await req('GET', BASE);
  check('lista responde 200', r.code === 200);
  check('incluye success y data', r.text.includes('"success":true,"data"'));
  check('meta con total de registros', r.text.includes('"total":5'));
  r = await req('GET', `${BASE}?level=avanzado`);
  check('filtra por nivel', r.text.includes('Integración Full-Stack'));
  r = await req('GET', `${BASE}?level=experto`);
  check('nivel inválido -> 422', r.code === 422);
  r = await req('GET', `${BASE}?q=%25`);
  check("buscar '%' no actúa como comodín", r.text.includes('"total":0'));
  r = await req('GET', `${BASE}?q[]=x`);
  check('q como arreglo no rompe (200)', r.code === 200);
  r = await req('GET', `${BASE}?per_page=2&page=2`);
  check('paginación (per_page=2)', r.text.includes('"total_pages":3'));
  r = await req('GET', `${BASE}?sort=price&dir=desc&per_page=1`);
  check('ordena por precio desc', r.text.includes('Integración Full-Stack'));

  console.log('GET /courses/{id}');
  check('existente -> 200', (await req('GET', `${BASE}/1`)).code === 200);
  check('id no numérico -> 400', (await req('GET', `${BASE}/abc`)).code === 400);
  check('inexistente -> 404', (await req('GET', `${BASE}/9999`)).code === 404);

  console.log('POST /courses');
  r = await req('POST', BASE, VALID);
  check('crea -> 201', r.code === 201);
  check('incluye cabecera Location', r.headers.get('location') === '/api/v1/courses/6');
  r = await req('POST', BASE, '{"title":"x"}');
  check('datos inválidos -> 422', r.code === 422);
  check('422 detalla errores por campo', r.text.includes('"errors"'));
  check('JSON mal formado -> 400', (await req('POST', BASE, '{ roto')).code === 400);
  r = await req('POST', BASE, JSON.stringify({ ...JSON.parse(VALID), hours: true }));
  check('hours booleano -> 422', r.code === 422);

  console.log('PUT / PATCH');
  check('PUT completo -> 200', (await req('PUT', `${BASE}/6`, VALID)).code === 200);
  check('PUT incompleto -> 422', (await req('PUT', `${BASE}/6`, '{"title":"Solo título"}')).code === 422);
  r = await req('PATCH', `${BASE}/6`, '{"price":130000}');
  check('PATCH parcial -> 200', r.text.includes('"price":130000'));
  check('PATCH vacío -> 422', (await req('PATCH', `${BASE}/6`, '{}')).code === 422);
  check('PATCH inexistente -> 404', (await req('PATCH', `${BASE}/9999`, '{"price":1}')).code === 404);

  console.log('DELETE');
  check('elimina -> 204', (await req('DELETE', `${BASE}/6`)).code === 204);
  check('eliminar de nuevo -> 404', (await req('DELETE', `${BASE}/6`)).code === 404);

  console.log('Rutas y CORS');
  r = await req('PUT', BASE, VALID);
  check('método no permitido -> 405', r.code === 405);
  check('405 incluye cabecera Allow', (r.headers.get('allow') ?? '').startsWith('GET, POST'));
  check('ruta desconocida -> 404', (await req('GET', `${ORIGIN}/api/v1/nada`)).code === 404);
  r = await req('OPTIONS', BASE);
  check('preflight OPTIONS -> 204', r.code === 204);
  check('CORS habilitado', r.headers.has('access-control-allow-origin'));
  r = await req('GET', `${BASE}/1`);
  check('JSON compacto (sin pretty print)', !r.text.includes('\n'));
} catch (error) {
  fail++;
  console.error(`\nError: ${error.message}`);
} finally {
  cleanup();
}

console.log(`\nResultado: ${pass} correctas, ${fail} fallidas`);
process.exit(fail === 0 ? 0 : 1);
