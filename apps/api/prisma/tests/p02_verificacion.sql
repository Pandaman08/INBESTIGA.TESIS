-- Verificación de P02 sobre la BD con p02_fixture_pre_migracion.sql + migraciones 1 y 2.
-- Ejecutar con: sqlcmd -S <servidor> -E -C -I -b -d <bd> -i p02_verificacion.sql
-- Cada aserción lanza THROW si falla. Termina con "P02 VERIFICACION: OK".
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

DECLARE @n INT, @err INT;

-- A. Backfill ----------------------------------------------------------------------------------
SELECT @n = COUNT(*) FROM OPORTUNIDAD_COMERCIAL WHERE origen = 'MIGRACION';
IF @n <> 3 THROW 50001, 'A1: se esperaban 3 oportunidades migradas (una por LEAD)', 1;

IF EXISTS (SELECT leadId FROM OPORTUNIDAD_COMERCIAL GROUP BY leadId HAVING COUNT(*) > 1)
  THROW 50002, 'A2: hay LEAD con más de una oportunidad migrada', 1;

IF (SELECT estado FROM OPORTUNIDAD_COMERCIAL WHERE leadId = 'l1') <> 'ACEPTADA' THROW 50003, 'A3: l1 debía quedar ACEPTADA', 1;
IF (SELECT estado FROM OPORTUNIDAD_COMERCIAL WHERE leadId = 'l2') <> 'ABIERTA'  THROW 50004, 'A4: l2 (solo borrador) debía quedar ABIERTA', 1;
IF (SELECT estado FROM OPORTUNIDAD_COMERCIAL WHERE leadId = 'l3') <> 'ABIERTA'  THROW 50005, 'A5: l3 debía quedar ABIERTA', 1;

IF EXISTS (SELECT 1 FROM CONVERSACION WHERE id IN ('c1','c2') AND oportunidadId IS NULL) THROW 50006, 'A6: c1/c2 sin oportunidad', 1;
IF (SELECT oportunidadId FROM CONVERSACION WHERE id = 'c4') IS NOT NULL THROW 50007, 'A7: c4 (buyer sin LEAD) no debía vincularse', 1;
IF (SELECT c.oportunidadId FROM CONVERSACION c WHERE c.id = 'c2') <> (SELECT id FROM OPORTUNIDAD_COMERCIAL WHERE leadId = 'l2')
  THROW 50008, 'A8: c2 debía vincularse por buyerId a la oportunidad de l2', 1;

IF (SELECT version FROM PROPUESTA WHERE id = 'p1a') <> 1 OR (SELECT version FROM PROPUESTA WHERE id = 'p1b') <> 2
  OR (SELECT version FROM PROPUESTA WHERE id = 'p2a') <> 1 THROW 50009, 'A9: numeración de versiones incorrecta', 1;
IF (SELECT fechaPresentacion FROM PROPUESTA WHERE id = 'p2a') IS NOT NULL THROW 50010, 'A10: un borrador no tiene fecha de presentación', 1;
IF (SELECT fechaPresentacion FROM PROPUESTA WHERE id = 'p1a') IS NULL THROW 50011, 'A11: propuesta ENVIADA sin fecha de presentación', 1;

IF (SELECT estado FROM DIAGNOSTICO WHERE id = 'd1') <> 'ENTREGADO' OR (SELECT fechaSolicitud FROM DIAGNOSTICO WHERE id = 'd1') IS NOT NULL
  THROW 50012, 'A12: diagnóstico migrado debe quedar ENTREGADO y SIN fecha de solicitud inventada', 1;
IF EXISTS (SELECT 1 FROM OBJECION WHERE id = 'o1' AND oportunidadId IS NULL) OR EXISTS (SELECT 1 FROM SEGUIMIENTO WHERE id = 's2' AND oportunidadId IS NULL)
  THROW 50013, 'A13: objeción/seguimiento sin oportunidad', 1;
IF (SELECT COUNT(*) FROM OPORTUNIDAD_HISTORIAL) <> 3 THROW 50014, 'A14: debía existir una entrada de historial por oportunidad migrada', 1;
IF EXISTS (SELECT 1 FROM CONVERSION_PAYER_REF) THROW 50015, 'A15: la migración no debe crear conversiones a PAYERS', 1;

-- Datos previos intactos
IF (SELECT COUNT(*) FROM PROPUESTA) <> 3 OR (SELECT COUNT(*) FROM CONVERSACION) <> 3 OR (SELECT COUNT(*) FROM LEAD) <> 3
  THROW 50016, 'A16: la migración alteró el número de registros existentes', 1;
IF (SELECT estado FROM PROPUESTA WHERE id = 'p1b') <> 'ACEPTADA' OR (SELECT precioPropuesto FROM PROPUESTA WHERE id = 'p1b') <> 2000
  THROW 50017, 'A17: la migración modificó datos existentes de PROPUESTA', 1;

-- B. Restricciones de integridad -----------------------------------------------------------------
-- B1. Segunda oportunidad ABIERTA para el mismo LEAD → índice único filtrado
SET @err = 0;
BEGIN TRY
  INSERT INTO OPORTUNIDAD_COMERCIAL (id, leadId, estado, origen, actualizadoEn) VALUES ('x-op', 'l1', 'ABIERTA', 'SISTEMA', SYSUTCDATETIME());
END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); END CATCH
IF @err <> 2601 THROW 50101, 'B1: se permitió una segunda oportunidad abierta para el mismo LEAD', 1;

-- B2. Oportunidad repetida PERMITIDA si la anterior está cerrada (reapertura con regla explícita)
BEGIN TRAN;
  UPDATE OPORTUNIDAD_COMERCIAL SET estado = 'DESCARTADA', fechaCierre = SYSUTCDATETIME(), motivoCierre = 'prueba' WHERE leadId = 'l3';
  INSERT INTO OPORTUNIDAD_COMERCIAL (id, leadId, estado, origen, actualizadoEn) VALUES ('op-l3-2', 'l3', 'ABIERTA', 'SISTEMA', SYSUTCDATETIME());
  IF (SELECT COUNT(*) FROM OPORTUNIDAD_COMERCIAL WHERE leadId = 'l3') <> 2 THROW 50102, 'B2: no se pudo abrir un nuevo ciclo tras cerrar el anterior', 1;
ROLLBACK;

-- B3. Estado terminal sin fecha de cierre / estado inválido → CHECK
SET @err = 0;
BEGIN TRY UPDATE OPORTUNIDAD_COMERCIAL SET estado = 'DESCARTADA' WHERE leadId = 'l2'; END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); END CATCH
IF @err <> 547 THROW 50103, 'B3: se permitió DESCARTADA sin fecha de cierre', 1;
SET @err = 0;
BEGIN TRY UPDATE OPORTUNIDAD_COMERCIAL SET estado = 'CONVERTED' WHERE leadId = 'l2'; END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); END CATCH
IF @err <> 547 THROW 50104, 'B4: se permitió un estado fuera de la Tabla 6', 1;

-- B5. Propuestas múltiples: versión repetida en la misma oportunidad → índice único
DECLARE @op1 NVARCHAR(1000) = (SELECT id FROM OPORTUNIDAD_COMERCIAL WHERE leadId = 'l1');
SET @err = 0;
BEGIN TRY
  INSERT INTO PROPUESTA (id, leadId, servicioId, precioOriginal, precioPropuesto, montoPorCuota, oportunidadId, version)
  VALUES ('p-dup', 'l1', 'srv-1', 2200, 2200, 2200, @op1, 2);
END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); END CATCH
IF @err <> 2601 THROW 50105, 'B5: se permitió repetir la versión 2 en la misma oportunidad', 1;

-- B6. Propuestas múltiples válidas: versión 3 en la misma oportunidad y versión 1 en otra
BEGIN TRAN;
  INSERT INTO PROPUESTA (id, leadId, servicioId, precioOriginal, precioPropuesto, montoPorCuota, oportunidadId, version)
  VALUES ('p-v3', 'l1', 'srv-1', 2200, 2100, 2100, @op1, 3);
  INSERT INTO PROPUESTA (id, leadId, servicioId, precioOriginal, precioPropuesto, montoPorCuota, oportunidadId, version)
  VALUES ('p-otra', 'l3', 'srv-1', 2200, 2200, 2200, (SELECT id FROM OPORTUNIDAD_COMERCIAL WHERE leadId = 'l3'), 1);
ROLLBACK;

-- B7. Una sola aceptación por versión
SET @err = 0;
BEGIN TRY
  BEGIN TRAN;
    INSERT INTO RESPUESTA_PROPUESTA (id, propuestaId, tipoRespuesta, actorTipo) VALUES ('r1', 'p1b', 'ACEPTADA', 'ESTUDIANTE');
    INSERT INTO RESPUESTA_PROPUESTA (id, propuestaId, tipoRespuesta, actorTipo) VALUES ('r2', 'p1b', 'ACEPTADA', 'ESTUDIANTE');
  COMMIT;
END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); IF @@TRANCOUNT > 0 ROLLBACK; END CATCH
IF @err <> 2601 THROW 50107, 'B7: se permitieron dos aceptaciones de la misma versión', 1;

-- B8. Cita con inicio >= fin y transferencia duplicada
SET @err = 0;
BEGIN TRY
  INSERT INTO CITA_VIRTUAL (id, oportunidadId, inicio, fin, medio) VALUES ('ct1', @op1, '2026-02-01T10:00:00', '2026-02-01T09:00:00', 'GOOGLE_MEET');
END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); END CATCH
IF @err <> 547 THROW 50108, 'B8: se permitió una cita con fin anterior al inicio', 1;

SET @err = 0;
BEGIN TRY
  BEGIN TRAN;
    INSERT INTO TRANSFERENCIA_PAYER (id, oportunidadId, propuestaId, idempotencyKey) VALUES ('t1', @op1, 'p1b', 'acuerdo-l1-v2');
    INSERT INTO TRANSFERENCIA_PAYER (id, oportunidadId, propuestaId, idempotencyKey) VALUES ('t2', @op1, 'p1b', 'acuerdo-l1-v2');
  COMMIT;
END TRY BEGIN CATCH SET @err = ERROR_NUMBER(); IF @@TRANCOUNT > 0 ROLLBACK; END CATCH
IF @err NOT IN (2601, 2627) THROW 50109, 'B9: el acuerdo se pudo emitir dos veces a PAYERS', 1;

PRINT 'P02 VERIFICACION: OK';
