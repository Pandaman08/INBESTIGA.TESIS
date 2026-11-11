/**
 * Validación de configuración al iniciar la API (ConfigModule.forRoot({ validate })).
 * Si falta un secreto o se usa un valor de ejemplo conocido, la API no arranca.
 */

/** Valores de ejemplo que alguna vez estuvieron en el código o en la documentación. */
const SECRETOS_CONOCIDOS = new Set([
  'inbestiga-super-secret-jwt-key-change-this-for-production',
  'inbestiga-super-secret-jwt-key-2026-academic-research',
  'mi-clave-segura-para-pruebas',
  'your_openwa_api_secret_key',
  'cambie_esta_clave_openwa',
  'cambie_este_secreto_webhook',
  'cambie_este_secreto_jwt',
]);

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errores: string[] = [];
  const get = (k: string) => (typeof config[k] === 'string' ? (config[k] as string).trim() : '');
  const produccion = get('NODE_ENV') === 'production';

  if (!get('DATABASE_URL')) errores.push('DATABASE_URL es obligatorio.');

  const jwt = get('JWT_SECRET');
  if (!jwt) errores.push('JWT_SECRET es obligatorio.');
  else if (jwt.length < 32) errores.push('JWT_SECRET debe tener al menos 32 caracteres.');
  else if (SECRETOS_CONOCIDOS.has(jwt)) errores.push('JWT_SECRET usa un valor de ejemplo público: genere uno nuevo.');

  const openwaKey = get('OPENWA_API_KEY');
  if (openwaKey && SECRETOS_CONOCIDOS.has(openwaKey)) {
    errores.push('OPENWA_API_KEY usa un valor de ejemplo público: genere uno nuevo.');
  }

  const webhookSecret = get('OPENWA_WEBHOOK_SECRET');
  if (webhookSecret && SECRETOS_CONOCIDOS.has(webhookSecret)) {
    errores.push('OPENWA_WEBHOOK_SECRET usa un valor de ejemplo público: genere uno nuevo.');
  }
  if (produccion && get('OPENWA_WEBHOOK_URL') && !webhookSecret) {
    errores.push('En producción, OPENWA_WEBHOOK_SECRET es obligatorio para verificar los webhooks de OpenWA.');
  }

  if (errores.length) {
    throw new Error(
      `Configuración inválida:\n - ${errores.join('\n - ')}\n` +
        'Genere secretos con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" (ver docs/SEGURIDAD.md).',
    );
  }
  return config;
}
