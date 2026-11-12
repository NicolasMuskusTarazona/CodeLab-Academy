<?php
declare(strict_types=1);

use App\Controllers\CourseController;
use App\Core\Config;
use App\Core\Router;

return static function (Router $router): void {
    $base = Config::get('api_prefix') . '/courses';

    $router->add('GET', $base, [CourseController::class, 'index']);
    $router->add('POST', $base, [CourseController::class, 'store']);
    $router->add('GET', $base . '/{id}', [CourseController::class, 'show']);
    $router->add('PUT', $base . '/{id}', [CourseController::class, 'update']);
    $router->add('PATCH', $base . '/{id}', [CourseController::class, 'patch']);
    $router->add('DELETE', $base . '/{id}', [CourseController::class, 'destroy']);
};
