/**
 * Ejecuta tareas en serie por clave (p. ej. por estudiante) y en paralelo entre claves distintas.
 * Garantiza orden causal y evita dos respuestas simultáneas para la misma conversación.
 * Alcance: un proceso. Con varias instancias de la API, la unicidad en BD
 * (UX_MENSAJE_EVENTO, UX_MENSAJE_RESPUESTA_IA) sigue impidiendo duplicados.
 */
export class KeyedSerialQueue {
  private readonly colas = new Map<string, Promise<unknown>>();

  run<T>(clave: string, tarea: () => Promise<T>): Promise<T> {
    const previa = this.colas.get(clave) ?? Promise.resolve();
    const resultado = previa.then(tarea, tarea);
    const cola = resultado.then(
      () => undefined,
      () => undefined,
    );
    this.colas.set(clave, cola);
    cola.then(() => {
      if (this.colas.get(clave) === cola) this.colas.delete(clave);
    });
    return resultado;
  }

  get pendientes(): number {
    return this.colas.size;
  }
}
