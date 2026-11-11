-- =============================================================================
-- ROLLBACK de las migraciones P02 (1_leads_oportunidades + 2_leads_backfill_restricciones)
--
-- ⚠ Elimina las tablas y columnas NUEVAS de LEADS y TODO lo registrado en ellas después de
--   migrar (oportunidades, citas, transferencias, versiones, etc.). Los datos que ya existían
--   antes de P02 no se tocan. Haga BACKUP DATABASE antes de ejecutarlo.
-- Después: borrar las filas de _prisma_migrations (incluido al final) y volver al commit anterior.
-- Ejecutar con: sqlcmd -S <servidor> -E -C -I -b -d <bd> -i rollback_P02.sql
-- =============================================================================
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
BEGIN TRAN;

DECLARE @sql NVARCHAR(MAX) = N'';

-- 1. Claves foráneas que salen de las columnas nuevas o apuntan a las tablas nuevas
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
             + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + CHAR(10)
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.referenced_object_id) IN ('OPORTUNIDAD_COMERCIAL','OPORTUNIDAD_HISTORIAL','PROPUESTA_AJUSTE','ENTREGABLE','PROPUESTA_ENTREGABLE',
        'RESPUESTA_PROPUESTA','ESCALAMIENTO','CITA_VIRTUAL','CITA_HISTORIAL','TRANSFERENCIA_PAYER','CONVERSION_PAYER_REF','RESPONSABLE_PAGO')
   OR OBJECT_NAME(fk.parent_object_id) IN ('OPORTUNIDAD_COMERCIAL','OPORTUNIDAD_HISTORIAL','PROPUESTA_AJUSTE','ENTREGABLE','PROPUESTA_ENTREGABLE',
        'RESPUESTA_PROPUESTA','ESCALAMIENTO','CITA_VIRTUAL','CITA_HISTORIAL','TRANSFERENCIA_PAYER','CONVERSION_PAYER_REF','RESPONSABLE_PAGO')
   OR fk.name IN ('DIAGNOSTICO_asesorId_fkey','PROPUESTA_asesorId_fkey','OBJECION_propuestaId_fkey','SEGUIMIENTO_propuestaId_fkey','SEGUIMIENTO_asesorId_fkey');
EXEC sp_executesql @sql;

-- 2. Índices y CHECK sobre tablas existentes
DROP INDEX IF EXISTS [UX_PROPUESTA_VERSION] ON [dbo].[PROPUESTA];
DROP INDEX IF EXISTS [CONVERSACION_oportunidadId_idx] ON [dbo].[CONVERSACION];
DROP INDEX IF EXISTS [DIAGNOSTICO_oportunidadId_idx] ON [dbo].[DIAGNOSTICO];
DROP INDEX IF EXISTS [PROPUESTA_oportunidadId_idx] ON [dbo].[PROPUESTA];
DROP INDEX IF EXISTS [OBJECION_oportunidadId_idx] ON [dbo].[OBJECION];
DROP INDEX IF EXISTS [SEGUIMIENTO_oportunidadId_idx] ON [dbo].[SEGUIMIENTO];
ALTER TABLE [dbo].[PROPUESTA] DROP CONSTRAINT IF EXISTS [CK_PROPUESTA_VERSION];
ALTER TABLE [dbo].[DIAGNOSTICO] DROP CONSTRAINT IF EXISTS [CK_DIAG_ESTADO], [CK_DIAG_FECHAS];
ALTER TABLE [dbo].[PERFIL_NEGOCIACION] DROP CONSTRAINT IF EXISTS [CK_PERFILNEG_CONFIANZA];

-- 3. Tablas nuevas
DROP TABLE IF EXISTS [dbo].[CITA_HISTORIAL], [dbo].[CITA_VIRTUAL], [dbo].[TRANSFERENCIA_PAYER], [dbo].[CONVERSION_PAYER_REF],
  [dbo].[RESPUESTA_PROPUESTA], [dbo].[PROPUESTA_ENTREGABLE], [dbo].[ENTREGABLE], [dbo].[PROPUESTA_AJUSTE], [dbo].[ESCALAMIENTO],
  [dbo].[RESPONSABLE_PAGO], [dbo].[OPORTUNIDAD_HISTORIAL], [dbo].[OPORTUNIDAD_COMERCIAL];

-- 4. Columnas nuevas en tablas existentes
ALTER TABLE [dbo].[CONVERSACION] DROP COLUMN IF EXISTS [oportunidadId];
ALTER TABLE [dbo].[PERFIL_NEGOCIACION] DROP COLUMN IF EXISTS [disponibilidad], [horarioPreferido], [fechaLimite], [nivelConfianza];
ALTER TABLE [dbo].[DIAGNOSTICO] DROP COLUMN IF EXISTS [oportunidadId], [asesorId], [estado], [fechaSolicitud], [fechaEntrega], [tipoTesis],
  [limitaciones], [tieneEmpresaAplicacion], [empresaAplicacion], [requiereDerivacion];
ALTER TABLE [dbo].[PROPUESTA] DROP COLUMN IF EXISTS [oportunidadId], [version], [fechaPresentacion], [vigenciaHasta], [generadaPor], [asesorId];
ALTER TABLE [dbo].[OBJECION] DROP COLUMN IF EXISTS [oportunidadId], [propuestaId], [grupo], [estado], [vecesRepetida], [escalada], [fechaResolucion], [resultado];
ALTER TABLE [dbo].[SEGUIMIENTO] DROP COLUMN IF EXISTS [oportunidadId], [propuestaId], [asesorId], [canal], [siguienteAccion];

-- 5. conversacionId vuelve a NOT NULL solo si no hay filas creadas sin conversación
IF EXISTS (SELECT 1 FROM [dbo].[DIAGNOSTICO] WHERE conversacionId IS NULL) OR EXISTS (SELECT 1 FROM [dbo].[PROPUESTA] WHERE conversacionId IS NULL)
   OR EXISTS (SELECT 1 FROM [dbo].[OBJECION] WHERE conversacionId IS NULL) OR EXISTS (SELECT 1 FROM [dbo].[SEGUIMIENTO] WHERE conversacionId IS NULL)
  THROW 50900, 'Hay registros sin conversacionId creados después de P02: revíselos antes de revertir (no se borran automáticamente).', 1;
ALTER TABLE [dbo].[DIAGNOSTICO] ALTER COLUMN [conversacionId] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[PROPUESTA] ALTER COLUMN [conversacionId] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[OBJECION] ALTER COLUMN [conversacionId] NVARCHAR(1000) NOT NULL;
ALTER TABLE [dbo].[SEGUIMIENTO] ALTER COLUMN [conversacionId] NVARCHAR(1000) NOT NULL;

-- 6. Historial de migraciones de Prisma
IF OBJECT_ID('[dbo].[_prisma_migrations]') IS NOT NULL
  DELETE FROM [dbo].[_prisma_migrations] WHERE [migration_name] IN ('1_leads_oportunidades', '2_leads_backfill_restricciones');

COMMIT TRAN;
PRINT 'ROLLBACK P02: OK';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH
