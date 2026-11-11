# P02 · Módulo LEADS: oportunidad comercial, contratos y OLTP

Contrato: *LEADS_FASE2_FINAL_revisado_v2.docx*, secciones 4.1, 4.4 y 4.12, Tabla 22 y Anexo A.

## 1. Diagrama lógico

```
BUYER ─1:1─ LEAD ─1:N─ OPORTUNIDAD_COMERCIAL ──1:N── OPORTUNIDAD_HISTORIAL
 (identidad,   │              │ (unidad de K1–K5; máx. 1 abierta por LEAD)
  solo lectura)│              ├─1:N─ CONVERSACION ─1:N─ MENSAJE
               │              ├─1:N─ DIAGNOSTICO            (solicitud / entrega → K1)
               │              ├─1:N─ PROPUESTA v1..vn ──┬─1:N─ PROPUESTA_AJUSTE ── REGLA_COMERCIAL
               │              │   (versión única por    ├─N:M─ PROPUESTA_ENTREGABLE ── ENTREGABLE
               │              │    oportunidad)         ├─1:N─ RESPUESTA_PROPUESTA (máx. 1 ACEPTADA)
               │              │                         └─1:N─ OBJECION            (K4)
               │              ├─1:N─ SEGUIMIENTO           (= SEGUIMIENTO_LEAD del informe)
               │              ├─1:N─ ESCALAMIENTO
               │              ├─1:N─ CITA_VIRTUAL ─1:N─ CITA_HISTORIAL
               │              ├─1:N─ TRANSFERENCIA_PAYER   (idempotencyKey única)
               │              └─1:1─ CONVERSION_PAYER_REF  (eventId único; sin montos)
               └─1:N─ RESPONSABLE_PAGO (solo identifica; no registra pagos)
                                            │
        PAYERS (Cotizacion, Pago, Payer) ◄──┘ solo vía TRANSFERENCIA / CONVERSION (P07)
```

## 2. Tablas afectadas

| Tabla | Cambio | Notas |
|---|---|---|
| OPORTUNIDAD_COMERCIAL | **nueva** | Estados de la Tabla 6, `fechaAptaCotizar`, `fechaCierre`, `origen` (SISTEMA/MIGRACION). |
| OPORTUNIDAD_HISTORIAL | **nueva** | Bitácora de transiciones con actor y motivo (adición: el informe exige que el estado se derive de eventos). |
| PROPUESTA_AJUSTE, ENTREGABLE, PROPUESTA_ENTREGABLE, RESPUESTA_PROPUESTA | **nuevas** | Columnas según la BD de referencia `INBESTIGA_TESIS` v2. |
| ESCALAMIENTO, CITA_VIRTUAL, CITA_HISTORIAL, TRANSFERENCIA_PAYER, CONVERSION_PAYER_REF, RESPONSABLE_PAGO | **nuevas** | Lógica en P07–P08; aquí solo estructura e integridad. |
| CONVERSACION | + `oportunidadId` | |
| DIAGNOSTICO | + `oportunidadId, asesorId, estado, fechaSolicitud, fechaEntrega, tipoTesis, limitaciones, tieneEmpresaAplicacion, empresaAplicacion, requiereDerivacion`; `conversacionId` pasa a NULL | Un diagnóstico puede registrarse desde el panel, sin chat. |
| PROPUESTA | + `oportunidadId, version, fechaPresentacion, vigenciaHasta, generadaPor, asesorId`; `conversacionId` NULL | Los campos de precio detallado (base/extras/tope) se completan en P07. |
| OBJECION | + `oportunidadId, propuestaId, grupo, estado, vecesRepetida, escalada, fechaResolucion, resultado`; `conversacionId` NULL | |
| SEGUIMIENTO | + `oportunidadId, propuestaId, asesorId, canal, siguienteAccion`; `conversacionId` NULL | Se reutiliza en lugar de crear SEGUIMIENTO_LEAD (sin homónimos). |
| PERFIL_NEGOCIACION | + `disponibilidad, horarioPreferido, fechaLimite, nivelConfianza` | Se mantiene 1:1 con BUYER (ver decisión D4). |

Ningún cambio borra ni renombra columnas o tablas existentes.

### Restricciones (migración `2_leads_backfill_restricciones`)
- `CK_OPORT_ESTADO`, `CK_OPORT_APTA` (aptitud ≥ inicio), `CK_OPORT_CIERRE` (estado terminal ⇔ `fechaCierre`), `CK_OPORT_ORIGEN`.
- `UX_OPORT_ABIERTA_POR_LEAD`: una sola oportunidad sin cierre por LEAD.
- `UX_PROPUESTA_VERSION (oportunidadId, version)`, `CK_PROPUESTA_VERSION`.
- `UX_RESPUESTA_ACEPTADA`: una aceptación por versión; `CK_RESPUESTA_TIPO`.
- `CK_CITA_HORA` (inicio < fin), `CK_CITA_ESTADO`; `CK_AJUSTE_TIPO/MONTO`; `CK_DIAG_ESTADO/FECHAS`; `CK_PERFILNEG_CONFIANZA`; `CK_ESCAL_*`; `CK_TRANSF_ESTADO`.
- Unicidad de `TRANSFERENCIA_PAYER.idempotencyKey`, `CONVERSION_PAYER_REF.oportunidadId` y `eventId`.

## 3. Contrato de transiciones (Tabla 6)

| Desde | Hacia | Origen | Disparador |
|---|---|---|---|
| ABIERTA | EN_DIAGNOSTICO | MANUAL | Solicitud de diagnóstico registrada |
| EN_DIAGNOSTICO | APTA_PARA_COTIZAR | MANUAL | Requisitos verificados; fija `fechaAptaCotizar` (inicio K2) |
| APTA_PARA_COTIZAR | EN_NEGOCIACION | EVENTO | Primera propuesta **presentada** |
| EN_NEGOCIACION | ACEPTADA | EVENTO | Aceptación **expresa** de una versión vigente |
| ACEPTADA | TRANSFERIDA | EVENTO | Acuerdo emitido a PAYERS (P07) |
| TRANSFERIDA | PAYER_CONFIRMADO | EVENTO | Confirmación validada de PAYERS (P07) |
| cualquier no terminal | DESCARTADA | MANUAL | Con motivo obligatorio |

- Los estados terminales (`PAYER_CONFIRMADO`, `DESCARTADA`) no se reabren: un LEAD puede iniciar un **nuevo ciclo** (otra oportunidad) cuando no tiene ninguna abierta.
- Cada transición se aplica con control de concurrencia optimista (`UPDATE … WHERE estado = <leído>`) y queda en OPORTUNIDAD_HISTORIAL.
- La aceptación **no crea PAYER**: solo cambia la oportunidad a ACEPTADA.

## 4. Servicios y endpoints (`/api/v1/leads`, rol ADMIN)

| Método | Ruta | Servicio |
|---|---|---|
| GET | `/leads/estados` | Contrato de estados y transiciones |
| GET | `/leads/oportunidades?buyerId=&estado=` | `OportunidadesService.listar` |
| GET | `/leads/oportunidades/:id` | Detalle con historial, diagnósticos, propuestas, objeciones, citas, transferencias |
| POST | `/leads/oportunidades` `{buyerId}` | Abre o devuelve la abierta (idempotente, resistente a carreras) |
| POST | `/leads/oportunidades/:id/transiciones` `{estado, motivo?}` | Solo transiciones MANUALES |
| POST | `/leads/oportunidades/:id/propuestas` | Nueva versión BORRADOR (precio dentro del rango del servicio) |
| POST | `/leads/propuestas/:id/presentar` | BORRADOR → ENVIADA; versiones anteriores → REEMPLAZADA |
| POST | `/leads/propuestas/:id/respuestas` | ACEPTADA (con `confirmacionExpresa: true`), RECHAZADA o SOLICITA_AJUSTE |

Integración con el flujo conversacional existente: toda conversación de un BUYER que ya es LEAD se asocia a su oportunidad abierta (se abre una si no existe). El reinicio de conversaciones de prueba **cierra** la oportunidad como `DESCARTADA` (motivo `REINICIO_SANDBOX`) en lugar de borrarla.

## 5. Migración

| Paso | Archivo | Contenido |
|---|---|---|
| M0 | `prisma/migrations/0_init` | Esquema previo (baseline). En una BD creada con `db push`: `npm run prisma:baseline`. |
| M1 | `1_leads_oportunidades` | Solo DDL aditivo (generado con `prisma migrate diff` y revisado). |
| M2 | `2_leads_backfill_restricciones` | Backfill idempotente + CHECK + índices únicos filtrados. |

Se separan en dos archivos porque SQL Server compila cada lote completo: un `UPDATE` sobre columnas creadas en el mismo lote falla.

**Backfill (idempotente):** una oportunidad `origen = MIGRACION` por LEAD (`fechaInicio = LEAD.fechaCalificacion`); vincula conversaciones (por `leadId` o por `buyerId`), diagnósticos, propuestas, objeciones y seguimientos; numera versiones por fecha de creación; estado derivado (ACEPTADA / EN_NEGOCIACION / EN_DIAGNOSTICO / ABIERTA).

**Mapeo de IDs:** se conservan los UUID existentes; las oportunidades migradas reciben UUID nuevos y se identifican por `origen = 'MIGRACION'`. El DataMart (P11) usará claves sustitutas `INT IDENTITY` propias, como indica el informe.

**Respaldo y rollback:** `BACKUP DATABASE` antes de migrar; `docs/leads/migraciones/rollback_P02.sql` elimina solo lo agregado por P02 y restaura `conversacionId NOT NULL` (se niega si hay registros nuevos sin conversación).

**Fechas:** columnas `DATETIME2`; la API escribe en UTC (Prisma). La zona horaria de la cita se guarda explícitamente (`zonaHoraria`, por defecto `America/Lima`).

## 6. Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Se conservan UUID y nombres camelCase del repositorio; la semántica de columnas sigue la BD de referencia `INBESTIGA_TESIS` v2. | El DDL de los anexos usa `INT IDENTITY` y otra nomenclatura; copiarlo rompería Prisma y las fases BUYERS/PAYERS. |
| D2 | Los PAYER históricos **no** se migran como `CONVERSION_PAYER_REF`. | Antes de P01 el agente podía crear PAYER desde el chat sin validación externa; contarlos inflaría K5. Deben conciliarse con eventos reales de PAYERS. |
| D3 | Diagnósticos migrados sin `fechaSolicitud`; propuestas migradas con `fechaPresentacion = fechaCreacion` solo si fueron enviadas. | No se inventan fechas de solicitud. La presentación es una aproximación marcada por `origen = MIGRACION`, excluible en el DataMart. |
| D4 | PERFIL_NEGOCIACION se mantiene 1:1 con BUYER (el informe lo plantea 1:N por LEAD con versión). | Lo usan BUYERS y el agente; versionarlo exige rediseñar esas lecturas. Se reevalúa en P10. |
| D5 | SEGUIMIENTO se amplía en vez de crear SEGUIMIENTO_LEAD. | Evitar tablas homónimas (requisito del roadmap). |
| D6 | TARIFA y REGLA_PRECIO del informe se cubren con `Servicio` (precios base/mín./máx.) y `ReglaComercial`; los CHECK de tope y mínimo en PROPUESTA se agregan en P07 con el cálculo de precio. | P02 no rediseña precios; sí valida que el precio esté dentro del rango del servicio. |
| D7 | Los scripts `infrastructure/sql/transaccional/*.sql` no se actualizan; la fuente de verdad del esquema son las migraciones de Prisma. | Esos scripts usan `NVARCHAR(50)` y Prisma `NVARCHAR(1000)`: las FK nuevas no serían compatibles con una BD creada por ellos. |

## 7. Verificación ejecutada

- SQL Server local (BD temporal `inbestiga_p02_verif`, eliminada al terminar): `0_init` → datos de prueba (`prisma/tests/p02_fixture_pre_migracion.sql`) → M1 → M2 → `prisma/tests/p02_verificacion.sql` (26 aserciones: backfill, datos previos intactos, unicidad de oportunidad abierta, reapertura tras cierre, versiones, aceptación única, CHECK de estados y citas, transferencia única) → **OK**.
- Reejecución del backfill: 11 sentencias con 0 filas afectadas y checksums idénticos (**idempotente**).
- Rollback → datos originales intactos → M1 + M2 de nuevo → verificación **OK**.
- Jest: `src/modules/leads/leads.integridad.spec.ts` (oportunidad repetida, aperturas simultáneas, nuevo ciclo, versiones múltiples y en paralelo, reintento por índice único, aceptación única/expresa/vigente, versión reemplazada, rechazo).
- No verificado: arranque de la API contra la BD migrada (el SQL Server local no tiene TCP habilitado, requisito de Prisma).
