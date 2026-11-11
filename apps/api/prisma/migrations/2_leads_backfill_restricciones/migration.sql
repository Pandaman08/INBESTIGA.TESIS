-- =============================================================================
-- P02 · Fase LEADS: backfill de oportunidades + restricciones de integridad
-- Informe: Anexo A (migración), Tabla 6 (estados), Tabla 7 (reglas), Tabla 22 (integridad).
--
-- Idempotente: cada paso filtra lo ya migrado (WHERE ... IS NULL / NOT EXISTS).
-- No borra ni modifica datos existentes salvo completar columnas NUEVAS que estaban en NULL.
-- Rollback: docs/leads/migraciones/rollback_P02.sql
--
-- Decisiones (docs/leads/P02_modelo_oportunidad.md):
--  * Una oportunidad inicial por LEAD (origen = 'MIGRACION', fechaInicio = LEAD.fechaCalificacion).
--  * Estado inicial derivado de registros existentes; nunca PAYER_CONFIRMADO: los PAYER antiguos
--    pudieron crearse desde el chat sin validación externa, así que no se convierten en
--    CONVERSION_PAYER_REF. Deben conciliarse con eventos reales de PAYERS.
--  * DIAGNOSTICO migrado: estado ENTREGADO y fechaEntrega = fechaDiagnostico; fechaSolicitud queda NULL
--    (desconocida), por lo que no entra en K1. No se inventan fechas de solicitud.
--  * PROPUESTA migrada: version por orden de creación; fechaPresentacion = fechaCreacion solo si el
--    estado indica que se presentó (ENVIADA/ACEPTADA/RECHAZADA). Es una aproximación: las
--    oportunidades con origen = 'MIGRACION' pueden excluirse del DataMart.
-- =============================================================================

-- Requeridos por los índices filtrados, sea cual sea el cliente que ejecute el script.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
BEGIN TRAN;

-- 1. Una oportunidad inicial por LEAD sin oportunidades -------------------------------------------
INSERT INTO [dbo].[OPORTUNIDAD_COMERCIAL] ([id], [leadId], [fechaInicio], [estado], [origen], [creadoEn], [actualizadoEn])
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), l.[id], l.[fechaCalificacion], 'ABIERTA', 'MIGRACION', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM [dbo].[LEAD] l
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[OPORTUNIDAD_COMERCIAL] o WHERE o.[leadId] = l.[id]);

-- Oportunidad de referencia por LEAD para el backfill: la migrada (una por lead)
-- (las oportunidades creadas después por el sistema no reciben registros antiguos).

-- 2. Vincular conversaciones (por leadId o, si falta, por buyerId → LEAD) -------------------------
UPDATE c SET c.[oportunidadId] = o.[id]
FROM [dbo].[CONVERSACION] c
JOIN [dbo].[LEAD] l ON l.[id] = COALESCE(c.[leadId], (SELECT l2.[id] FROM [dbo].[LEAD] l2 WHERE l2.[buyerId] = c.[buyerId]))
JOIN [dbo].[OPORTUNIDAD_COMERCIAL] o ON o.[leadId] = l.[id] AND o.[origen] = 'MIGRACION'
WHERE c.[oportunidadId] IS NULL;

-- 3. Vincular diagnósticos, propuestas, objeciones y seguimientos ---------------------------------
UPDATE d SET d.[oportunidadId] = o.[id]
FROM [dbo].[DIAGNOSTICO] d
LEFT JOIN [dbo].[CONVERSACION] c ON c.[id] = d.[conversacionId]
JOIN [dbo].[OPORTUNIDAD_COMERCIAL] o ON o.[origen] = 'MIGRACION'
  AND o.[leadId] = COALESCE(d.[leadId], c.[leadId], (SELECT l2.[id] FROM [dbo].[LEAD] l2 WHERE l2.[buyerId] = c.[buyerId]))
WHERE d.[oportunidadId] IS NULL;

UPDATE p SET p.[oportunidadId] = o.[id]
FROM [dbo].[PROPUESTA] p
LEFT JOIN [dbo].[CONVERSACION] c ON c.[id] = p.[conversacionId]
JOIN [dbo].[OPORTUNIDAD_COMERCIAL] o ON o.[origen] = 'MIGRACION'
  AND o.[leadId] = COALESCE(p.[leadId], c.[leadId], (SELECT l2.[id] FROM [dbo].[LEAD] l2 WHERE l2.[buyerId] = c.[buyerId]))
WHERE p.[oportunidadId] IS NULL;

UPDATE ob SET ob.[oportunidadId] = o.[id]
FROM [dbo].[OBJECION] ob
LEFT JOIN [dbo].[CONVERSACION] c ON c.[id] = ob.[conversacionId]
JOIN [dbo].[OPORTUNIDAD_COMERCIAL] o ON o.[origen] = 'MIGRACION'
  AND o.[leadId] = COALESCE(ob.[leadId], c.[leadId], (SELECT l2.[id] FROM [dbo].[LEAD] l2 WHERE l2.[buyerId] = c.[buyerId]))
WHERE ob.[oportunidadId] IS NULL;

UPDATE s SET s.[oportunidadId] = o.[id]
FROM [dbo].[SEGUIMIENTO] s
LEFT JOIN [dbo].[CONVERSACION] c ON c.[id] = s.[conversacionId]
JOIN [dbo].[OPORTUNIDAD_COMERCIAL] o ON o.[origen] = 'MIGRACION'
  AND o.[leadId] = COALESCE(s.[leadId], c.[leadId], (SELECT l2.[id] FROM [dbo].[LEAD] l2 WHERE l2.[buyerId] = c.[buyerId]))
WHERE s.[oportunidadId] IS NULL;

-- 4. Versiones de propuesta por oportunidad (continúa desde la mayor versión existente) ------------
;WITH numeradas AS (
  SELECT p.[id],
         ROW_NUMBER() OVER (PARTITION BY p.[oportunidadId] ORDER BY p.[fechaCreacion], p.[id])
           + ISNULL((SELECT MAX(p2.[version]) FROM [dbo].[PROPUESTA] p2 WHERE p2.[oportunidadId] = p.[oportunidadId]), 0) AS nueva_version
  FROM [dbo].[PROPUESTA] p
  WHERE p.[oportunidadId] IS NOT NULL AND p.[version] IS NULL
)
UPDATE p SET p.[version] = n.nueva_version
FROM [dbo].[PROPUESTA] p JOIN numeradas n ON n.[id] = p.[id];

UPDATE [dbo].[PROPUESTA]
SET [fechaPresentacion] = [fechaCreacion]
WHERE [oportunidadId] IS NOT NULL AND [fechaPresentacion] IS NULL AND [estado] IN ('ENVIADA', 'ACEPTADA', 'RECHAZADA');

-- 5. Diagnósticos migrados: entregados en fechaDiagnostico; solicitud desconocida ----------------
UPDATE [dbo].[DIAGNOSTICO]
SET [estado] = 'ENTREGADO', [fechaEntrega] = [fechaDiagnostico]
WHERE [oportunidadId] IS NOT NULL AND [estado] IS NULL;

-- 6. Estado de las oportunidades migradas según sus registros -------------------------------------
UPDATE o SET o.[estado] =
  CASE
    WHEN EXISTS (SELECT 1 FROM [dbo].[PROPUESTA] p WHERE p.[oportunidadId] = o.[id] AND p.[estado] = 'ACEPTADA') THEN 'ACEPTADA'
    WHEN EXISTS (SELECT 1 FROM [dbo].[PROPUESTA] p WHERE p.[oportunidadId] = o.[id] AND p.[fechaPresentacion] IS NOT NULL) THEN 'EN_NEGOCIACION'
    WHEN EXISTS (SELECT 1 FROM [dbo].[DIAGNOSTICO] d WHERE d.[oportunidadId] = o.[id]) THEN 'EN_DIAGNOSTICO'
    ELSE 'ABIERTA'
  END
FROM [dbo].[OPORTUNIDAD_COMERCIAL] o
WHERE o.[origen] = 'MIGRACION'
  AND NOT EXISTS (SELECT 1 FROM [dbo].[OPORTUNIDAD_HISTORIAL] h WHERE h.[oportunidadId] = o.[id]);

-- Bitácora: una entrada por oportunidad migrada (marca además que ya fue procesada)
INSERT INTO [dbo].[OPORTUNIDAD_HISTORIAL] ([id], [oportunidadId], [estadoAnterior], [estadoNuevo], [fecha], [actorTipo], [motivo])
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), o.[id], NULL, o.[estado], SYSUTCDATETIME(), 'SISTEMA',
       'Migración P02: oportunidad inicial creada desde LEAD existente'
FROM [dbo].[OPORTUNIDAD_COMERCIAL] o
WHERE o.[origen] = 'MIGRACION'
  AND NOT EXISTS (SELECT 1 FROM [dbo].[OPORTUNIDAD_HISTORIAL] h WHERE h.[oportunidadId] = o.[id]);

-- 7. Restricciones CHECK (informe Tabla 7 / Tabla 22) --------------------------------------------
ALTER TABLE [dbo].[OPORTUNIDAD_COMERCIAL] ADD
  CONSTRAINT [CK_OPORT_ESTADO] CHECK ([estado] IN ('ABIERTA','EN_DIAGNOSTICO','APTA_PARA_COTIZAR','EN_NEGOCIACION','ACEPTADA','TRANSFERIDA','PAYER_CONFIRMADO','DESCARTADA')),
  CONSTRAINT [CK_OPORT_APTA] CHECK ([fechaAptaCotizar] IS NULL OR [fechaAptaCotizar] >= [fechaInicio]),
  CONSTRAINT [CK_OPORT_ORIGEN] CHECK ([origen] IN ('SISTEMA','MIGRACION')),
  -- Estados terminales ⇔ fecha de cierre (permite el índice de "una oportunidad abierta por LEAD")
  CONSTRAINT [CK_OPORT_CIERRE] CHECK (
    ([estado] IN ('PAYER_CONFIRMADO','DESCARTADA') AND [fechaCierre] IS NOT NULL)
    OR ([estado] NOT IN ('PAYER_CONFIRMADO','DESCARTADA') AND [fechaCierre] IS NULL));

ALTER TABLE [dbo].[CITA_VIRTUAL] ADD
  CONSTRAINT [CK_CITA_HORA] CHECK ([inicio] < [fin]),
  CONSTRAINT [CK_CITA_ESTADO] CHECK ([estado] IN ('SOLICITADA','CONFIRMADA','REALIZADA','CANCELADA','NO_ASISTIO'));

ALTER TABLE [dbo].[RESPUESTA_PROPUESTA] ADD
  CONSTRAINT [CK_RESPUESTA_TIPO] CHECK ([tipoRespuesta] IN ('ACEPTADA','RECHAZADA','SOLICITA_AJUSTE'));

ALTER TABLE [dbo].[PROPUESTA_AJUSTE] ADD
  CONSTRAINT [CK_AJUSTE_TIPO] CHECK ([tipo] IN ('DESCUENTO','RECARGO')),
  CONSTRAINT [CK_AJUSTE_MONTO] CHECK ([monto] >= 0);

ALTER TABLE [dbo].[PROPUESTA] ADD
  CONSTRAINT [CK_PROPUESTA_VERSION] CHECK ([version] IS NULL OR [version] >= 1);

ALTER TABLE [dbo].[DIAGNOSTICO] ADD
  CONSTRAINT [CK_DIAG_ESTADO] CHECK ([estado] IS NULL OR [estado] IN ('SOLICITADO','ENTREGADO','ANULADO')),
  CONSTRAINT [CK_DIAG_FECHAS] CHECK ([fechaEntrega] IS NULL OR [fechaSolicitud] IS NULL OR [fechaEntrega] >= [fechaSolicitud]);

ALTER TABLE [dbo].[PERFIL_NEGOCIACION] ADD
  CONSTRAINT [CK_PERFILNEG_CONFIANZA] CHECK ([nivelConfianza] IS NULL OR [nivelConfianza] BETWEEN 1 AND 5);

ALTER TABLE [dbo].[ESCALAMIENTO] ADD
  CONSTRAINT [CK_ESCAL_ESTADO] CHECK ([estado] IN ('PENDIENTE','EN_ATENCION','RESUELTO','DEVUELTO_IA')),
  CONSTRAINT [CK_ESCAL_PRIORIDAD] CHECK ([prioridad] IN ('ALTA','MEDIA','BAJA')),
  CONSTRAINT [CK_ESCAL_DESTINO] CHECK ([destinoRol] IN ('ASESOR','ADMIN'));

ALTER TABLE [dbo].[TRANSFERENCIA_PAYER] ADD
  CONSTRAINT [CK_TRANSF_ESTADO] CHECK ([estado] IN ('ENVIADA','RECIBIDA','RECHAZADA'));

-- 8. Índices únicos filtrados (Prisma no los expresa) ---------------------------------------------
-- Número de versión único por oportunidad (informe Tabla 7)
CREATE UNIQUE INDEX [UX_PROPUESTA_VERSION] ON [dbo].[PROPUESTA] ([oportunidadId], [version])
  WHERE [oportunidadId] IS NOT NULL AND [version] IS NOT NULL;

-- Una sola oportunidad ABIERTA (sin cierre) por LEAD: reabrir exige cerrar la anterior
CREATE UNIQUE INDEX [UX_OPORT_ABIERTA_POR_LEAD] ON [dbo].[OPORTUNIDAD_COMERCIAL] ([leadId])
  WHERE [fechaCierre] IS NULL;

-- Una sola aceptación por versión de propuesta
CREATE UNIQUE INDEX [UX_RESPUESTA_ACEPTADA] ON [dbo].[RESPUESTA_PROPUESTA] ([propuestaId])
  WHERE [tipoRespuesta] = 'ACEPTADA';

COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW
END CATCH
