/**
 * Contrato de estados de OPORTUNIDAD_COMERCIAL (informe LEADS, Tabla 6).
 *
 * El estado cambia SOLO por transiciones autorizadas. Algunas son manuales (un usuario las
 * registra con motivo); otras solo las produce un evento de dominio:
 *  - EN_NEGOCIACION   ← primera propuesta PRESENTADA        (PropuestasService.presentar)
 *  - ACEPTADA         ← aceptación expresa de una versión    (PropuestasService.responder)
 *  - TRANSFERIDA      ← acuerdo emitido a PAYERS             (fase P07)
 *  - PAYER_CONFIRMADO ← confirmación validada de PAYERS      (fase P07, evento externo)
 */
export const ESTADOS_OPORTUNIDAD = [
  'ABIERTA',
  'EN_DIAGNOSTICO',
  'APTA_PARA_COTIZAR',
  'EN_NEGOCIACION',
  'ACEPTADA',
  'TRANSFERIDA',
  'PAYER_CONFIRMADO',
  'DESCARTADA',
] as const;

export type EstadoOportunidad = (typeof ESTADOS_OPORTUNIDAD)[number];

export const ESTADOS_TERMINALES: readonly EstadoOportunidad[] = ['PAYER_CONFIRMADO', 'DESCARTADA'];

export type OrigenTransicion = 'MANUAL' | 'EVENTO';

/** Transiciones permitidas y quién puede producirlas. */
export const TRANSICIONES: Record<EstadoOportunidad, Partial<Record<EstadoOportunidad, OrigenTransicion>>> = {
  ABIERTA: { EN_DIAGNOSTICO: 'MANUAL', DESCARTADA: 'MANUAL' },
  EN_DIAGNOSTICO: { APTA_PARA_COTIZAR: 'MANUAL', DESCARTADA: 'MANUAL' },
  APTA_PARA_COTIZAR: { EN_NEGOCIACION: 'EVENTO', DESCARTADA: 'MANUAL' },
  EN_NEGOCIACION: { ACEPTADA: 'EVENTO', DESCARTADA: 'MANUAL' },
  ACEPTADA: { TRANSFERIDA: 'EVENTO', DESCARTADA: 'MANUAL' },
  TRANSFERIDA: { PAYER_CONFIRMADO: 'EVENTO', DESCARTADA: 'MANUAL' },
  PAYER_CONFIRMADO: {},
  DESCARTADA: {},
};

export function esEstadoValido(estado: string): estado is EstadoOportunidad {
  return (ESTADOS_OPORTUNIDAD as readonly string[]).includes(estado);
}

export function esTerminal(estado: string): boolean {
  return (ESTADOS_TERMINALES as readonly string[]).includes(estado);
}

/**
 * Valida una transición. Devuelve null si es válida o el motivo del rechazo.
 * `origen` indica si la pide un usuario (MANUAL) o un evento de dominio (EVENTO).
 */
export function validarTransicion(actual: string, nuevo: string, origen: OrigenTransicion): string | null {
  if (!esEstadoValido(actual) || !esEstadoValido(nuevo)) return `Estado desconocido: ${actual} → ${nuevo}`;
  if (esTerminal(actual)) return `La oportunidad está cerrada (${actual}); abra un nuevo ciclo en lugar de reabrirla.`;
  const permitido = TRANSICIONES[actual][nuevo];
  if (!permitido) return `Transición no permitida: ${actual} → ${nuevo}`;
  if (permitido === 'EVENTO' && origen === 'MANUAL') {
    return `${nuevo} solo se alcanza por su evento de negocio (propuesta presentada, aceptación expresa, transferencia o confirmación de PAYERS).`;
  }
  return null;
}
