# Seguridad: credenciales, accesos y datos de prueba

## 1. Credenciales

Ninguna credencial vive en el código ni en la documentación. Todas se definen en el `.env` de la raíz
(copiado de `.env.example`, que **no** se sube a Git) y en `apps/api/.env` si se ejecuta la API por separado.

| Variable | Uso | Requisito |
|---|---|---|
| `JWT_SECRET` | Firma de sesiones del panel | Obligatoria, ≥ 32 caracteres. La API **no arranca** si falta o si es un valor de ejemplo conocido. |
| `MSSQL_SA_PASSWORD` | Usuario `sa` del contenedor SQL Server | Obligatoria para `npm run db:up`. Debe coincidir con la de `DATABASE_URL`. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Administrador que crea `npm run prisma:seed` | Contraseña ≥ 12 caracteres. |
| `OPENWA_API_KEY` | Clave compartida INBESTIGA ↔ OpenWA | Valor aleatorio. |
| `OPENWA_WEBHOOK_SECRET` | Firma HMAC de los webhooks de OpenWA | Obligatoria en producción. |
| `CULQI_*`, `PAYMENT_*`, `GEMINI_API_KEY`, `GROQ_API_KEY`, … | Proveedores externos | Claves de prueba (`*_test_*`) en desarrollo. |

Generar un valor aleatorio:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Rotación

Las credenciales que estuvieron publicadas en versiones anteriores del repositorio deben considerarse
**comprometidas** y rotarse aunque ya no aparezcan en el código (siguen en el historial de Git):

| Credencial antigua | Acción |
|---|---|
| Contraseña `sa` de SQL Server del README/compose | Definir `MSSQL_SA_PASSWORD` nuevo y recrear el contenedor (`docker compose down -v` solo si la BD es descartable; si no, `ALTER LOGIN sa WITH PASSWORD = '...'`). |
| Contraseña del administrador del README/seed | Volver a ejecutar el seed con `SEED_ADMIN_PASSWORD` nuevo, o actualizar `USUARIO.passwordHash` con un hash bcrypt nuevo. |
| Usuario `admin` con contraseña `password` de `inbestiga_db_completo.sql` | Si se cargó ese script, desactivar el usuario (`UPDATE USUARIO SET activo = 0 WHERE id = 'usr-admin-001'`). |
| Secreto JWT por defecto del código | Definir `JWT_SECRET` nuevo: invalida todas las sesiones emitidas. |
| Clave OpenWA de ejemplo | Definir `OPENWA_API_KEY` nuevo y reiniciar OpenWA (`npm run openwa:down && npm run openwa:up`). |

Procedimiento general: generar el valor nuevo → actualizar `.env` → reiniciar el servicio → verificar el login /
el envío → revocar el valor anterior en el proveedor.

## 2. Accesos a la API

- Toda ruta exige sesión con rol **ADMIN** (guard global `JwtAuthGuard`), salvo las marcadas con `@Public()`:
  - `POST /auth/login` (máx. 5 intentos/min por IP)
  - `GET /buyers/catalogos`, `POST /buyers/formulario` (captación pública, máx. 10/min)
  - `GET /payments/cotizacion/:id`, `POST /payments/checkout/procesar` (checkout del estudiante)
  - `GET|POST /payments/webhook` (pasarela de pagos)
  - `POST /whatsapp/webhook` (OpenWA; autenticado por firma `X-OpenWA-Signature`)
- Límite general: 120 peticiones/min por IP.
- El panel web inicia sesión en `/login` y envía el token en cada petición.

## 3. Datos de prueba (sandbox) y contacto

- Un estudiante es **FICTICIO** si su email usa un dominio de `LEADS_SANDBOX_EMAIL_DOMAINS`
  (por defecto `demo.inbestiga.test`; el dominio `.test` está reservado y no pertenece a nadie).
  Los estudiantes de `prisma/seed.ts` son ficticios.
- **Reinicio de conversaciones** (`/negotiation/.../limpiar`): solo para estudiantes ficticios, solo si
  `LEADS_SANDBOX_RESET_ENABLED=true` (por defecto fuera de producción) y nunca si el estudiante ya tiene
  cotización, pago, PAYER o CUSTOMER. Solo borra datos de LEADS de esa conversación.
- **WhatsApp**: se escribe a un estudiante solo con `consentimientoWhatsapp = true`. A un estudiante ficticio,
  además, solo si su número está en `WHATSAPP_TEST_ALLOWLIST`. En los demás casos el mensaje queda `LOCAL_ONLY`.
- **Chat de prueba del panel** (live-chat y `simulate-incoming`): el admin escribe como estudiante de prueba;
  se registra con actor `ADMIN_TEST` y nada sale por WhatsApp.
- **Remitentes desconocidos o ambiguos** de WhatsApp no se asocian a ningún estudiante: quedan en cuarentena
  (`GET /whatsapp/cuarentena`) para revisión humana y no reciben respuesta.

## 4. Estados de entrega de mensajes (`MENSAJE.estadoEntrega`)

| Estado | Significado |
|---|---|
| `SENT` | OpenWA aceptó el mensaje (no confirma lectura). |
| `QUEUED` | OpenWA lo encoló. |
| `FAILED` | El transporte falló; el mensaje no salió. No se reintenta automáticamente. |
| `LOCAL_ONLY` | Solo registrado en el sistema (chat interno, sin consentimiento o número no autorizado). |
| `DELIVERED` | Mensaje **entrante** recibido por WhatsApp. |

## 5. Datos personales

No usar nombres, teléfonos ni correos reales en pruebas, capturas o scripts. Usar emails `@demo.inbestiga.test`
y, para probar WhatsApp real, únicamente números propios incluidos en `WHATSAPP_TEST_ALLOWLIST`.
