<?php
declare(strict_types=1);

namespace App\Core;

use RuntimeException;

/**
 * Excepción con código de estado HTTP y errores de validación opcionales.
 */
class HttpException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        string $message,
        public readonly array $errors = [],
    ) {
        parent::__construct($message, $status);
    }
}
