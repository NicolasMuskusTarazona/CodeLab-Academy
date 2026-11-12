<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Acceso de solo lectura a config/app.php (se carga una única vez).
 */
final class Config
{
    private static ?array $values = null;

    public static function get(string $key): mixed
    {
        self::$values ??= require dirname(__DIR__, 2) . '/config/app.php';

        return self::$values[$key] ?? null;
    }
}
