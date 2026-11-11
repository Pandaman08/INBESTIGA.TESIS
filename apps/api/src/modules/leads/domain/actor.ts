/** Quién origina una acción de LEADS (se registra en historiales y respuestas). */
export interface Actor {
  tipo: 'ADMIN' | 'ASESOR' | 'AGENTE_IA' | 'SISTEMA' | 'PAYERS' | 'ESTUDIANTE';
  id?: string | null;
}

/** Error de Prisma por índice/clave única (SQL Server 2601/2627). */
export function esViolacionUnica(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}
