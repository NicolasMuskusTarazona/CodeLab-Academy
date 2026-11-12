<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Encapsula la petición HTTP entrante (método, ruta, query y cuerpo JSON).
 */
final class Request
{
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        private readonly string $rawBody,
    ) {
    }

    public static function capture(): self
    {
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $path = '/' . trim($path, '/');

        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $path,
            $_GET,
            (string) file_get_contents('php://input'),
        );
    }

    /**
     * Lee un parámetro de la query como texto. Si falta o llega como arreglo
     * (?q[]=x) devuelve el valor por defecto, en lugar de provocar un aviso de PHP.
     */
    public function queryString(string $key, string $default = ''): string
    {
        $value = $this->query[$key] ?? $default;

        return is_string($value) ? $value : $default;
    }

    /**
     * Devuelve el cuerpo decodificado. Lanza HttpException 400 si el JSON es inválido.
     */
    public function json(): array
    {
        if (trim($this->rawBody) === '') {
            return [];
        }

        $data = json_decode($this->rawBody, true);

        if (!is_array($data)) {
            throw new HttpException(400, 'El cuerpo de la petición no es un JSON válido.');
        }

        return $data;
    }
}
