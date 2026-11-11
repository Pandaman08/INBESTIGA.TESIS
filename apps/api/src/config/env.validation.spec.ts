import { validateEnv } from './env.validation';

const ok = { DATABASE_URL: 'sqlserver://x', JWT_SECRET: 'a'.repeat(40) };

describe('validateEnv', () => {
  it('acepta una configuración mínima válida', () => {
    expect(() => validateEnv(ok)).not.toThrow();
  });

  it('rechaza JWT_SECRET ausente, corto o de ejemplo público', () => {
    expect(() => validateEnv({ ...ok, JWT_SECRET: '' })).toThrow(/JWT_SECRET es obligatorio/);
    expect(() => validateEnv({ ...ok, JWT_SECRET: 'corto' })).toThrow(/32 caracteres/);
    expect(() => validateEnv({ ...ok, JWT_SECRET: 'inbestiga-super-secret-jwt-key-2026-academic-research' })).toThrow(/ejemplo público/);
  });

  it('rechaza la clave OpenWA de ejemplo', () => {
    expect(() => validateEnv({ ...ok, OPENWA_API_KEY: 'mi-clave-segura-para-pruebas' })).toThrow(/OPENWA_API_KEY/);
  });

  it('en producción exige secreto de webhook si hay URL de webhook', () => {
    expect(() => validateEnv({ ...ok, NODE_ENV: 'production', OPENWA_WEBHOOK_URL: 'http://h/api' })).toThrow(/OPENWA_WEBHOOK_SECRET/);
  });
});
