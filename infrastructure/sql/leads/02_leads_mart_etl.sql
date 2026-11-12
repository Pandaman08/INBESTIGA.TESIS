/*
  P03.7 - ETL oficial de LEADS.
  Ejecutar después de 01_leads_mart_ddl.sql sobre la base INBESTIGA_MART.
  @Corte controla la madurez de todas las cohortes; la carga es transaccional
  e idempotente para un mismo OLTP y corte.
*/
USE INBESTIGA_MART;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

CREATE OR ALTER PROCEDURE dbo.sp_etl_leads
    @Corte DATE,
    @VentanaDiagnosticoHoras INT = 48,
    @VentanaCotizacionHoras INT = 2,
    @VentanaAceptacionDias INT = 30,
    @VentanaConversionDias INT = 60
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @EtlId BIGINT;
    DECLARE @Inicio DATETIME2(3) = SYSUTCDATETIME();

    INSERT dbo.Leads_Etl_Ejecucion (fecha_inicio, fecha_corte, estado)
    VALUES (@Inicio, @Corte, 'EN_PROCESO');
    SET @EtlId = SCOPE_IDENTITY();

    BEGIN TRY
        BEGIN TRANSACTION;

        /* D1. Tiempo: se carga el dominio observado y la fecha de corte. */
        DECLARE @MinFecha DATE, @MaxFecha DATE;
        SELECT
            @MinFecha = COALESCE(MIN(x.f), @Corte),
            @MaxFecha = COALESCE(MAX(x.f), @Corte)
        FROM (
            SELECT CAST(fechaInicio AS DATE) f FROM inbestiga_db.dbo.OPORTUNIDAD_COMERCIAL
            UNION ALL SELECT CAST(fechaAptaCotizar AS DATE) FROM inbestiga_db.dbo.OPORTUNIDAD_COMERCIAL WHERE fechaAptaCotizar IS NOT NULL
            UNION ALL SELECT CAST(COALESCE(fechaSolicitud, fechaDiagnostico) AS DATE) FROM inbestiga_db.dbo.DIAGNOSTICO
            UNION ALL SELECT CAST(fechaPresentacion AS DATE) FROM inbestiga_db.dbo.PROPUESTA WHERE fechaPresentacion IS NOT NULL
            UNION ALL SELECT CAST(fechaRegistro AS DATE) FROM inbestiga_db.dbo.OBJECION
            UNION ALL SELECT CAST(fechaConfirmacion AS DATE) FROM inbestiga_db.dbo.CONVERSION_PAYER_REF
            UNION ALL SELECT @Corte
        ) x;

        ;WITH fechas AS (
            SELECT f = @MinFecha
            UNION ALL SELECT DATEADD(DAY, 1, f) FROM fechas WHERE f < @MaxFecha
        )
        INSERT dbo.Dim_Tiempo (Anual, Trimestre, NumeroMes, Mes, Semana, Dia, DiaSemana, idFecha)
        SELECT YEAR(f), CONCAT(YEAR(f), 'T', DATEPART(QUARTER, f)), MONTH(f),
               DATENAME(MONTH, f), DATEPART(ISO_WEEK, f), DAY(f), DATENAME(WEEKDAY, f), f
        FROM fechas f
        WHERE NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo d WHERE d.idFecha = f.f)
        OPTION (MAXRECURSION 0);

        IF NOT EXISTS (SELECT 1 FROM dbo.Dim_Tiempo WHERE idFecha = '19000101')
            INSERT dbo.Dim_Tiempo (Anual, Trimestre, NumeroMes, Mes, Semana, Dia, DiaSemana, idFecha)
            VALUES (1900, '1900T1', 1, 'No aplica', 1, 1, 'No aplica', '19000101');

        /* D2. Dimensiones: IDs de negocio del OLTP actual se conservan como texto. */
        MERGE dbo.Dim_Estudiante AS d
        USING (
            SELECT DISTINCT idContacto = b.id, Estudiante = CONCAT(b.nombres, ' ', b.apellidos),
                Carrera = COALESCE(c.nombre, 'Sin carrera registrada'), Facultad = c.facultad,
                EtapaAcademica = COALESCE(b.ciclo, 'No declarada'),
                GrupoEtapa = CASE WHEN b.ciclo IN ('9no', '10mo', '8vo') THEN 'Ciclos IX–X'
                                  WHEN b.ciclo = 'EGRESADO' THEN 'Egresado'
                                  WHEN b.ciclo IN ('BACHILLER', 'MAESTRIA') THEN 'Bachiller'
                                  ELSE 'Otras etapas' END
            FROM inbestiga_db.dbo.BUYER b
            LEFT JOIN inbestiga_db.dbo.CARRERA c ON c.id = b.carreraId
            UNION ALL SELECT '0', 'Sin estudiante', 'Sin carrera', NULL, 'No aplica', 'No aplica'
        ) s ON s.idContacto = d.idContacto
        WHEN MATCHED THEN UPDATE SET Estudiante = s.Estudiante, Carrera = s.Carrera, Facultad = s.Facultad, EtapaAcademica = s.EtapaAcademica, GrupoEtapa = s.GrupoEtapa
        WHEN NOT MATCHED THEN INSERT (Estudiante, Carrera, Facultad, EtapaAcademica, GrupoEtapa, idContacto)
            VALUES (s.Estudiante, s.Carrera, s.Facultad, s.EtapaAcademica, s.GrupoEtapa, s.idContacto);

        MERGE dbo.Dim_Ubicacion AS d
        USING (
            SELECT DISTINCT idUniversidad = COALESCE(u.id, '0'),
                Sede = CASE WHEN u.id IS NULL THEN 'Sin ubicación' ELSE COALESCE(u.ciudad, 'Sin sede registrada') END,
                Universidad = COALESCE(u.nombre, 'Sin ubicación'), TipoUniversidad = u.tipo
            FROM inbestiga_db.dbo.BUYER b
            LEFT JOIN inbestiga_db.dbo.Universidad u ON u.id = b.universidadId
            UNION ALL SELECT '0', 'Sin ubicación', 'Sin ubicación', NULL
        ) s ON s.idUniversidad = d.idUniversidad AND s.Sede = d.Sede
        WHEN MATCHED THEN UPDATE SET Universidad = s.Universidad, TipoUniversidad = s.TipoUniversidad
        WHEN NOT MATCHED THEN INSERT (Sede, Universidad, TipoUniversidad, idUniversidad)
            VALUES (s.Sede, s.Universidad, s.TipoUniversidad, s.idUniversidad);

        MERGE dbo.Dim_Investigacion AS d
        USING (
            SELECT
                PerfilInvestigacion = MAX(COALESCE(b.tipoInvestigacion, 'Sin diagnóstico')), Enfoque = MAX(COALESCE(b.softwareRequerido, 'No declarado')),
                TipoTesis = COALESCE(di.tipoTesis, b.tipoInvestigacion, 'SIN DIAGNÓSTICO'),
                RangoAvance = CASE WHEN di.id IS NULL THEN 'Sin diagnóstico' WHEN di.avanceActualPct <= 25 THEN '0–25 %' WHEN di.avanceActualPct <= 50 THEN '26–50 %' ELSE '> 50 %' END,
                EmpresaAplicacion = CASE WHEN di.id IS NULL THEN 'Sin diagnóstico' WHEN di.tieneEmpresaAplicacion = 1 THEN 'Con empresa' WHEN di.tieneEmpresaAplicacion = 0 THEN 'Sin empresa' ELSE 'No declarado' END
            FROM inbestiga_db.dbo.BUYER b
            LEFT JOIN inbestiga_db.dbo.LEAD l ON l.buyerId = b.id
            LEFT JOIN inbestiga_db.dbo.DIAGNOSTICO di ON di.leadId = l.id
            GROUP BY COALESCE(di.tipoTesis, b.tipoInvestigacion, 'SIN DIAGNÓSTICO'),
                CASE WHEN di.id IS NULL THEN 'Sin diagnóstico' WHEN di.avanceActualPct <= 25 THEN '0–25 %' WHEN di.avanceActualPct <= 50 THEN '26–50 %' ELSE '> 50 %' END,
                CASE WHEN di.id IS NULL THEN 'Sin diagnóstico' WHEN di.tieneEmpresaAplicacion = 1 THEN 'Con empresa' WHEN di.tieneEmpresaAplicacion = 0 THEN 'Sin empresa' ELSE 'No declarado' END
            UNION SELECT 'Sin diagnóstico', 'No declarado', 'SIN DIAGNÓSTICO', 'Sin diagnóstico', 'Sin diagnóstico'
        ) s ON s.TipoTesis = d.TipoTesis AND s.RangoAvance = d.RangoAvance AND s.EmpresaAplicacion = d.EmpresaAplicacion
        WHEN MATCHED THEN UPDATE SET PerfilInvestigacion = s.PerfilInvestigacion, Enfoque = s.Enfoque
        WHEN NOT MATCHED THEN INSERT (PerfilInvestigacion, Enfoque, TipoTesis, RangoAvance, EmpresaAplicacion)
            VALUES (s.PerfilInvestigacion, s.Enfoque, s.TipoTesis, s.RangoAvance, s.EmpresaAplicacion);

        MERGE dbo.Dim_Servicio AS d
        USING (
            SELECT idServicio = s.id, Familia = s.codigo, TipoServicio = s.tipoInvestigacion, Paquete = s.nombre, Modalidad = NULL, Servicio = s.nombre
            FROM inbestiga_db.dbo.SERVICIO s
            WHERE s.activo = 1
            UNION ALL SELECT '0', NULL, 'NO_APLICA', NULL, NULL, 'Sin propuesta presentada'
        ) s ON s.idServicio = d.idServicio
        WHEN MATCHED THEN UPDATE SET Familia = s.Familia, TipoServicio = s.TipoServicio, Paquete = s.Paquete, Modalidad = s.Modalidad, Servicio = s.Servicio
        WHEN NOT MATCHED THEN INSERT (Familia, TipoServicio, Paquete, Modalidad, Servicio, idServicio)
            VALUES (s.Familia, s.TipoServicio, s.Paquete, s.Modalidad, s.Servicio, s.idServicio);

        MERGE dbo.Dim_Asesor AS d
        USING (
            SELECT idAsesor = a.id, Rol = 'ASESOR', Equipo = NULL, Especialidad = a.especialidad, Asesor = CONCAT(a.nombres, ' ', a.apellidos)
            FROM inbestiga_db.dbo.ASESOR a
            WHERE a.activo = 1
            UNION ALL SELECT '0', 'AGENTE_IA', NULL, NULL, 'Agente IA'
        ) s ON s.idAsesor = d.idAsesor
        WHEN MATCHED THEN UPDATE SET Rol = s.Rol, Equipo = s.Equipo, Especialidad = s.Especialidad, Asesor = s.Asesor
        WHEN NOT MATCHED THEN INSERT (Rol, Equipo, Especialidad, Asesor, idAsesor)
            VALUES (s.Rol, s.Equipo, s.Especialidad, s.Asesor, s.idAsesor);

        MERGE dbo.Dim_Canal_Captacion AS d
        USING (
            SELECT DISTINCT idCanal = COALESCE(c.id, '0'), idCampania = COALESCE(cp.id, '0'),
                TipoCanal = c.tipo, Plataforma = c.codigo, Canal = COALESCE(c.nombre, 'Sin canal'), Campania = COALESCE(cp.nombre, 'Sin campaña')
            FROM inbestiga_db.dbo.BUYER b
            LEFT JOIN inbestiga_db.dbo.CANAL c ON c.id = b.canalId
            LEFT JOIN inbestiga_db.dbo.CAMPAÑA cp ON cp.id = b.campanaId
            UNION ALL SELECT '0', '0', NULL, NULL, 'Sin canal', 'Sin campaña'
        ) s ON s.idCanal = d.idCanal AND s.idCampania = d.idCampania
        WHEN MATCHED THEN UPDATE SET TipoCanal = s.TipoCanal, Plataforma = s.Plataforma, Canal = s.Canal, Campania = s.Campania
        WHEN NOT MATCHED THEN INSERT (TipoCanal, Plataforma, Canal, Campania, idCanal, idCampania)
            VALUES (s.TipoCanal, s.Plataforma, s.Canal, s.Campania, s.idCanal, s.idCampania);

        MERGE dbo.Dim_Objecion AS d
        USING (
            SELECT DISTINCT Grupo = COALESCE(o.grupo, 'OTRO'), Tipo = o.tipo,
                idObjecion = CONCAT(COALESCE(o.grupo, 'OTRO'), '/', o.tipo)
            FROM inbestiga_db.dbo.OBJECION o
            UNION ALL SELECT 'SIN GRUPO', 'SIN TIPO', 'SIN GRUPO/SIN TIPO'
        ) s ON s.idObjecion = d.idObjecion
        WHEN MATCHED THEN UPDATE SET Grupo = s.Grupo, Tipo = s.Tipo
        WHEN NOT MATCHED THEN INSERT (Grupo, Tipo, idObjecion) VALUES (s.Grupo, s.Tipo, s.idObjecion);

        /* D3. Los hechos se recargan dentro de la misma transacción. */
        DELETE FROM dbo.Hecho_Diagnostico;
        DELETE FROM dbo.Hecho_Oportunidad;
        DELETE FROM dbo.Hecho_Recuperacion_Objecion;

        ;WITH first_dx AS (
            SELECT d.*, solicitud = COALESCE(d.fechaSolicitud, d.fechaDiagnostico), rn = ROW_NUMBER() OVER (PARTITION BY d.oportunidadId ORDER BY COALESCE(d.fechaSolicitud, d.fechaDiagnostico), d.id)
            FROM inbestiga_db.dbo.DIAGNOSTICO d WHERE d.oportunidadId IS NOT NULL
        ), first_dx_ready AS (
            SELECT * FROM first_dx WHERE rn = 1
        )
        INSERT dbo.Hecho_Diagnostico
        SELECT dt.KeyTiempo, de.KeyEstudiante, du.KeyUbicacion, di.KeyInvestigacion, da.KeyAsesor, dc.KeyCanalCaptacion,
            M1 = CASE WHEN DATEADD(HOUR, @VentanaDiagnosticoHoras, x.solicitud) <= @Corte THEN 1 ELSE 0 END,
            M2 = CASE WHEN DATEADD(HOUR, @VentanaDiagnosticoHoras, x.solicitud) <= @Corte AND x.estado = 'ENTREGADO' AND x.fechaEntrega <= DATEADD(HOUR, @VentanaDiagnosticoHoras, x.solicitud) THEN 1 ELSE 0 END
        FROM first_dx_ready x
        JOIN inbestiga_db.dbo.OPORTUNIDAD_COMERCIAL o ON o.id = x.oportunidadId
        JOIN inbestiga_db.dbo.LEAD l ON l.id = o.leadId
        JOIN inbestiga_db.dbo.BUYER b ON b.id = l.buyerId
        LEFT JOIN inbestiga_db.dbo.CARRERA c ON c.id = b.carreraId
        LEFT JOIN inbestiga_db.dbo.UNIVERSIDAD u ON u.id = b.universidadId
        LEFT JOIN inbestiga_db.dbo.ASESOR a ON a.id = x.asesorId
        JOIN dbo.Dim_Tiempo dt ON dt.idFecha = CAST(x.solicitud AS DATE)
        JOIN dbo.Dim_Estudiante de ON de.idContacto = b.id
        JOIN dbo.Dim_Ubicacion du ON du.idUniversidad = COALESCE(u.id, '0') AND du.Sede = CASE WHEN u.id IS NULL THEN 'Sin ubicación' ELSE COALESCE(u.ciudad, 'Sin sede registrada') END
        JOIN dbo.Dim_Investigacion di ON di.TipoTesis = COALESCE(x.tipoTesis, b.tipoInvestigacion, 'SIN DIAGNÓSTICO') AND di.RangoAvance = CASE WHEN x.avanceActualPct <= 25 THEN '0–25 %' WHEN x.avanceActualPct <= 50 THEN '26–50 %' ELSE '> 50 %' END AND di.EmpresaAplicacion = CASE WHEN x.tieneEmpresaAplicacion = 1 THEN 'Con empresa' WHEN x.tieneEmpresaAplicacion = 0 THEN 'Sin empresa' ELSE 'No declarado' END
        JOIN dbo.Dim_Asesor da ON da.idAsesor = COALESCE(a.id, '0')
        JOIN dbo.Dim_Canal_Captacion dc ON dc.idCanal = COALESCE(b.canalId, '0') AND dc.idCampania = COALESCE(b.campanaId, '0');

        ;WITH first_p AS (
            SELECT p.*, rn = ROW_NUMBER() OVER (PARTITION BY p.oportunidadId ORDER BY p.fechaPresentacion, p.id)
            FROM inbestiga_db.dbo.PROPUESTA p WHERE p.oportunidadId IS NOT NULL AND p.fechaPresentacion IS NOT NULL
        ), accepted AS (
            SELECT p.oportunidadId, MIN(r.fechaRespuesta) fechaAceptacion
            FROM inbestiga_db.dbo.RESPUESTA_PROPUESTA r JOIN inbestiga_db.dbo.PROPUESTA p ON p.id = r.propuestaId
            WHERE p.oportunidadId IS NOT NULL AND r.tipoRespuesta = 'ACEPTADA'
            GROUP BY p.oportunidadId
        ), ref_dx AS (
            SELECT d.*, rn = ROW_NUMBER() OVER (PARTITION BY d.oportunidadId ORDER BY COALESCE(d.fechaSolicitud, d.fechaDiagnostico), d.id)
            FROM inbestiga_db.dbo.DIAGNOSTICO d WHERE d.oportunidadId IS NOT NULL
        )
        INSERT dbo.Hecho_Oportunidad
        SELECT ti.KeyTiempo, ta.KeyTiempo, tp.KeyTiempo, de.KeyEstudiante, du.KeyUbicacion, di.KeyInvestigacion, ds.KeyServicio, da.KeyAsesor, dc.KeyCanalCaptacion,
            M3 = CASE WHEN o.fechaAptaCotizar IS NOT NULL AND DATEADD(HOUR, @VentanaCotizacionHoras, o.fechaAptaCotizar) <= @Corte THEN 1 ELSE 0 END,
            M4 = CASE WHEN o.fechaAptaCotizar IS NOT NULL AND DATEADD(HOUR, @VentanaCotizacionHoras, o.fechaAptaCotizar) <= @Corte AND fp.fechaPresentacion <= DATEADD(HOUR, @VentanaCotizacionHoras, o.fechaAptaCotizar) THEN 1 ELSE 0 END,
            M5 = CASE WHEN fp.fechaPresentacion IS NOT NULL AND DATEADD(DAY, @VentanaAceptacionDias, fp.fechaPresentacion) <= @Corte THEN 1 ELSE 0 END,
            M6 = CASE WHEN fp.fechaPresentacion IS NOT NULL AND DATEADD(DAY, @VentanaAceptacionDias, fp.fechaPresentacion) <= @Corte AND ac.fechaAceptacion IS NOT NULL AND ac.fechaAceptacion <= DATEADD(DAY, @VentanaAceptacionDias, fp.fechaPresentacion) THEN 1 ELSE 0 END,
            M7 = CASE WHEN DATEADD(DAY, @VentanaConversionDias, o.fechaInicio) <= @Corte THEN 1 ELSE 0 END,
            M8 = CASE WHEN DATEADD(DAY, @VentanaConversionDias, o.fechaInicio) <= @Corte AND cv.fechaConfirmacion IS NOT NULL AND cv.fechaConfirmacion <= DATEADD(DAY, @VentanaConversionDias, o.fechaInicio) THEN 1 ELSE 0 END
        FROM inbestiga_db.dbo.OPORTUNIDAD_COMERCIAL o
        JOIN inbestiga_db.dbo.LEAD l ON l.id = o.leadId
        JOIN inbestiga_db.dbo.BUYER b ON b.id = l.buyerId
        LEFT JOIN inbestiga_db.dbo.UNIVERSIDAD u ON u.id = b.universidadId
        LEFT JOIN inbestiga_db.dbo.PROPUESTA fp ON fp.oportunidadId = o.id AND fp.fechaPresentacion IS NOT NULL AND fp.id IN (SELECT id FROM first_p WHERE rn = 1)
        LEFT JOIN accepted ac ON ac.oportunidadId = o.id
        LEFT JOIN ref_dx dx ON dx.oportunidadId = o.id AND dx.rn = 1
        LEFT JOIN inbestiga_db.dbo.CONVERSION_PAYER_REF cv ON cv.oportunidadId = o.id
        LEFT JOIN inbestiga_db.dbo.SERVICIO s ON s.id = fp.servicioId
        LEFT JOIN inbestiga_db.dbo.ASESOR a ON a.id = o.asesorResponsableId
        JOIN dbo.Dim_Tiempo ti ON ti.idFecha = CAST(o.fechaInicio AS DATE)
        JOIN dbo.Dim_Tiempo ta ON ta.idFecha = COALESCE(CAST(o.fechaAptaCotizar AS DATE), '19000101')
        JOIN dbo.Dim_Tiempo tp ON tp.idFecha = COALESCE(CAST(fp.fechaPresentacion AS DATE), '19000101')
        JOIN dbo.Dim_Estudiante de ON de.idContacto = b.id
        JOIN dbo.Dim_Ubicacion du ON du.idUniversidad = COALESCE(u.id, '0') AND du.Sede = CASE WHEN u.id IS NULL THEN 'Sin ubicación' ELSE COALESCE(u.ciudad, 'Sin sede registrada') END
        JOIN dbo.Dim_Investigacion di ON di.TipoTesis = COALESCE(dx.tipoTesis, b.tipoInvestigacion, 'SIN DIAGNÓSTICO') AND di.RangoAvance = CASE WHEN dx.id IS NULL THEN 'Sin diagnóstico' WHEN dx.avanceActualPct <= 25 THEN '0–25 %' WHEN dx.avanceActualPct <= 50 THEN '26–50 %' ELSE '> 50 %' END AND di.EmpresaAplicacion = CASE WHEN dx.id IS NULL THEN 'Sin diagnóstico' WHEN dx.tieneEmpresaAplicacion = 1 THEN 'Con empresa' WHEN dx.tieneEmpresaAplicacion = 0 THEN 'Sin empresa' ELSE 'No declarado' END
        JOIN dbo.Dim_Servicio ds ON ds.idServicio = COALESCE(s.id, '0')
        JOIN dbo.Dim_Asesor da ON da.idAsesor = COALESCE(a.id, '0')
        JOIN dbo.Dim_Canal_Captacion dc ON dc.idCanal = COALESCE(b.canalId, '0') AND dc.idCampania = COALESCE(b.campanaId, '0');

        ;WITH first_obj AS (
            SELECT o.id, o.tipo, o.grupo, o.fechaRegistro, p.oportunidadId, p.servicioId,
                   rn = ROW_NUMBER() OVER (PARTITION BY p.oportunidadId ORDER BY o.fechaRegistro, o.id)
            FROM inbestiga_db.dbo.OBJECION o JOIN inbestiga_db.dbo.PROPUESTA p ON p.id = o.propuestaId
            WHERE p.oportunidadId IS NOT NULL
        ), recovered AS (
            SELECT x.*, recuperada = CASE WHEN EXISTS (
                SELECT 1 FROM inbestiga_db.dbo.RESPUESTA_PROPUESTA r JOIN inbestiga_db.dbo.PROPUESTA p ON p.id = r.propuestaId
                WHERE p.oportunidadId = x.oportunidadId AND r.tipoRespuesta = 'ACEPTADA' AND r.fechaRespuesta > x.fechaRegistro AND r.fechaRespuesta <= DATEADD(DAY, @VentanaAceptacionDias, x.fechaRegistro)
            ) THEN 1 ELSE 0 END
            FROM first_obj x WHERE x.rn = 1
        )
        INSERT dbo.Hecho_Recuperacion_Objecion
        SELECT dt.KeyTiempo, de.KeyEstudiante, du.KeyUbicacion, di.KeyInvestigacion, ds.KeyServicio, da.KeyAsesor, dc.KeyCanalCaptacion, dob.KeyObjecion,
            M9 = CASE WHEN DATEADD(DAY, @VentanaAceptacionDias, x.fechaRegistro) <= @Corte THEN 1 ELSE 0 END,
            M10 = CASE WHEN DATEADD(DAY, @VentanaAceptacionDias, x.fechaRegistro) <= @Corte THEN x.recuperada ELSE 0 END
        FROM recovered x
        JOIN inbestiga_db.dbo.OPORTUNIDAD_COMERCIAL op ON op.id = x.oportunidadId
        JOIN inbestiga_db.dbo.LEAD l ON l.id = op.leadId
        JOIN inbestiga_db.dbo.BUYER b ON b.id = l.buyerId
        LEFT JOIN inbestiga_db.dbo.UNIVERSIDAD u ON u.id = b.universidadId
        LEFT JOIN inbestiga_db.dbo.SERVICIO s ON s.id = x.servicioId
        LEFT JOIN inbestiga_db.dbo.ASESOR a ON a.id = op.asesorResponsableId
        JOIN dbo.Dim_Tiempo dt ON dt.idFecha = CAST(x.fechaRegistro AS DATE)
        JOIN dbo.Dim_Estudiante de ON de.idContacto = b.id
        JOIN dbo.Dim_Ubicacion du ON du.idUniversidad = COALESCE(u.id, '0') AND du.Sede = CASE WHEN u.id IS NULL THEN 'Sin ubicación' ELSE COALESCE(u.ciudad, 'Sin sede registrada') END
        JOIN dbo.Dim_Investigacion di ON di.TipoTesis = COALESCE(b.tipoInvestigacion, 'SIN DIAGNÓSTICO') AND di.RangoAvance = 'Sin diagnóstico' AND di.EmpresaAplicacion = 'Sin diagnóstico'
        JOIN dbo.Dim_Servicio ds ON ds.idServicio = COALESCE(s.id, '0')
        JOIN dbo.Dim_Asesor da ON da.idAsesor = COALESCE(a.id, '0')
        JOIN dbo.Dim_Canal_Captacion dc ON dc.idCanal = COALESCE(b.canalId, '0') AND dc.idCampania = COALESCE(b.campanaId, '0')
        JOIN dbo.Dim_Objecion dob ON dob.idObjecion = CONCAT(COALESCE(x.grupo, 'OTRO'), '/', x.tipo);

        UPDATE dbo.Leads_Etl_Ejecucion
        SET fecha_fin = SYSUTCDATETIME(), estado = 'OK',
            filas_diagnostico = (SELECT COUNT(*) FROM dbo.Hecho_Diagnostico),
            filas_oportunidad = (SELECT COUNT(*) FROM dbo.Hecho_Oportunidad),
            filas_objecion = (SELECT COUNT(*) FROM dbo.Hecho_Recuperacion_Objecion)
        WHERE id = @EtlId;

        COMMIT TRANSACTION;

        SELECT @EtlId AS etl_id, 'OK' AS estado,
               (SELECT SUM(diagnostico_solicitud_madura) FROM dbo.Hecho_Diagnostico) AS M1,
               (SELECT SUM(diagnostico_oportuno) FROM dbo.Hecho_Diagnostico) AS M2,
               (SELECT SUM(oportunidad_apta_madura) FROM dbo.Hecho_Oportunidad) AS M3,
               (SELECT SUM(cotizacion_oportuna) FROM dbo.Hecho_Oportunidad) AS M4,
               (SELECT SUM(cotizacion_madura) FROM dbo.Hecho_Oportunidad) AS M5,
               (SELECT SUM(aceptacion_30d) FROM dbo.Hecho_Oportunidad) AS M6,
               (SELECT SUM(cohorte_madura) FROM dbo.Hecho_Oportunidad) AS M7,
               (SELECT SUM(conversion_60d) FROM dbo.Hecho_Oportunidad) AS M8,
               (SELECT SUM(objecion_principal_madura) FROM dbo.Hecho_Recuperacion_Objecion) AS M9,
               (SELECT SUM(objecion_recuperada_30d) FROM dbo.Hecho_Recuperacion_Objecion) AS M10;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        UPDATE dbo.Leads_Etl_Ejecucion SET fecha_fin = SYSUTCDATETIME(), estado = 'ERROR', error_mensaje = ERROR_MESSAGE() WHERE id = @EtlId;
        THROW;
    END CATCH;
END;
GO
