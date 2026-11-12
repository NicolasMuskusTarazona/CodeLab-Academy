<?php
declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;

/**
 * Modelo (M del MVC): único responsable del acceso a datos de la tabla courses.
 * Todas las consultas usan sentencias preparadas contra inyección SQL.
 */
final class Course
{
    private const COLUMNS = 'id, title, description, level, hours, price, active, created_at, updated_at';

    /** Campos que el cliente puede escribir (lista blanca). */
    private const WRITABLE = ['title', 'description', 'level', 'hours', 'price', 'active'];

    /** Columnas permitidas para ORDER BY (no se pueden enlazar como parámetros). */
    private const SORTABLE = ['id', 'title', 'level', 'hours', 'price', 'created_at'];

    private PDO $db;

    public function __construct()
    {
        $this->db = Database::connection();
    }

    /**
     * @param array{q?: string, level?: string} $filters
     * @return array{items: array<int, array>, total: int}
     */
    public function paginate(array $filters, int $page, int $perPage, string $sort, string $dir): array
    {
        [$where, $params] = $this->buildWhere($filters);

        $sort = in_array($sort, self::SORTABLE, true) ? $sort : 'id';
        $dir = strtoupper($dir) === 'DESC' ? 'DESC' : 'ASC';

        $count = $this->db->prepare("SELECT COUNT(*) FROM courses $where");
        $count->execute($params);

        $stmt = $this->db->prepare(
            'SELECT ' . self::COLUMNS . " FROM courses $where ORDER BY $sort $dir, id ASC LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $stmt->execute();

        return ['items' => $stmt->fetchAll(), 'total' => (int) $count->fetchColumn()];
    }

    public function find(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT ' . self::COLUMNS . ' FROM courses WHERE id = :id');
        $stmt->execute([':id' => $id]);

        return $stmt->fetch() ?: null;
    }

    public function create(array $data): array
    {
        $columns = array_keys($this->toRow($data));
        $stmt = $this->db->prepare(
            'INSERT INTO courses (' . implode(', ', $columns) . ') VALUES (:' . implode(', :', $columns) . ')'
        );
        $stmt->execute($this->toParams($data));

        return $this->find((int) $this->db->lastInsertId());
    }

    /**
     * Actualiza solo los campos recibidos (sirve para PUT completo y PATCH parcial).
     */
    public function update(int $id, array $data): ?array
    {
        $row = $this->toRow($data);

        if ($row !== []) {
            $sets = array_map(static fn (string $column): string => "$column = :$column", array_keys($row));
            $sets[] = "updated_at = datetime('now')";

            $stmt = $this->db->prepare('UPDATE courses SET ' . implode(', ', $sets) . ' WHERE id = :id');
            $stmt->execute($this->toParams($data) + [':id' => $id]);
        }

        return $this->find($id);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM courses WHERE id = :id');
        $stmt->execute([':id' => $id]);

        return $stmt->rowCount() > 0;
    }

    /** Filtra los datos de entrada con la lista blanca y convierte los booleanos a 0/1. */
    private function toRow(array $data): array
    {
        $row = array_intersect_key($data, array_flip(self::WRITABLE));
        if (array_key_exists('active', $row)) {
            $row['active'] = $row['active'] ? 1 : 0;
        }

        return $row;
    }

    /** @return array<string, mixed> parámetros con prefijo ":" para PDO */
    private function toParams(array $data): array
    {
        $params = [];
        foreach ($this->toRow($data) as $column => $value) {
            $params[":$column"] = $value;
        }

        return $params;
    }

    /**
     * @return array{0: string, 1: array<string, mixed>}
     */
    private function buildWhere(array $filters): array
    {
        $conditions = [];
        $params = [];

        if (($filters['q'] ?? '') !== '') {
            // Se escapan % y _ para que se busquen como texto y no como comodines de LIKE.
            $conditions[] = "(title LIKE :q ESCAPE '\\' OR description LIKE :q ESCAPE '\\')";
            $params[':q'] = '%' . addcslashes($filters['q'], '%_\\') . '%';
        }
        if (($filters['level'] ?? '') !== '') {
            $conditions[] = 'level = :level';
            $params[':level'] = $filters['level'];
        }

        return [$conditions ? 'WHERE ' . implode(' AND ', $conditions) : '', $params];
    }
}
