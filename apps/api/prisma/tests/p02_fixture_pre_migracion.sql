-- Datos FICTICIOS con el esquema anterior a P02 (0_init) para verificar el backfill.
-- Casos: lead con conversación vinculada y varias propuestas; conversación sin leadId
-- (se vincula por buyerId); lead sin conversación; buyer sin lead (no debe migrarse).
SET NOCOUNT ON;

INSERT INTO dbo.SERVICIO (id, nombre, codigo, descripcion, tipoInvestigacion, precioBase, precioMinimo, precioMaximo)
VALUES ('srv-1', 'Tesis integral', 'TESIS_INTEGRAL', 'Demo', 'TESIS', 2200, 1870, 2600);

INSERT INTO dbo.BUYER (id, nombres, apellidos, whatsapp, email) VALUES
 ('b1', 'Ana', 'Demo', '51900000001', 'ana@demo.inbestiga.test'),
 ('b2', 'Beto', 'Demo', '51900000002', 'beto@demo.inbestiga.test'),
 ('b3', 'Caro', 'Demo', '51900000003', 'caro@demo.inbestiga.test'),
 ('b4', 'Dani', 'Demo', '51900000004', 'dani@demo.inbestiga.test');

INSERT INTO dbo.LEAD (id, buyerId, scoreCalificado, fechaCalificacion) VALUES
 ('l1', 'b1', 90, '2026-01-05T10:00:00'),
 ('l2', 'b2', 80, '2026-01-06T10:00:00'),
 ('l3', 'b3', 75, '2026-01-07T10:00:00');

INSERT INTO dbo.CONVERSACION (id, buyerId, leadId) VALUES
 ('c1', 'b1', 'l1'),
 ('c2', 'b2', NULL),   -- sin leadId: se vincula por buyerId
 ('c4', 'b4', NULL);   -- buyer sin LEAD: no se migra

INSERT INTO dbo.DIAGNOSTICO (id, conversacionId, leadId, temaInvestigacion, fechaDiagnostico)
VALUES ('d1', 'c1', 'l1', 'Tema demo', '2026-01-05T12:00:00');

INSERT INTO dbo.PROPUESTA (id, conversacionId, leadId, servicioId, precioOriginal, precioPropuesto, montoPorCuota, estado, fechaCreacion) VALUES
 ('p1a', 'c1', 'l1', 'srv-1', 2200, 2200, 2200, 'ENVIADA',  '2026-01-05T13:00:00'),
 ('p1b', 'c1', 'l1', 'srv-1', 2200, 2000, 1000, 'ACEPTADA', '2026-01-06T09:00:00'),
 ('p2a', 'c2', NULL, 'srv-1', 2200, 2200, 2200, 'BORRADOR', '2026-01-07T09:00:00');

INSERT INTO dbo.OBJECION (id, conversacionId, leadId, tipo, descripcion) VALUES ('o1', 'c1', 'l1', 'PRECIO', 'Muy caro');
INSERT INTO dbo.SEGUIMIENTO (id, conversacionId, tipo, fechaProgramada) VALUES ('s2', 'c2', 'RECORDATORIO', '2026-01-08T09:00:00');
PRINT 'fixture cargado';
