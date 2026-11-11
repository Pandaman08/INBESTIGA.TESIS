# P03 · Motor conversacional único

Una conversación de negocio, dos canales: **WhatsApp (OpenWA)** y **CHAT_WEB_INTERNO** (prueba desde el panel)
llaman al mismo núcleo, `OrquestadorConversacionalService` (`apps/api/src/modules/leads/conversaciones/`).

```
WhatsApp ─► /whatsapp/webhook ─► firma HMAC + filtros ─► identificar remitente ─┬─ ambiguo/desconocido → cuarentena
                                                                                 └─► Orquestador.recibir(entrada)
Panel ────► /negotiation/enviar-mensaje (ADMIN) ──────────────────────────────────► Orquestador.recibir(entrada)

Orquestador (en serie por estudiante):
  1. conversación vigente ↔ oportunidad abierta (P02)
  2. registrar ENTRADA (UX_MENSAJE_EVENTO: canal + eventoEntradaId)  ── duplicado → ignorar / retomar
  3. agente IA (mismo contexto, historial acotado, sin el mensaje duplicado)
  4. RESERVAR respuesta (UX_MENSAJE_RESPUESTA_IA) → enviar por el MISMO canal → estado real
  5. bitácora EVENTO_LEADS (hechos verificables, sin datos de contacto)
```

## Contrato del mensaje (`MENSAJE`)

| Campo | Contenido |
|---|---|
| `id` | messageId interno |
| `providerMessageId` | id en OpenWA (opcional) |
| `eventoEntradaId` | evento de entrada único: `sessionId:messageId` (webhook) o id generado por el navegador (panel) |
| `conversacionId`, `oportunidadId` | conversación y ciclo de negociación |
| `canal` | `WHATSAPP`, `CHAT_WEB_INTERNO` (NULL = mensaje anterior a P03 sin dato de canal) |
| `actor` / `actorUsuarioId` | `BUYER`, `AGENTE_IA`, `ASESOR`, `ADMIN_TEST`, `SISTEMA` / usuario real del panel |
| `direccion`, `fechaHora` | entrada/salida y fecha |
| `estadoEntrega` | `PENDIENTE` (reservado, en envío), `SENT`, `QUEUED`, `FAILED`, `LOCAL_ONLY`, `DELIVERED` (entrante) |
| `estadoProcesamiento` | entrantes: `RECIBIDO`, `PROCESADO`, `ERROR` |
| `respuestaA` | mensaje entrante al que responde |
| `consentimientoAplicado` | `VIGENTE`, `SIN_CONSENTIMIENTO`, `NUMERO_NO_AUTORIZADO`, `NO_APLICA` |
| `metadata` | JSON auditable (herramienta usada, error de entrega, motivo local); ya no guarda el teléfono destino |

## Garantías

| Riesgo | Control |
|---|---|
| Reintento del webhook | `UX_MENSAJE_EVENTO` en BD (sobrevive a reinicios) + caché en memoria como atajo |
| Doble respuesta (reintento, llamada a herramienta, otra instancia) | Respuesta **reservada antes de enviar**; `UX_MENSAJE_RESPUESTA_IA` impide una segunda fila del agente para el mismo mensaje |
| Caída entre recibir y responder | La entrada queda `RECIBIDO`/`ERROR` sin respuesta; el reintento del mismo evento la **retoma una vez** (`PROCESAMIENTO_REANUDADO`) |
| Orden y concurrencia | Cola en serie por estudiante (ambos canales); estudiantes distintos en paralelo. Alcance: un proceso; con varias instancias, los índices únicos siguen evitando duplicados |
| Error del proveedor de IA | No se responde, queda `ERROR`, evento `IA_ERROR`; se puede reintentar. Respuesta de contingencia sin modelo → evento `IA_NO_DISPONIBLE` |
| Instrucciones inyectadas por el estudiante | El prompt declara los mensajes del estudiante como datos; los datos de herramientas se firman con una marca aleatoria por solicitud que el estudiante no puede conocer |
| PII | El modelo recibe nombre y perfil académico, no teléfono ni correo; la bitácora elimina claves de contacto y recorta textos |
| Tamaño del historial | Máximo `IA_HISTORIAL_MAX_MENSAJES` (12) y `IA_HISTORIAL_MAX_CARACTERES` (6000), lo más reciente primero; entrada máxima 4000 caracteres (se registra el recorte) |
| Contexto ya conocido | El prompt incluye el perfil heredado de BUYERS y pide preguntar solo lo que falte |

**Corrección relevante:** antes de P03 el último mensaje del estudiante se enviaba **dos veces** al modelo (ya estaba guardado en el historial y además se agregaba al final).

## Eventos operativos (`EVENTO_LEADS`)

`MENSAJE_RECIBIDO`, `MENSAJE_DUPLICADO`, `PROCESAMIENTO_REANUDADO`, `HERRAMIENTA_EJECUTADA`, `HERRAMIENTA_BLOQUEADA`,
`RESPUESTA_REGISTRADA`, `ENVIO_FALLIDO`, `IA_NO_DISPONIBLE`, `IA_ERROR`, `REMITENTE_EN_CUARENTENA`, `NEGOCIACION_INICIADA`.

Son hechos verificables con un resumen de una línea; **no** son KPI y no guardan razonamientos del modelo.

| Endpoint (ADMIN) | Uso |
|---|---|
| `GET /api/v1/leads/conversaciones/:id/timeline` | Línea de tiempo explicable: mensajes + eventos en orden |
| `GET /api/v1/leads/eventos?desde=&limite=` | Eventos recientes para el tablero en vivo |

## Migraciones

- `3_leads_mensajeria`: columnas nuevas en MENSAJE (NULL) y tabla EVENTO_LEADS.
- `4_leads_mensajeria_backfill`: actor desde `remitente`; canal solo si quedó en la metadata (si no, NULL: antes de P01 las pruebas del panel no se distinguían); oportunidad desde la conversación; CHECK de actor/canal/procesamiento; índices únicos filtrados.
- Rollback: `docs/leads/migraciones/rollback_P03.sql` (ejecutar antes que el de P02).

## Verificación ejecutada

- SQL Server local (BD temporal, eliminada al terminar): `0_init` → datos de P02 y P03 → migraciones 1–4 → `p02_verificacion.sql` y `p03_verificacion.sql` **OK** → rollback P03 (mensajes conservados) → reaplicar → verificación **OK**.
- Jest (85 pruebas): canal cruzado, contrato del mensaje, webhook repetido secuencial y simultáneo, reinicio seguro, error de IA y reintento, respuesta ya reservada por otra instancia, concurrencia por estudiante, continuidad y nuevo ciclo, consentimiento, recorte, contingencia sin modelo, bitácora sin PII, contexto del modelo (sin duplicado, historial acotado, sin teléfono/correo, marca anti-inyección).
- No verificado: ejecución contra la BD real con Prisma (el SQL Server local no tiene TCP habilitado) ni con OpenWA conectado (fase P05).
