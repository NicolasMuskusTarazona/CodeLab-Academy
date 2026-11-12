<?php
declare(strict_types=1);

/**
 * Front controller: todas las peticiones a /api/* pasan por aquí.
 * Con el servidor embebido de PHP (desarrollo), los archivos estáticos se sirven directamente.
 */

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (str_starts_with($class, $prefix)) {
        $file = dirname(__DIR__) . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Servidor de desarrollo: todo lo que no sea /api es contenido estático.
if (PHP_SAPI === 'cli-server' && !str_starts_with($path, '/api')) {
    if ($path === '/') {
        readfile(__DIR__ . '/index.html');
        return true;
    }
    if (is_file(__DIR__ . $path)) {
        return false; // el propio servidor entrega el archivo con su tipo MIME
    }
}

Response::sendCommonHeaders();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204); // respuesta al preflight de CORS
    exit;
}

try {
    $router = new Router();
    (require dirname(__DIR__) . '/config/routes.php')($router);
    $router->dispatch(Request::capture());
} catch (HttpException $e) {
    Response::error($e->status, $e->getMessage(), $e->errors);
} catch (Throwable $e) {
    error_log($e->getMessage());
    Response::error(500, 'Error interno del servidor.');
}
