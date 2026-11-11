import { esBuyerFicticio, esNumeroDePruebaAutorizado, evaluarEnvioWhatsApp } from './contact-policy';

describe('contact-policy', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_TEST_ALLOWLIST;
    delete process.env.LEADS_SANDBOX_EMAIL_DOMAINS;
  });

  it('identifica estudiantes ficticios solo por dominio reservado exacto', () => {
    expect(esBuyerFicticio({ email: 'a@demo.inbestiga.test' })).toBe(true);
    expect(esBuyerFicticio({ email: 'a@gmail.com' })).toBe(false);
    expect(esBuyerFicticio({ email: 'a@demo.inbestiga.test.evil.com' })).toBe(false);
    expect(esBuyerFicticio({ email: '' })).toBe(false);
  });

  it('allowlist: compara números completos, con o sin código 51, y rechaza fragmentos', () => {
    process.env.WHATSAPP_TEST_ALLOWLIST = '987654321';
    expect(esNumeroDePruebaAutorizado('51987654321')).toBe(true);
    expect(esNumeroDePruebaAutorizado('987654321')).toBe(true);
    expect(esNumeroDePruebaAutorizado('1')).toBe(false);
    expect(esNumeroDePruebaAutorizado('51911111111')).toBe(false);
  });

  it('exige consentimiento explícito', () => {
    expect(evaluarEnvioWhatsApp({ email: 'a@gmail.com', whatsapp: '51987654321', consentimientoWhatsapp: false })).toEqual({
      permitido: false,
      motivo: 'SIN_CONSENTIMIENTO',
    });
    expect(evaluarEnvioWhatsApp({ email: 'a@gmail.com', whatsapp: '51987654321', consentimientoWhatsapp: true }).permitido).toBe(true);
  });

  it('ficticio solo recibe WhatsApp en números autorizados', () => {
    const b = { email: 'a@demo.inbestiga.test', whatsapp: '51987654321', consentimientoWhatsapp: true };
    expect(evaluarEnvioWhatsApp(b)).toEqual({ permitido: false, motivo: 'BUYER_FICTICIO_NO_AUTORIZADO' });
    process.env.WHATSAPP_TEST_ALLOWLIST = '51987654321';
    expect(evaluarEnvioWhatsApp(b).permitido).toBe(true);
  });
});
