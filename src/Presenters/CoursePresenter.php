<?php
declare(strict_types=1);

namespace App\Presenters;

/**
 * Convierte filas de la base de datos al formato público de la API
 * (tipos correctos y solo los campos que se exponen).
 */
final class CoursePresenter
{
    public static function one(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'level' => $row['level'],
            'hours' => (int) $row['hours'],
            'price' => (float) $row['price'],
            'active' => (bool) $row['active'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }

    /** @param array<int, array> $rows */
    public static function many(array $rows): array
    {
        return array_map([self::class, 'one'], $rows);
    }
}
