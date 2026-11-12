# CodeLab Academy – API REST en PHP (MVC) + Bootstrap + SASS

Catálogo de cursos: back-end en PHP 8 (MVC, SQLite) que expone una API REST versionada y
front-end en Bootstrap 5.3 + SASS que la consume con `fetch`.

## Requisitos

- PHP 8.1+ con las extensiones `pdo_sqlite` y `mbstring`
- Node.js 18+ (solo para compilar SASS y empaquetar el front-end)

## Puesta en marcha

```bash
npm ci          # instala Bootstrap, Sass y esbuild (versiones exactas del package-lock)
npm start       # compila SASS y abre el servidor PHP en http://127.0.0.1:8080
```

La base SQLite (`database/codelab.sqlite`) se crea sola en la primera petición con
`database/schema.sql` y `database/seed.sql`. Mientras desarrolla estilos: `npm run sass:watch`.

## Pruebas

```bash
npm test        # equivale a: node tests/smoke.mjs
```

Levanta el servidor con una base temporal y verifica 31 casos: códigos de estado, validaciones,
paginación, CORS y cabeceras. Se ejecuta también en GitHub Actions en cada `push` y Pull Request.

## Estructura

```
config/        app.php (configuración) y routes.php (tabla de rutas)
database/      schema.sql y seed.sql
public/        index.php (front controller), index.html y assets/ (js, css generado, data)
scss/          estilos fuente (arquitectura 7-1 simplificada)
src/           Controllers, Core, Models, Presenters, Validators
tests/         smoke.mjs
scripts/       build-site.mjs (genera _site/ para GitHub Pages)
.github/       workflows/deploy.yml (pruebas + despliegue automatizado)
```

## Arquitectura MVC

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| Front controller | `public/index.php` | Punto de entrada, CORS y manejo global de errores |
| Enrutamiento | `src/Core/Router.php`, `config/routes.php` | Método HTTP + ruta → acción del controlador (404 y 405 con `Allow`) |
| Controlador | `src/Controllers/CourseController.php` | Orquesta validador, modelo y respuesta; sin SQL |
| Modelo | `src/Models/Course.php` | Acceso a datos con sentencias preparadas (PDO) y lista blanca de columnas |
| Validación | `src/Validators/CourseValidator.php` | Reglas de entrada y errores por campo |
| Presentación | `src/Presenters/CoursePresenter.php`, `src/Core/Response.php` | Formato público del recurso y respuesta JSON uniforme |
| Configuración | `config/app.php`, `src/Core/Config.php` | Valores por entorno (variables de entorno) |
| Front-end | `public/index.html`, `public/assets/js/` | Interfaz Bootstrap; módulos ES (`api.js`, `api-error.js`, `demo-api.js`, `app.js`) |

### Variables de entorno (opcionales)

| Variable | Por defecto | Uso |
|----------|-------------|-----|
| `APP_DEBUG` | `false` | `true` devuelve JSON con sangría (legible) |
| `CORS_ORIGIN` | `*` | Origen permitido; en producción conviene fijar el dominio del front-end |
| `DB_PATH` | `database/codelab.sqlite` | Ruta de la base SQLite |

## Endpoints (`/api/v1/courses`)

| Método | Ruta | Descripción | Éxito | Errores |
|--------|------|-------------|-------|---------|
| GET | `/api/v1/courses` | Lista con búsqueda, filtro, orden y paginación | 200 | 422 |
| GET | `/api/v1/courses/{id}` | Detalle de un curso | 200 | 400, 404 |
| POST | `/api/v1/courses` | Crea un curso | 201 + `Location` | 400, 422 |
| PUT | `/api/v1/courses/{id}` | Reemplaza un curso (todos los campos) | 200 | 400, 404, 422 |
| PATCH | `/api/v1/courses/{id}` | Actualiza campos sueltos | 200 | 400, 404, 422 |
| DELETE | `/api/v1/courses/{id}` | Elimina un curso | 204 | 400, 404 |

Parámetros de `GET /courses`: `q` (texto), `level` (`basico|intermedio|avanzado`), `page`,
`per_page` (máx. 50), `sort` (`id|title|level|hours|price|created_at`), `dir` (`asc|desc`).

Códigos usados: `200` · `201` · `204` · `400` (JSON roto o id inválido) · `404` · `405` (con cabecera
`Allow`) · `422` (datos no válidos) · `500` (error interno sin detalles).

### Cuerpo de un curso

```json
{ "title": "Git y GitHub", "description": "Control de versiones para equipos.", "level": "basico", "hours": 20, "price": 99000, "active": true }
```

### Pruebas rápidas con curl

```bash
curl "http://127.0.0.1:8080/api/v1/courses?level=avanzado"
curl -X POST http://127.0.0.1:8080/api/v1/courses -H "Content-Type: application/json" \
  -d '{"title":"Git y GitHub","description":"Control de versiones para equipos.","level":"basico","hours":20,"price":99000}'
curl -X PATCH http://127.0.0.1:8080/api/v1/courses/1 -H "Content-Type: application/json" -d '{"price":130000}'
curl -X DELETE http://127.0.0.1:8080/api/v1/courses/1
```

## Despliegue en GitHub Pages (automatizado)

GitHub Pages solo aloja archivos estáticos: **no ejecuta PHP**. Por eso el workflow publica el
front-end y, según la variable `API_BASE_URL`, usa una de dos modalidades:

1. **Modo demostración** (por defecto): el front-end funciona con datos en memoria
   (`public/assets/data/courses.json`) y muestra la etiqueta "Modo demostración".
2. **API real**: si define la variable del repositorio `API_BASE_URL` (por ejemplo
   `https://mi-hosting.com/api/v1/courses`), el front-end consume esa API. El servidor debe
   permitir el origen de Pages con `CORS_ORIGIN=https://usuario.github.io`.

Pasos: en GitHub, *Settings → Pages → Source: GitHub Actions*; luego `git push origin main`.
El workflow `.github/workflows/deploy.yml` ejecuta las pruebas, construye `_site/` y publica.
Construcción local: `npm run build:site` (genera `_site/`).

## SASS

- `abstracts/_variables.scss`: paleta, mapa `$level-colors`, mapa `$breakpoints` y sobrescritura de variables de Bootstrap.
- `abstracts/_mixins.scss`: `respond-to`, `flex-center`, `card-elevated`, `level-badge`, `line-clamp`.
- `components/_course-card.scss`: anidamiento con `&` y bucle `@each` que genera las insignias por nivel.
- `main.scss`: importa solo los módulos de Bootstrap que se usan y limita las utilidades generadas
  (CSS final ≈ 86 KB frente a 183 KB originales).

## Optimización y despliegue

CodeLab Academy incorpora mejoras de organización, mantenimiento y rendimiento del código fuente. El proyecto utiliza una arquitectura MVC en PHP, una base de datos SQLite y una interfaz responsiva desarrollada con Bootstrap 5.3.8 y SASS.

### Mejoras implementadas

- Separación de responsabilidades mediante una capa Presenter.
- Organización del código JavaScript mediante módulos ES.
- Reducción del tamaño de los estilos CSS generados.
- Minificación de los recursos JavaScript para distribución.
- Corrección de validaciones, consultas y paginación.
- Incorporación de pruebas automatizadas para verificar el comportamiento de la aplicación.

### Integración y despliegue continuo

El repositorio incluye el archivo `.github/workflows/deploy.yml`, que define un proceso automatizado de pruebas, construcción y despliegue mediante GitHub Actions.

Debido a que GitHub Pages permite alojar contenido estático, el proyecto contempla un modo demostración con datos en memoria. La API REST desarrollada en PHP requiere un servidor compatible para su ejecución.

**Estado del despliegue:** Publicado en GitHub Pages.

**Sitio publicado:** [CodeLab Academy](https://nicolasmuskustarazona.github.io/CodeLab-Academy/)