<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Capa de presentación (la "V" del MVC en una API): serializa todo a JSON
 * con una estructura de respuesta uniforme.
 *
 * Éxito: { "success": true,  "data": ..., "meta": ... }
 * Error: { "success": false, "message": "...", "errors": { campo: [mensajes] } }
 */
final class Response
{
    /** Cabeceras comunes a toda respuesta: tipo de contenido, seguridad, caché y CORS. */
    public static function sendCommonHeaders(): void
    {
        $origin = (string) Config::get('cors_origin');

        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Accept');
        header('Access-Control-Max-Age: 600'); // el navegador reutiliza el preflight 10 min

        if ($origin !== '*') {
            header('Vary: Origin');
        }
    }

    public static function success(mixed $data, int $status = 200, array $meta = []): never
    {
        $body = ['success' => true, 'data' => $data];
        if ($meta !== []) {
            $body['meta'] = $meta;
        }
        self::send($status, $body);
    }

    public static function noContent(): never
    {
        http_response_code(204);
        exit;
    }

    public static function error(int $status, string $message, array $errors = []): never
    {
        $body = ['success' => false, 'message' => $message];
        if ($errors !== []) {
            $body['errors'] = $errors;
        }
        self::send($status, $body);
    }

    private static function send(int $status, array $body): never
    {
        // JSON compacto en producción; legible solo en modo depuración.
        $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR;
        if (Config::get('debug')) {
            $flags |= JSON_PRETTY_PRINT;
        }

        http_response_code($status);
        echo json_encode($body, $flags);
        exit;
    }
}
