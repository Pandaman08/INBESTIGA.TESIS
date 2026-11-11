-- =============================================================================
-- ROLLBACK de las migraciones P03 (3_leads_mensajeria + 4_leads_mensajeria_backfill)
-- ⚠ Elimina EVENTO_LEADS y las columnas nuevas de MENSAJE (canal, actor, oportunidad, eventos de
--   entrada, consentimiento aplicado). Los mensajes en sí se conservan. Haga BACKUP antes.
-- Ejecutar ANTES que rollback_P02.sql si se revierten ambas fases.
-- =============================================================================
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
BEGIN TRAN;

DROP INDEX IF EXISTS [UX_MENSAJE_EVENTO] ON [dbo].[MENSAJE];
DROP INDEX IF EXISTS [UX_MENSAJE_RESPUESTA_IA] ON [dbo].[MENSAJE];
DROP INDEX IF EXISTS [IX_MENSAJE_PROVIDER] ON [dbo].[MENSAJE];
DROP INDEX IF EXISTS [MENSAJE_conversacionId_fechaHora_idx] ON [dbo].[MENSAJE];
DROP INDEX IF EXISTS [MENSAJE_oportunidadId_idx] ON [dbo].[MENSAJE];
ALTER TABLE [dbo].[MENSAJE] DROP CONSTRAINT IF EXISTS [CK_MENSAJE_ACTOR], [CK_MENSAJE_CANAL], [CK_MENSAJE_PROCESAMIENTO], [MENSAJE_oportunidadId_fkey];
ALTER TABLE [dbo].[MENSAJE] DROP COLUMN IF EXISTS [canal], [actor], [actorUsuarioId], [oportunidadId], [eventoEntradaId],
  [providerMessageId], [consentimientoAplicado], [estadoProcesamiento];

DROP TABLE IF EXISTS [dbo].[EVENTO_LEADS];

IF OBJECT_ID('[dbo].[_prisma_migrations]') IS NOT NULL
  DELETE FROM [dbo].[_prisma_migrations] WHERE [migration_name] IN ('3_leads_mensajeria', '4_leads_mensajeria_backfill');

COMMIT TRAN;
PRINT 'ROLLBACK P03: OK';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH
