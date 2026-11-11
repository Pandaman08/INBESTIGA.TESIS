-- P03 · Contrato de mensajes (canal, actor, oportunidad, evento de entrada) y bitácora EVENTO_LEADS.
-- Solo agrega columnas NULL y una tabla. Generado con prisma migrate diff y revisado.

BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[MENSAJE] ADD [actor] NVARCHAR(1000),
[actorUsuarioId] NVARCHAR(1000),
[canal] NVARCHAR(1000),
[consentimientoAplicado] NVARCHAR(1000),
[estadoProcesamiento] NVARCHAR(1000),
[eventoEntradaId] NVARCHAR(1000),
[oportunidadId] NVARCHAR(1000),
[providerMessageId] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[EVENTO_LEADS] (
    [id] NVARCHAR(1000) NOT NULL,
    [tipo] NVARCHAR(1000) NOT NULL,
    [fecha] DATETIME2 NOT NULL CONSTRAINT [EVENTO_LEADS_fecha_df] DEFAULT CURRENT_TIMESTAMP,
    [oportunidadId] NVARCHAR(1000),
    [conversacionId] NVARCHAR(1000),
    [mensajeId] NVARCHAR(1000),
    [canal] NVARCHAR(1000),
    [actorTipo] NVARCHAR(1000) NOT NULL,
    [actorId] NVARCHAR(1000),
    [resumen] NVARCHAR(1000) NOT NULL,
    [datos] NVARCHAR(max),
    CONSTRAINT [EVENTO_LEADS_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EVENTO_LEADS_conversacionId_fecha_idx] ON [dbo].[EVENTO_LEADS]([conversacionId], [fecha]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EVENTO_LEADS_oportunidadId_fecha_idx] ON [dbo].[EVENTO_LEADS]([oportunidadId], [fecha]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EVENTO_LEADS_tipo_fecha_idx] ON [dbo].[EVENTO_LEADS]([tipo], [fecha]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MENSAJE_conversacionId_fechaHora_idx] ON [dbo].[MENSAJE]([conversacionId], [fechaHora]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [MENSAJE_oportunidadId_idx] ON [dbo].[MENSAJE]([oportunidadId]);

-- AddForeignKey
ALTER TABLE [dbo].[MENSAJE] ADD CONSTRAINT [MENSAJE_oportunidadId_fkey] FOREIGN KEY ([oportunidadId]) REFERENCES [dbo].[OPORTUNIDAD_COMERCIAL]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EVENTO_LEADS] ADD CONSTRAINT [EVENTO_LEADS_oportunidadId_fkey] FOREIGN KEY ([oportunidadId]) REFERENCES [dbo].[OPORTUNIDAD_COMERCIAL]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

