-- Verificación de P03 (tras p02_fixture + p03_fixture + migraciones 1..4).
-- Ejecutar con: sqlcmd -S <servidor> -E -C -I -b -d <bd> -i p03_verificacion.sql
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
DECLARE @err INT;

-- A. Backfill del contrato de mensajes
IF (SELECT actor FROM MENSAJE WHERE id = 'm1') <> 'BUYER' OR (SELECT actor FROM MENSAJE WHERE id = 'm2') <> 'AGENTE_IA'
   OR (SELECT actor FROM MENSAJE WHERE id = 'm3') <> 'ADMIN_TEST' THROW 51001, 'A1: actor mal derivado del remitente', 1;
IF (SELECT canal FROM MENSAJE WHERE id = 'm1') <> 'WHATSAPP' OR (SELECT canal FROM MENSAJE WHERE id = 'm3') <> 'CHAT_WEB_INTERNO'
  THROW 51002, 'A2: canal no tomado de la metadata', 1;
IF (SELECT canal FROM MENSAJE WHERE id = 'm4') IS NOT NULL THROW 51003, 'A3: sin metadata el canal debe quedar desconocido (NULL)', 1;
IF (SELECT oportunidadId FROM MENSAJE WHERE id = 'm1') <> (SELECT oportunidadId FROM CONVERSACION WHERE id = 'c1')
  THROW 51004, 'A4: oportunidad no heredada de la conversación', 1;
IF (SELECT oportunidadId FROM MENSAJE WHERE id = 'm4') IS NOT NULL THROW 51005, 'A5: c4 no tiene oportunidad', 1;
IF (SELECT COUNT(*) FROM MENSAJE) <> 4 OR (SELECT contenido FROM MENSAJE WHERE id = 'm2') <> 'Respuesta'
  THROW 51006, 'A6: la migración alteró mensajes existentes', 1;

-- B. Idempotencia de eventos de entrada
SET @err = 0;
BEGIN TRY
  BEGIN TRAN;
    INSERT INTO MENSAJE (id, conversacionId, direccion, remitente, contenido, canal, eventoEntradaId) VALUES ('e1', 'c1', 'INCOMING', 'CLIENTE', 'x', 'WHATSAPP', 'sess:wamid1');
    INSERT INTO MENSAJE (id, conversacionId, direccion, remitente, contenido, canal, eventoEntradaId) VALUES ('e2', 'c1', 'INCOMING', 'CLIENTE', 'x', 'WHATSAPP', 'sess:wamid1');
  COMMIT;
END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); IF @@TRANCOUNT > 0 ROLLBACK; END CATCH
IF @err <> 2601 THROW 51101, 'B1: el mismo evento de webhook se registró dos veces', 1;

-- B2. El mismo id en OTRO canal no colisiona
BEGIN TRAN;
  INSERT INTO MENSAJE (id, conversacionId, direccion, remitente, contenido, canal, eventoEntradaId) VALUES ('e3', 'c1', 'INCOMING', 'CLIENTE', 'x', 'WHATSAPP', 'id-1');
  INSERT INTO MENSAJE (id, conversacionId, direccion, remitente, contenido, canal, eventoEntradaId) VALUES ('e4', 'c1', 'INCOMING', 'ADMIN_TEST', 'x', 'CHAT_WEB_INTERNO', 'id-1');
ROLLBACK;

-- B3. Una sola respuesta del agente por mensaje entrante
SET @err = 0;
BEGIN TRY
  BEGIN TRAN;
    INSERT INTO MENSAJE (id, conversacionId, direccion, remitente, contenido, actor, respuestaA) VALUES ('r1', 'c1', 'OUTGOING', 'AGENTE_IA', 'a', 'AGENTE_IA', 'm1');
    INSERT INTO MENSAJE (id, conversacionId, direccion, remitente, contenido, actor, respuestaA) VALUES ('r2', 'c1', 'OUTGOING', 'AGENTE_IA', 'b', 'AGENTE_IA', 'm1');
  COMMIT;
END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); IF @@TRANCOUNT > 0 ROLLBACK; END CATCH
IF @err <> 2601 THROW 51103, 'B3: se permitieron dos respuestas del agente al mismo mensaje', 1;

-- B4. Un asesor humano sí puede responder además del agente
BEGIN TRAN;
  INSERT INTO MENSAJE (id, conversacionId, direccion, remitente, contenido, actor, respuestaA) VALUES ('r3', 'c1', 'OUTGOING', 'AGENTE_IA', 'a', 'AGENTE_IA', 'm1');
  INSERT INTO MENSAJE (id, conversacionId, direccion, remitente, contenido, actor, respuestaA) VALUES ('r4', 'c1', 'OUTGOING', 'ASESOR_HUMANO', 'b', 'ASESOR', 'm1');
ROLLBACK;

-- B5. CHECK de actor y canal
SET @err = 0;
BEGIN TRY UPDATE MENSAJE SET actor = 'HACKER' WHERE id = 'm1'; END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); END CATCH
IF @err <> 547 THROW 51105, 'B5: se aceptó un actor inválido', 1;
SET @err = 0;
BEGIN TRY UPDATE MENSAJE SET canal = 'SMS' WHERE id = 'm1'; END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); END CATCH
IF @err <> 547 THROW 51106, 'B6: se aceptó un canal inválido', 1;

-- C. Bitácora
INSERT INTO EVENTO_LEADS (id, tipo, actorTipo, resumen, conversacionId) VALUES ('ev1', 'MENSAJE_RECIBIDO', 'BUYER', 'prueba', 'c1');
IF NOT EXISTS (SELECT 1 FROM EVENTO_LEADS WHERE id = 'ev1' AND fecha IS NOT NULL) THROW 51201, 'C1: EVENTO_LEADS no registra fecha por defecto', 1;
DELETE FROM EVENTO_LEADS WHERE id = 'ev1';

PRINT 'P03 VERIFICACION: OK';
