<?php
declare(strict_types=1);

namespace App\Core;

use PDO;
use Throwable;

/**
 * Conexión única (Singleton) a la base de datos SQLite.
 * Si la base no existe, se crea con el esquema y los datos de ejemplo dentro de una
 * transacción: si algo falla, el archivo se elimina y el siguiente intento empieza limpio.
 */
final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        $file = (string) Config::get('db_path');
        $isNew = !file_exists($file);

        $pdo = new PDO('sqlite:' . $file, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec('PRAGMA busy_timeout = 3000'); // espera si otra petición está escribiendo

        if ($isNew) {
            try {
                $dir = dirname(__DIR__, 2) . '/database';
                $pdo->beginTransaction();
                $pdo->exec((string) file_get_contents($dir . '/schema.sql'));
                $pdo->exec((string) file_get_contents($dir . '/seed.sql'));
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo = null;
                @unlink($file);
                throw $e;
            }
        }

        return self::$pdo = $pdo;
    }
}
