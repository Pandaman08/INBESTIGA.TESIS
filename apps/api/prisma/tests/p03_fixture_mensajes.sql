-- Mensajes con el esquema anterior a P03 (sobre p02_fixture_pre_migracion.sql), para verificar el backfill.
SET NOCOUNT ON;
INSERT INTO dbo.MENSAJE (id, conversacionId, direccion, remitente, contenido, estadoEntrega, metadata) VALUES
 ('m1', 'c1', 'INCOMING', 'CLIENTE',    'Hola',           'DELIVERED',  '{"canal":"WHATSAPP","waChatId":"51900000001@c.us"}'),
 ('m2', 'c1', 'OUTGOING', 'AGENTE_IA',  'Respuesta',      'SENT',       '{"canal":"WHATSAPP"}'),
 ('m3', 'c2', 'INCOMING', 'ADMIN_TEST', 'Prueba interna', 'LOCAL_ONLY', '{"canal":"CHAT_WEB_INTERNO","actor":"ADMIN_TEST"}'),
 ('m4', 'c4', 'INCOMING', 'CLIENTE',    'Mensaje antiguo','DELIVERED',  NULL);
PRINT 'fixture P03 cargado';
