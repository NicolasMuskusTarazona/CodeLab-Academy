/**
 * Genera la carpeta _site/ lista para publicar en GitHub Pages (sitio estático, sin PHP):
 *   1. compila SASS a CSS comprimido,
 *   2. empaqueta y minifica el JavaScript en un solo archivo,
 *   3. copia solo lo necesario (HTML, CSS, JS y datos de demostración),
 *   4. fija la URL base de la API en <meta name="api-base"> (variable de entorno API_BASE; por defecto "demo").
 * Funciona igual en Windows, macOS y Linux (no usa comandos de shell).
 */
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import * as sass from 'sass';

const OUT = '_site';
const apiBase = process.env.API_BASE?.trim() || 'demo';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/assets/css`, { recursive: true });

// 1. CSS
const { css } = sass.compile('scss/main.scss', {
  loadPaths: ['node_modules'],
  style: 'compressed',
  quietDeps: true,
  silenceDeprecations: ['import'],
});
writeFileSync(`${OUT}/assets/css/main.css`, css);

// 2. JavaScript (api.js, api-error.js y app.js en un único archivo; demo-api.js se carga bajo demanda)
await build({
  entryPoints: ['public/assets/js/app.js'],
  outdir: `${OUT}/assets/js`,
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
});

// 3. Archivos estáticos
cpSync('public/assets/data', `${OUT}/assets/data`, { recursive: true });
writeFileSync(`${OUT}/.nojekyll`, ''); // Pages no debe procesar el sitio con Jekyll

// 4. HTML con la URL de la API
const html = readFileSync('public/index.html', 'utf8').replace(
  /<meta name="api-base" content="[^"]*">/,
  `<meta name="api-base" content="${apiBase}">`,
);
writeFileSync(`${OUT}/index.html`, html);

const size = (file) => `${(statSync(`${OUT}/${file}`).size / 1024).toFixed(1)} KB`;
console.log(`Sitio generado en ${OUT}/ (API: ${apiBase})`);
console.log(`  index.html          ${size('index.html')}`);
console.log(`  assets/css/main.css ${size('assets/css/main.css')}`);
console.log(`  assets/js/app.js    ${size('assets/js/app.js')}`);
