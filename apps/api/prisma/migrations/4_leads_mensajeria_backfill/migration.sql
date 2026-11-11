-- =============================================================================
-- P03 · Backfill del contrato de mensajes + restricciones de idempotencia
-- Idempotente: solo completa columnas nuevas que siguen en NULL.
-- Rollback: docs/leads/migraciones/rollback_P03.sql
-- =============================================================================
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

BEGIN TRY
BEGIN TRAN;

-- 1. Actor a partir del remitente histórico
UPDATE [dbo].[MENSAJE]
SET [actor] = CASE [remitente]
                WHEN 'CLIENTE' THEN 'BUYER'
                WHEN 'AGENTE_IA' THEN 'AGENTE_IA'
                WHEN 'ASESOR_HUMANO' THEN 'ASESOR'
                WHEN 'ADMIN_TEST' THEN 'ADMIN_TEST'
                ELSE 'SISTEMA'
              END
WHERE [actor] IS NULL;

-- 2. Canal: solo si quedó registrado en metadata (desde P01). Si no, queda NULL (= desconocido):
--    antes de P01 las pruebas del panel se guardaban como mensajes del cliente y no se pueden distinguir.
UPDATE [dbo].[MENSAJE] SET [canal] = 'CHAT_WEB_INTERNO'
WHERE [canal] IS NULL AND [metadata] LIKE '%"canal":"CHAT_WEB_INTERNO"%';
UPDATE [dbo].[MENSAJE] SET [canal] = 'WHATSAPP'
WHERE [canal] IS NULL AND [metadata] LIKE '%"canal":"WHATSAPP"%';

-- 3. Oportunidad heredada de la conversación
UPDATE m SET m.[oportunidadId] = c.[oportunidadId]
FROM [dbo].[MENSAJE] m JOIN [dbo].[CONVERSACION] c ON c.[id] = m.[conversacionId]
WHERE m.[oportunidadId] IS NULL AND c.[oportunidadId] IS NOT NULL;

-- 4. Restricciones
ALTER TABLE [dbo].[MENSAJE] ADD
  CONSTRAINT [CK_MENSAJE_ACTOR] CHECK ([actor] IS NULL OR [actor] IN ('BUYER','AGENTE_IA','ASESOR','ADMIN_TEST','SISTEMA')),
  CONSTRAINT [CK_MENSAJE_CANAL] CHECK ([canal] IS NULL OR [canal] IN ('WHATSAPP','CHAT_WEB_INTERNO')),
  CONSTRAINT [CK_MENSAJE_PROCESAMIENTO] CHECK ([estadoProcesamiento] IS NULL OR [estadoProcesamiento] IN ('RECIBIDO','PROCESADO','ERROR'));

-- Un mismo evento de entrada (webhook o envío del panel) se registra UNA sola vez por canal.
CREATE UNIQUE INDEX [UX_MENSAJE_EVENTO] ON [dbo].[MENSAJE] ([canal], [eventoEntradaId])
  WHERE [eventoEntradaId] IS NOT NULL;

-- Como máximo UNA respuesta del agente por mensaje entrante (evita doble respuesta por reintentos).
CREATE UNIQUE INDEX [UX_MENSAJE_RESPUESTA_IA] ON [dbo].[MENSAJE] ([respuestaA])
  WHERE [respuestaA] IS NOT NULL AND [actor] = 'AGENTE_IA';

CREATE INDEX [IX_MENSAJE_PROVIDER] ON [dbo].[MENSAJE] ([providerMessageId])
  WHERE [providerMessageId] IS NOT NULL;

COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW
END CATCH
