/**
 * Error único de la capa de comunicación: conserva el código HTTP y los errores por campo
 * ({ campo: [mensajes] }) cuando la API responde 422.
 */
export class ApiError extends Error {
  constructor(message, status = 0, errors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}
