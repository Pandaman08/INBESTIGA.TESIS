/*
  P03.7 - DataMart oficial de LEADS sobre el OLTP actual.

  Este script es aditivo y no elimina bases, tablas, datos ni volúmenes.
  El OLTP canónico sigue siendo inbestiga_db; INBESTIGA_MART es una base
  analítica separada que conserva los identificadores String del repositorio.
  Las ocho dimensiones y los tres hechos mantienen el modelo aprobado de los
  scripts de referencia, con tipos de clave adaptados a Prisma.
*/
USE master;
GO
IF DB_ID(N'INBESTIGA_MART') IS NULL
    CREATE DATABASE INBESTIGA_MART;
GO
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

IF OBJECT_ID(N'dbo.Dim_Tiempo', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Tiempo (
        KeyTiempo INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsDimTiempo PRIMARY KEY,
        Anual INT NOT NULL,
        Trimestre VARCHAR(12) NOT NULL,
        NumeroMes TINYINT NOT NULL,
        Mes VARCHAR(20) NOT NULL,
        Semana TINYINT NOT NULL,
        Dia TINYINT NOT NULL,
        DiaSemana VARCHAR(20) NOT NULL,
        idFecha DATE NOT NULL CONSTRAINT UQ_LeadsDimTiempoFecha UNIQUE
    );
END;
GO
IF OBJECT_ID(N'dbo.Dim_Estudiante', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Estudiante (
        KeyEstudiante INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsDimEstudiante PRIMARY KEY,
        Estudiante VARCHAR(201) NOT NULL,
        Carrera VARCHAR(120) NOT NULL,
        Facultad VARCHAR(120) NULL,
        EtapaAcademica VARCHAR(50) NOT NULL,
        GrupoEtapa VARCHAR(20) NOT NULL,
        idContacto VARCHAR(100) NOT NULL CONSTRAINT UQ_LeadsDimEstudianteContacto UNIQUE
    );
END;
GO
IF OBJECT_ID(N'dbo.Dim_Ubicacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Ubicacion (
        KeyUbicacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsDimUbicacion PRIMARY KEY,
        Sede VARCHAR(100) NOT NULL,
        Universidad VARCHAR(150) NOT NULL,
        TipoUniversidad VARCHAR(20) NULL,
        idUniversidad VARCHAR(100) NOT NULL,
        CONSTRAINT UQ_LeadsDimUbicacion UNIQUE (idUniversidad, Sede)
    );
END;
GO
IF OBJECT_ID(N'dbo.Dim_Investigacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Investigacion (
        KeyInvestigacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsDimInvestigacion PRIMARY KEY,
        PerfilInvestigacion VARCHAR(120) NOT NULL,
        Enfoque VARCHAR(40) NOT NULL,
        TipoTesis VARCHAR(60) NOT NULL,
        RangoAvance VARCHAR(20) NOT NULL,
        EmpresaAplicacion VARCHAR(20) NOT NULL,
        CONSTRAINT UQ_LeadsDimInvestigacion UNIQUE (TipoTesis, RangoAvance, EmpresaAplicacion)
    );
END;
GO
IF OBJECT_ID(N'dbo.Dim_Servicio', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Servicio (
        KeyServicio INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsDimServicio PRIMARY KEY,
        Familia VARCHAR(60) NULL,
        TipoServicio VARCHAR(40) NOT NULL,
        Paquete VARCHAR(100) NULL,
        Modalidad VARCHAR(50) NULL,
        Servicio VARCHAR(120) NOT NULL,
        idServicio VARCHAR(100) NOT NULL CONSTRAINT UQ_LeadsDimServicio UNIQUE
    );
END;
GO
IF OBJECT_ID(N'dbo.Dim_Asesor', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Asesor (
        KeyAsesor INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsDimAsesor PRIMARY KEY,
        Rol VARCHAR(20) NOT NULL,
        Equipo VARCHAR(80) NULL,
        Especialidad VARCHAR(120) NULL,
        Asesor VARCHAR(150) NOT NULL,
        idAsesor VARCHAR(100) NOT NULL CONSTRAINT UQ_LeadsDimAsesor UNIQUE
    );
END;
GO
IF OBJECT_ID(N'dbo.Dim_Canal_Captacion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Canal_Captacion (
        KeyCanalCaptacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsDimCanal PRIMARY KEY,
        TipoCanal VARCHAR(50) NULL,
        Plataforma VARCHAR(80) NULL,
        Canal VARCHAR(80) NOT NULL,
        Campania VARCHAR(150) NOT NULL,
        idCanal VARCHAR(100) NOT NULL,
        idCampania VARCHAR(100) NOT NULL,
        CONSTRAINT UQ_LeadsDimCanal UNIQUE (idCanal, idCampania)
    );
END;
GO
IF OBJECT_ID(N'dbo.Dim_Objecion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Dim_Objecion (
        KeyObjecion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsDimObjecion PRIMARY KEY,
        Grupo VARCHAR(40) NOT NULL,
        Tipo VARCHAR(60) NOT NULL,
        idObjecion VARCHAR(160) NOT NULL CONSTRAINT UQ_LeadsDimObjecion UNIQUE
    );
END;
GO

IF OBJECT_ID(N'dbo.Hecho_Diagnostico', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Hecho_Diagnostico (
        KeyTiempo INT NOT NULL,
        KeyEstudiante INT NOT NULL,
        KeyUbicacion INT NOT NULL,
        KeyInvestigacion INT NOT NULL,
        KeyAsesor INT NOT NULL,
        KeyCanalCaptacion INT NOT NULL,
        diagnostico_solicitud_madura INT NOT NULL,
        diagnostico_oportuno INT NOT NULL,
        CONSTRAINT PK_LeadsHechoDiagnostico PRIMARY KEY (KeyTiempo, KeyEstudiante, KeyUbicacion, KeyInvestigacion, KeyAsesor, KeyCanalCaptacion),
        CONSTRAINT FK_LeadsHDiagTiempo FOREIGN KEY (KeyTiempo) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        CONSTRAINT FK_LeadsHDiagEstudiante FOREIGN KEY (KeyEstudiante) REFERENCES dbo.Dim_Estudiante(KeyEstudiante),
        CONSTRAINT FK_LeadsHDiagUbicacion FOREIGN KEY (KeyUbicacion) REFERENCES dbo.Dim_Ubicacion(KeyUbicacion),
        CONSTRAINT FK_LeadsHDiagInvestigacion FOREIGN KEY (KeyInvestigacion) REFERENCES dbo.Dim_Investigacion(KeyInvestigacion),
        CONSTRAINT FK_LeadsHDiagAsesor FOREIGN KEY (KeyAsesor) REFERENCES dbo.Dim_Asesor(KeyAsesor),
        CONSTRAINT FK_LeadsHDiagCanal FOREIGN KEY (KeyCanalCaptacion) REFERENCES dbo.Dim_Canal_Captacion(KeyCanalCaptacion),
        CONSTRAINT CK_LeadsHDiagM CHECK (diagnostico_oportuno <= diagnostico_solicitud_madura)
    );
END;
GO
IF OBJECT_ID(N'dbo.Hecho_Oportunidad', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Hecho_Oportunidad (
        KeyTiempoInicio INT NOT NULL,
        KeyTiempoApta INT NOT NULL,
        KeyTiempoPropuesta INT NOT NULL,
        KeyEstudiante INT NOT NULL,
        KeyUbicacion INT NOT NULL,
        KeyInvestigacion INT NOT NULL,
        KeyServicio INT NOT NULL,
        KeyAsesor INT NOT NULL,
        KeyCanalCaptacion INT NOT NULL,
        oportunidad_apta_madura INT NOT NULL,
        cotizacion_oportuna INT NOT NULL,
        cotizacion_madura INT NOT NULL,
        aceptacion_30d INT NOT NULL,
        cohorte_madura INT NOT NULL,
        conversion_60d INT NOT NULL,
        CONSTRAINT PK_LeadsHechoOportunidad PRIMARY KEY (KeyTiempoInicio, KeyTiempoApta, KeyTiempoPropuesta, KeyEstudiante, KeyUbicacion, KeyInvestigacion, KeyServicio, KeyAsesor, KeyCanalCaptacion),
        CONSTRAINT FK_LeadsHOppTiempoInicio FOREIGN KEY (KeyTiempoInicio) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        CONSTRAINT FK_LeadsHOppTiempoApta FOREIGN KEY (KeyTiempoApta) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        CONSTRAINT FK_LeadsHOppTiempoPropuesta FOREIGN KEY (KeyTiempoPropuesta) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        CONSTRAINT FK_LeadsHOppEstudiante FOREIGN KEY (KeyEstudiante) REFERENCES dbo.Dim_Estudiante(KeyEstudiante),
        CONSTRAINT FK_LeadsHOppUbicacion FOREIGN KEY (KeyUbicacion) REFERENCES dbo.Dim_Ubicacion(KeyUbicacion),
        CONSTRAINT FK_LeadsHOppInvestigacion FOREIGN KEY (KeyInvestigacion) REFERENCES dbo.Dim_Investigacion(KeyInvestigacion),
        CONSTRAINT FK_LeadsHOppServicio FOREIGN KEY (KeyServicio) REFERENCES dbo.Dim_Servicio(KeyServicio),
        CONSTRAINT FK_LeadsHOppAsesor FOREIGN KEY (KeyAsesor) REFERENCES dbo.Dim_Asesor(KeyAsesor),
        CONSTRAINT FK_LeadsHOppCanal FOREIGN KEY (KeyCanalCaptacion) REFERENCES dbo.Dim_Canal_Captacion(KeyCanalCaptacion),
        CONSTRAINT CK_LeadsHOppM CHECK (cotizacion_oportuna <= oportunidad_apta_madura AND aceptacion_30d <= cotizacion_madura AND conversion_60d <= cohorte_madura)
    );
END;
GO
IF OBJECT_ID(N'dbo.Hecho_Recuperacion_Objecion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Hecho_Recuperacion_Objecion (
        KeyTiempo INT NOT NULL,
        KeyEstudiante INT NOT NULL,
        KeyUbicacion INT NOT NULL,
        KeyInvestigacion INT NOT NULL,
        KeyServicio INT NOT NULL,
        KeyAsesor INT NOT NULL,
        KeyCanalCaptacion INT NOT NULL,
        KeyObjecion INT NOT NULL,
        objecion_principal_madura INT NOT NULL,
        objecion_recuperada_30d INT NOT NULL,
        CONSTRAINT PK_LeadsHechoObjecion PRIMARY KEY (KeyTiempo, KeyEstudiante, KeyUbicacion, KeyInvestigacion, KeyServicio, KeyAsesor, KeyCanalCaptacion, KeyObjecion),
        CONSTRAINT FK_LeadsHObjTiempo FOREIGN KEY (KeyTiempo) REFERENCES dbo.Dim_Tiempo(KeyTiempo),
        CONSTRAINT FK_LeadsHObjEstudiante FOREIGN KEY (KeyEstudiante) REFERENCES dbo.Dim_Estudiante(KeyEstudiante),
        CONSTRAINT FK_LeadsHObjUbicacion FOREIGN KEY (KeyUbicacion) REFERENCES dbo.Dim_Ubicacion(KeyUbicacion),
        CONSTRAINT FK_LeadsHObjInvestigacion FOREIGN KEY (KeyInvestigacion) REFERENCES dbo.Dim_Investigacion(KeyInvestigacion),
        CONSTRAINT FK_LeadsHObjServicio FOREIGN KEY (KeyServicio) REFERENCES dbo.Dim_Servicio(KeyServicio),
        CONSTRAINT FK_LeadsHObjAsesor FOREIGN KEY (KeyAsesor) REFERENCES dbo.Dim_Asesor(KeyAsesor),
        CONSTRAINT FK_LeadsHObjCanal FOREIGN KEY (KeyCanalCaptacion) REFERENCES dbo.Dim_Canal_Captacion(KeyCanalCaptacion),
        CONSTRAINT FK_LeadsHObjObjecion FOREIGN KEY (KeyObjecion) REFERENCES dbo.Dim_Objecion(KeyObjecion),
        CONSTRAINT CK_LeadsHObjM CHECK (objecion_recuperada_30d <= objecion_principal_madura)
    );
END;
GO

IF OBJECT_ID(N'dbo.Leads_Etl_Ejecucion', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Leads_Etl_Ejecucion (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LeadsEtlEjecucion PRIMARY KEY,
        fecha_inicio DATETIME2(3) NOT NULL,
        fecha_fin DATETIME2(3) NULL,
        fecha_corte DATE NOT NULL,
        estado VARCHAR(20) NOT NULL,
        filas_diagnostico INT NULL,
        filas_oportunidad INT NULL,
        filas_objecion INT NULL,
        error_mensaje NVARCHAR(4000) NULL
    );
END;
GO
