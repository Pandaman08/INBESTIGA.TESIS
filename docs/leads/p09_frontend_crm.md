# P09 — Frontend CRM LEADS

## Navegación

La navegación pública y administrativa se separó mediante `AppFrame` y `Navbar`.

```text
Público: Inicio · Servicios y registro · Iniciar sesión

Admin / LEADS:
  Resumen → Conversaciones → Oportunidades → Agenda → Reportes → Agente IA
  Otras fases: BUYERS → PAYERS → CUSTOMERS
```

Las rutas existentes `/admin/live-chat`, `/admin/dashboard` y `/admin/dashboard/leads` se mantienen. La nueva ruta `/admin/leads/conversaciones` reutiliza el inbox refactorizado.

## Fuentes de datos

- Bandeja y ficha: `GET /buyers`, `GET /negotiation/conversacion/:id`, `GET /leads/conversaciones/:id/timeline`.
- Mensaje interno: `POST /negotiation/enviar-mensaje`, con el mismo orquestador de WhatsApp y canal `CHAT_WEB_INTERNO`.
- Oportunidades: `GET /leads/oportunidades`, `GET /leads/estados`, `POST /leads/oportunidades/:id/transiciones`.
- Agenda: `GET /leads/citas`, ampliación mínima sobre `CITA_VIRTUAL`.
- Reportes: `/dashboard/leads`, R1–R4 y ETL existentes.

No se añadieron valores ficticios para completar tarjetas. Los estados vacíos muestran `Sin datos`, `No registrado` o `No hay oportunidades`.

## Validación

- `npm run build --workspace=apps/web`: PASS.
- `npm run build --workspace=apps/api`: PASS.
- `npm run test --workspace=apps/api -- --runInBand`: 11 suites y 85 tests PASS.
- Navegador: login PASS; `/admin/leads` PASS; `/admin/leads/conversaciones` PASS; `/admin/leads/oportunidades` PASS.
- SQL Server aislado: 4 conversaciones, 2 oportunidades y mensajes reales visibles en el inbox.
- OpenWA desconectado: el chat se mantiene disponible y muestra `LOCAL_ONLY`.
- Agenda: endpoint HTTP 200; estado vacío correcto porque no había citas registradas.

## Bloqueos conocidos

- No se verificó una inferencia generativa externa en esta sesión; el entorno aislado respondió mediante la contingencia local del agente.
- Las acciones de reprogramación/cancelación de citas aún no tienen endpoints de dominio; la agenda queda en modo consulta para no inventar mutaciones no autorizadas.
