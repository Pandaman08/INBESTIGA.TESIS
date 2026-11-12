/* P03.7 - Vistas oficiales de KPI y reportes R1-R4.
   Las vistas leen únicamente las tablas materializadas por sp_etl_leads.
   R4 es operativo y consulta el OLTP actual, no agrega KPI nuevos. */
USE INBESTIGA_MART;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER VIEW dbo.vw_leads_kpi_oficial AS
WITH m AS (
    SELECT M1 = COALESCE((SELECT SUM(diagnostico_solicitud_madura) FROM dbo.Hecho_Diagnostico), 0),
           M2 = COALESCE((SELECT SUM(diagnostico_oportuno) FROM dbo.Hecho_Diagnostico), 0),
           M3 = COALESCE((SELECT SUM(oportunidad_apta_madura) FROM dbo.Hecho_Oportunidad), 0),
           M4 = COALESCE((SELECT SUM(cotizacion_oportuna) FROM dbo.Hecho_Oportunidad), 0),
           M5 = COALESCE((SELECT SUM(cotizacion_madura) FROM dbo.Hecho_Oportunidad), 0),
           M6 = COALESCE((SELECT SUM(aceptacion_30d) FROM dbo.Hecho_Oportunidad), 0),
           M7 = COALESCE((SELECT SUM(cohorte_madura) FROM dbo.Hecho_Oportunidad), 0),
           M8 = COALESCE((SELECT SUM(conversion_60d) FROM dbo.Hecho_Oportunidad), 0),
           M9 = COALESCE((SELECT SUM(objecion_principal_madura) FROM dbo.Hecho_Recuperacion_Objecion), 0),
           M10 = COALESCE((SELECT SUM(objecion_recuperada_30d) FROM dbo.Hecho_Recuperacion_Objecion), 0)
)
SELECT *,
    K1 = CAST(100.0 * M2 / NULLIF(M1, 0) AS DECIMAL(6,2)),
    K2 = CAST(100.0 * M4 / NULLIF(M3, 0) AS DECIMAL(6,2)),
    K3 = CAST(100.0 * M6 / NULLIF(M5, 0) AS DECIMAL(6,2)),
    K4 = CAST(100.0 * M10 / NULLIF(M9, 0) AS DECIMAL(6,2)),
    K5 = CAST(100.0 * M8 / NULLIF(M7, 0) AS DECIMAL(6,2)),
    EstadoK1 = CASE WHEN M1 = 0 THEN 'NO APLICABLE' WHEN 100.0 * M2 / M1 >= 90 THEN 'BUENO' WHEN 100.0 * M2 / M1 >= 75 THEN 'REGULAR' ELSE 'MALO' END,
    EstadoK2 = CASE WHEN M3 = 0 THEN 'NO APLICABLE' WHEN 100.0 * M4 / M3 >= 90 THEN 'BUENO' WHEN 100.0 * M4 / M3 >= 75 THEN 'REGULAR' ELSE 'MALO' END,
    EstadoK3 = CASE WHEN M5 = 0 THEN 'NO APLICABLE' WHEN 100.0 * M6 / M5 >= 35 THEN 'BUENO' WHEN 100.0 * M6 / M5 >= 20 THEN 'REGULAR' ELSE 'MALO' END,
    EstadoK4 = CASE WHEN M9 = 0 THEN 'NO APLICABLE' WHEN 100.0 * M10 / M9 >= 30 THEN 'BUENO' WHEN 100.0 * M10 / M9 >= 15 THEN 'REGULAR' ELSE 'MALO' END,
    EstadoK5 = CASE WHEN M7 = 0 THEN 'NO APLICABLE' WHEN 100.0 * M8 / M7 >= 20 THEN 'BUENO' WHEN 100.0 * M8 / M7 >= 10 THEN 'REGULAR' ELSE 'MALO' END
FROM m;
GO

CREATE OR ALTER VIEW dbo.vw_leads_r1_diagnosticos AS
SELECT e.GrupoEtapa grupo, SUM(h.diagnostico_solicitud_madura) M1, SUM(h.diagnostico_oportuno) M2,
       CAST(100.0 * SUM(h.diagnostico_oportuno) / NULLIF(SUM(h.diagnostico_solicitud_madura), 0) AS DECIMAL(6,2)) K1
FROM dbo.Hecho_Diagnostico h JOIN dbo.Dim_Estudiante e ON e.KeyEstudiante = h.KeyEstudiante
GROUP BY e.GrupoEtapa;
GO
CREATE OR ALTER VIEW dbo.vw_leads_r1_asesores AS
SELECT a.Equipo equipo, SUM(h.diagnostico_solicitud_madura) M1, SUM(h.diagnostico_oportuno) M2,
       CAST(100.0 * SUM(h.diagnostico_oportuno) / NULLIF(SUM(h.diagnostico_solicitud_madura), 0) AS DECIMAL(6,2)) K1
FROM dbo.Hecho_Diagnostico h JOIN dbo.Dim_Asesor a ON a.KeyAsesor = h.KeyAsesor
GROUP BY a.Equipo;
GO
CREATE OR ALTER VIEW dbo.vw_leads_r1_universidades AS
SELECT u.TipoUniversidad tipoUniversidad, SUM(h.diagnostico_solicitud_madura) M1, SUM(h.diagnostico_oportuno) M2,
       CAST(100.0 * SUM(h.diagnostico_oportuno) / NULLIF(SUM(h.diagnostico_solicitud_madura), 0) AS DECIMAL(6,2)) K1
FROM dbo.Hecho_Diagnostico h JOIN dbo.Dim_Ubicacion u ON u.KeyUbicacion = h.KeyUbicacion
GROUP BY u.TipoUniversidad;
GO

CREATE OR ALTER VIEW dbo.vw_leads_r2_cotizacion AS
SELECT c.TipoCanal tipoCanal, s.Familia familia,
       SUM(h.oportunidad_apta_madura) M3, SUM(h.cotizacion_oportuna) M4,
       SUM(h.cotizacion_madura) M5, SUM(h.aceptacion_30d) M6,
       SUM(h.cohorte_madura) M7, SUM(h.conversion_60d) M8,
       CAST(100.0 * SUM(h.cotizacion_oportuna) / NULLIF(SUM(h.oportunidad_apta_madura), 0) AS DECIMAL(6,2)) K2,
       CAST(100.0 * SUM(h.aceptacion_30d) / NULLIF(SUM(h.cotizacion_madura), 0) AS DECIMAL(6,2)) K3,
       CAST(100.0 * SUM(h.conversion_60d) / NULLIF(SUM(h.cohorte_madura), 0) AS DECIMAL(6,2)) K5
FROM dbo.Hecho_Oportunidad h
JOIN dbo.Dim_Canal_Captacion c ON c.KeyCanalCaptacion = h.KeyCanalCaptacion
JOIN dbo.Dim_Servicio s ON s.KeyServicio = h.KeyServicio
GROUP BY c.TipoCanal, s.Familia;
GO

CREATE OR ALTER VIEW dbo.vw_leads_r3_objeciones AS
SELECT o.Grupo grupo, s.Familia familia, SUM(h.objecion_principal_madura) M9, SUM(h.objecion_recuperada_30d) M10,
       CAST(100.0 * SUM(h.objecion_recuperada_30d) / NULLIF(SUM(h.objecion_principal_madura), 0) AS DECIMAL(6,2)) K4
FROM dbo.Hecho_Recuperacion_Objecion h
JOIN dbo.Dim_Objecion o ON o.KeyObjecion = h.KeyObjecion
JOIN dbo.Dim_Servicio s ON s.KeyServicio = h.KeyServicio
GROUP BY o.Grupo, s.Familia;
GO

/* R4 es operativo y consulta el OLTP. Se implementa como procedimiento para
   que el despliegue del DataMart no falle si una instalación aún no tiene
   alguna tabla opcional de citas. La resolución de objetos queda diferida
   hasta la ejecución, sin inventar datos en el DataMart. */
CREATE OR ALTER PROCEDURE dbo.sp_leads_r4_operativo AS
BEGIN
    SET NOCOUNT ON;
SELECT 'CITAS_SOLAPADAS' control, COUNT_BIG(*) cantidad FROM inbestiga_db.dbo.CITA_VIRTUAL a
JOIN inbestiga_db.dbo.CITA_VIRTUAL b ON b.asesorId = a.asesorId AND b.id > a.id AND a.inicio < b.fin AND b.inicio < a.fin
WHERE a.estado <> 'CANCELADA' AND b.estado <> 'CANCELADA'
UNION ALL SELECT 'PROPUESTAS_SIN_RESPUESTA', COUNT_BIG(*) FROM inbestiga_db.dbo.PROPUESTA p LEFT JOIN inbestiga_db.dbo.RESPUESTA_PROPUESTA r ON r.propuestaId = p.id WHERE r.id IS NULL
UNION ALL SELECT 'PRECIOS_INVALIDOS', COUNT_BIG(*) FROM inbestiga_db.dbo.PROPUESTA p WHERE p.precioPropuesto < 0
UNION ALL SELECT 'ESCALAMIENTOS_PENDIENTES', COUNT_BIG(*) FROM inbestiga_db.dbo.ESCALAMIENTO WHERE fechaAtencion IS NULL
UNION ALL SELECT 'TRANSFERENCIAS_SIN_CONFIRMAR', COUNT_BIG(*) FROM inbestiga_db.dbo.TRANSFERENCIA_PAYER t LEFT JOIN inbestiga_db.dbo.CONVERSION_PAYER_REF c ON c.oportunidadId = t.oportunidadId WHERE c.id IS NULL;
END;
GO
