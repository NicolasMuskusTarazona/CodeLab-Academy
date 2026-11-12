<?php
declare(strict_types=1);

namespace App\Core;

/**
 * Enrutador mínimo: asocia (método HTTP + patrón de ruta) con un controlador.
 * Los segmentos {nombre} se convierten en parámetros de texto.
 */
final class Router
{
    /** @var array<int, array{method:string, regex:string, handler:array{0:class-string,1:string}}> */
    private array $routes = [];

    public function add(string $method, string $pattern, array $handler): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
        $this->routes[] = ['method' => $method, 'regex' => $regex, 'handler' => $handler];
    }

    public function dispatch(Request $request): void
    {
        $allowed = [];

        foreach ($this->routes as $route) {
            if (!preg_match($route['regex'], $request->path, $matches)) {
                continue;
            }

            if ($route['method'] !== $request->method) {
                $allowed[] = $route['method'];
                continue;
            }

            $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
            [$class, $action] = $route['handler'];
            (new $class())->$action($request, $params);
            return;
        }

        if ($allowed !== []) {
            // RFC 9110: un 405 debe indicar qué métodos sí admite el recurso.
            header('Allow: ' . implode(', ', array_unique($allowed)));
            throw new HttpException(405, 'Método no permitido para este recurso.');
        }

        throw new HttpException(404, 'Ruta no encontrada.');
    }
}
