<?php
declare(strict_types=1);

/**
 * Configuración central. Cada valor puede sobrescribirse con una variable de entorno,
 * de modo que el mismo código sirva para desarrollo, pruebas y producción.
 */
return [
    'api_prefix'  => '/api/v1',
    'debug'       => filter_var(getenv('APP_DEBUG') ?: 'false', FILTER_VALIDATE_BOOLEAN),
    'cors_origin' => getenv('CORS_ORIGIN') ?: '*',
    'db_path'     => getenv('DB_PATH') ?: dirname(__DIR__) . '/database/codelab.sqlite',
];
