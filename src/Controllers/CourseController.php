<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Config;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Models\Course;
use App\Presenters\CoursePresenter;
use App\Validators\CourseValidator;

/**
 * Controlador (C del MVC): recibe la petición, coordina validador y modelo,
 * y delega la respuesta a la capa de presentación (Response).
 * No contiene SQL ni lógica de formato.
 */
final class CourseController
{
    private const DEFAULT_PER_PAGE = 10;
    private const MAX_PER_PAGE = 50;
    private const MAX_PAGE = 100000; // evita desbordamientos en OFFSET con valores absurdos

    private Course $courses;

    public function __construct()
    {
        $this->courses = new Course();
    }

    /** GET /api/v1/courses */
    public function index(Request $request, array $params): void
    {
        $page = min(self::MAX_PAGE, max(1, (int) $request->queryString('page', '1')));
        $perPage = min(self::MAX_PER_PAGE, max(1, (int) $request->queryString('per_page', (string) self::DEFAULT_PER_PAGE)));
        $level = $request->queryString('level');

        if ($level !== '' && !in_array($level, CourseValidator::LEVELS, true)) {
            throw new HttpException(422, 'Filtro inválido.', [
                'level' => ['El nivel debe ser: ' . implode(', ', CourseValidator::LEVELS) . '.'],
            ]);
        }

        $result = $this->courses->paginate(
            ['q' => trim($request->queryString('q')), 'level' => $level],
            $page,
            $perPage,
            $request->queryString('sort', 'id'),
            $request->queryString('dir', 'asc'),
        );

        Response::success(CoursePresenter::many($result['items']), 200, [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int) ceil($result['total'] / $perPage),
        ]);
    }

    /** GET /api/v1/courses/{id} */
    public function show(Request $request, array $params): void
    {
        Response::success(CoursePresenter::one($this->findOrFail($params['id'])));
    }

    /** POST /api/v1/courses */
    public function store(Request $request, array $params): void
    {
        $course = $this->courses->create(CourseValidator::validate($request->json()));

        header('Location: ' . Config::get('api_prefix') . '/courses/' . $course['id']);
        Response::success(CoursePresenter::one($course), 201);
    }

    /** PUT /api/v1/courses/{id}  (reemplazo completo) */
    public function update(Request $request, array $params): void
    {
        $this->save($params['id'], CourseValidator::validate($request->json()));
    }

    /** PATCH /api/v1/courses/{id}  (actualización parcial) */
    public function patch(Request $request, array $params): void
    {
        $this->save($params['id'], CourseValidator::validate($request->json(), partial: true));
    }

    /** DELETE /api/v1/courses/{id} */
    public function destroy(Request $request, array $params): void
    {
        $this->courses->delete((int) $this->findOrFail($params['id'])['id']);

        Response::noContent();
    }

    /** Lógica compartida por PUT y PATCH: comprobar existencia, actualizar y responder. */
    private function save(string $rawId, array $data): never
    {
        $id = (int) $this->findOrFail($rawId)['id'];
        $updated = $this->courses->update($id, $data);

        if ($updated === null) {
            throw new HttpException(404, "No existe un curso con id $rawId.");
        }

        Response::success(CoursePresenter::one($updated));
    }

    private function findOrFail(string $rawId): array
    {
        if (!ctype_digit($rawId)) {
            throw new HttpException(400, 'El identificador debe ser un número entero positivo.');
        }

        return $this->courses->find((int) $rawId)
            ?? throw new HttpException(404, "No existe un curso con id $rawId.");
    }
}
