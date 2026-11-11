/**
 * Reglas de contacto y de datos de prueba para la fase LEADS.
 *
 * - Un BUYER es FICTICIO (sandbox) si su email pertenece a un dominio reservado
 *   (LEADS_SANDBOX_EMAIL_DOMAINS, por defecto "demo.inbestiga.test"; el TLD .test
 *   está reservado por RFC 2606 y no puede pertenecer a una persona real).
 * - Solo los BUYER ficticios pueden reiniciarse desde la interfaz.
 * - A un BUYER ficticio solo se le escribe por WhatsApp si su número está en
 *   WHATSAPP_TEST_ALLOWLIST (números de prueba propios y autorizados).
 * - A cualquier BUYER se le escribe por WhatsApp solo con consentimiento vigente.
 */

export interface BuyerContacto {
  email?: string | null;
  whatsapp?: string | null;
  consentimientoWhatsapp?: boolean | null;
}

export type MotivoNoEnvio = 'SIN_CONSENTIMIENTO' | 'BUYER_FICTICIO_NO_AUTORIZADO' | 'SIN_NUMERO';

const listaEnv = (name: string, fallback = ''): string[] =>
  (process.env[name] ?? fallback)
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

const soloDigitos = (v: string) => v.replace(/\D/g, '');

export function esBuyerFicticio(buyer: Pick<BuyerContacto, 'email'>): boolean {
  const email = (buyer.email || '').toLowerCase();
  const dominio = email.split('@')[1];
  if (!dominio) return false;
  return listaEnv('LEADS_SANDBOX_EMAIL_DOMAINS', 'demo.inbestiga.test').includes(dominio);
}

export function esNumeroDePruebaAutorizado(telefono: string | null | undefined): boolean {
  if (!telefono) return false;
  const tel = soloDigitos(telefono);
  if (tel.length < 9) return false;
  return listaEnv('WHATSAPP_TEST_ALLOWLIST')
    .map(soloDigitos)
    .some((permitido) => permitido.length >= 9 && (tel === permitido || tel.endsWith(permitido) || permitido.endsWith(tel)));
}

/** Decide si se puede escribir por WhatsApp a este BUYER. */
export function evaluarEnvioWhatsApp(buyer: BuyerContacto): { permitido: boolean; motivo?: MotivoNoEnvio } {
  if (!buyer.whatsapp) return { permitido: false, motivo: 'SIN_NUMERO' };
  if (buyer.consentimientoWhatsapp !== true) return { permitido: false, motivo: 'SIN_CONSENTIMIENTO' };
  if (esBuyerFicticio(buyer) && !esNumeroDePruebaAutorizado(buyer.whatsapp)) {
    return { permitido: false, motivo: 'BUYER_FICTICIO_NO_AUTORIZADO' };
  }
  return { permitido: true };
}
