<?php
declare(strict_types=1);

namespace App\Validators;

use App\Core\HttpException;

/**
 * Valida y normaliza los datos de un curso antes de llegar al modelo.
 * Acumula los errores por campo para que el front-end los muestre junto a cada input.
 */
final class CourseValidator
{
    public const LEVELS = ['basico', 'intermedio', 'avanzado'];

    /** Reglas de los campos de texto: longitud y mensajes. */
    private const TEXT_RULES = [
        'title' => [
            'min' => 3,
            'max' => 120,
            'required' => 'El título es obligatorio.',
            'length' => 'El título debe tener entre 3 y 120 caracteres.',
        ],
        'description' => [
            'min' => 10,
            'max' => 500,
            'required' => 'La descripción es obligatoria.',
            'length' => 'La descripción debe tener entre 10 y 500 caracteres.',
        ],
    ];

    /** @var array<string, array<int, string>> */
    private array $errors = [];

    /** @var array<string, mixed> */
    private array $clean = [];

    private function __construct(private readonly array $input, private readonly bool $partial)
    {
    }

    /**
     * @param bool $partial true en PATCH: solo se validan los campos presentes.
     * @return array<string, mixed> datos limpios y tipados
     */
    public static function validate(array $input, bool $partial = false): array
    {
        if ($partial && $input === []) {
            throw new HttpException(422, 'Debe enviar al menos un campo para actualizar.');
        }

        return (new self($input, $partial))->run();
    }

    private function run(): array
    {
        foreach (self::TEXT_RULES as $field => $rule) {
            if ($this->shouldValidate($field)) {
                $this->text($field, $rule);
            }
        }

        if ($this->shouldValidate('level')) {
            $this->level();
        }
        if ($this->shouldValidate('hours')) {
            $this->number('hours', 'Las horas deben ser un entero entre 1 y 500.', FILTER_VALIDATE_INT, 1, 500);
        }
        if ($this->shouldValidate('price')) {
            $this->number('price', 'El precio debe ser un número mayor o igual a 0.', FILTER_VALIDATE_FLOAT, 0);
        }

        $this->active();

        if ($this->errors !== []) {
            throw new HttpException(422, 'Los datos enviados no son válidos.', $this->errors);
        }

        return $this->clean;
    }

    /** En PUT/POST todos los campos son obligatorios; en PATCH solo los que llegan. */
    private function shouldValidate(string $field): bool
    {
        return !$this->partial || array_key_exists($field, $this->input);
    }

    private function text(string $field, array $rule): void
    {
        $value = $this->input[$field] ?? null;
        $value = is_string($value) ? trim($value) : '';
        $length = mb_strlen($value);

        if ($value === '') {
            $this->errors[$field][] = $rule['required'];
        } elseif ($length < $rule['min'] || $length > $rule['max']) {
            $this->errors[$field][] = $rule['length'];
        } else {
            $this->clean[$field] = $value;
        }
    }

    private function level(): void
    {
        $level = $this->input['level'] ?? null;

        if (is_string($level) && in_array($level, self::LEVELS, true)) {
            $this->clean['level'] = $level;
        } else {
            $this->errors['level'][] = 'El nivel debe ser: ' . implode(', ', self::LEVELS) . '.';
        }
    }

    private function number(string $field, string $message, int $filter, int|float $min, int|float|null $max = null): void
    {
        $raw = $this->input[$field] ?? null;
        // filter_var convertiría true en 1: los booleanos no son números válidos.
        $value = is_bool($raw) ? false : filter_var($raw, $filter);

        if ($value === false || $value < $min || ($max !== null && $value > $max)) {
            $this->errors[$field][] = $message;
        } else {
            $this->clean[$field] = $value;
        }
    }

    private function active(): void
    {
        if (!array_key_exists('active', $this->input)) {
            if (!$this->partial) {
                $this->clean['active'] = true; // valor por defecto al crear o reemplazar
            }
            return;
        }

        $active = $this->input['active'] === null
            ? null
            : filter_var($this->input['active'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        if ($active === null) {
            $this->errors['active'][] = 'El campo active debe ser verdadero o falso.';
        } else {
            $this->clean['active'] = $active;
        }
    }
}
