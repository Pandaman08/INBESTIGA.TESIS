-- =============================================================================
-- INBESTIGA.TESIS - Transaccional: FASE 1 — BUYERS (Captación y Marketing)
-- Conforme a la Figura 1 (Modelo E-R de la Fase BUYERS, pág. 11 del Informe)
-- Tablas: CANAL, CAMPAÑA, CONTENIDO, BUYER, FORMULARIO, INTERACCION
-- =============================================================================

USE inbestiga_db;
GO

-- 1. CANAL (Canales de tráfico: TikTok, Meta Ads, Orgánico, Convenios)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CANAL')
BEGIN
    CREATE TABLE dbo.CANAL (
        id NVARCHAR(50) PRIMARY KEY,
        nombre NVARCHAR(100) NOT NULL,
        codigo NVARCHAR(50) NOT NULL UNIQUE, -- TIKTOK, META_ADS, ORGANICO, GOOGLE, REFERIDO, CONVENIO
        tipo NVARCHAR(50) NOT NULL,
        descripcion NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla CANAL creada exitosamente.';
END
GO

-- 2. CAMPAÑA (Campañas publicitarias con presupuesto asignado para cálculo de CPL)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CAMPAÑA')
BEGIN
    CREATE TABLE dbo.CAMPAÑA (
        id NVARCHAR(50) PRIMARY KEY,
        canalId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CANAL(id),
        nombre NVARCHAR(150) NOT NULL,
        presupuesto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        fechaInicio DATETIME2 NOT NULL,
        fechaFin DATETIME2 NULL,
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla CAMPAÑA creada exitosamente.';
END
GO

-- 3. CONTENIDO (Piezas educativas y Lead Magnets: Guías APA, Esquema Cap I)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CONTENIDO')
BEGIN
    CREATE TABLE dbo.CONTENIDO (
        id NVARCHAR(50) PRIMARY KEY,
        campanaId NVARCHAR(50) NOT NULL FOREIGN KEY REFERENCES dbo.CAMPAÑA(id),
        titulo NVARCHAR(200) NOT NULL,
        tipo NVARCHAR(50) NOT NULL, -- VIDEO_REEL, POST, LANDING, GUIA_PDF
        url NVARCHAR(500) NULL,
        leadMagnet BIT NOT NULL DEFAULT 0,
        activo BIT NOT NULL DEFAULT 1
    );
    PRINT '✓ Tabla CONTENIDO creada exitosamente.';
END
GO

-- 4. BUYER (Entidad central de captación: datos de contacto y perfil académico según Diagrama E-R)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BUYER')
BEGIN
    CREATE TABLE dbo.BUYER (
        id_buyer NVARCHAR(100) PRIMARY KEY,
        tipo_perfil NVARCHAR(50) NULL, -- ESTUDIANTE, EGRESADO, PADRE_FAMILIA, APODERADO
        nombre NVARCHAR(200) NOT NULL,
        whatsapp NVARCHAR(50) NOT NULL,
        correo NVARCHAR(150) NULL,
        departamento NVARCHAR(100) NULL,
        distrito NVARCHAR(100) NULL,
        tipo_universidad NVARCHAR(50) NULL, -- PUBLICA, PRIVADA
        sede NVARCHAR(100) NULL,
        universidad NVARCHAR(200) NULL,
        facultad NVARCHAR(200) NULL,
        carrera NVARCHAR(200) NULL,
        ciclo NVARCHAR(50) NULL, -- 8vo, 9no, 10mo, EGRESADO, BACHILLER
        edad INT NULL,
        financia_a_id_buyer NVARCHAR(100) NULL, -- Auto-relación: un buyer padre/familiar financia a un buyer estudiante
        lead_score INT NOT NULL DEFAULT 0,
        canal_captacion NVARCHAR(100) NULL,
        fecha_registro DATETIME2 NOT NULL DEFAULT GETDATE(),

        -- Campos complementarios para compatibilidad con el funnel completo
        nombres NVARCHAR(100) NULL,
        apellidos NVARCHAR(100) NULL,
        email NVARCHAR(150) NULL,
        universidadId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.UNIVERSIDAD(id),
        carreraId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.CARRERA(id),
        ubicacionId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.UBICACION(id),
        canalId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.CANAL(id),
        campanaId NVARCHAR(50) NULL FOREIGN KEY REFERENCES dbo.CAMPAÑA(id),
        tipoInvestigacion NVARCHAR(50) NULL,
        situacionLaboral NVARCHAR(50) NULL,
        presupuestoAprox DECIMAL(10,2) NULL,
        dolorPrincipal NVARCHAR(200) NULL,
        softwareRequerido NVARCHAR(50) NULL,
        plazoDefinidoDias INT NULL,
        estadoFunnel NVARCHAR(50) NOT NULL DEFAULT 'BUYER',
        consentimientoWhatsapp BIT NOT NULL DEFAULT 1,
        fechaConversionLead DATETIME2 NULL,

        CONSTRAINT FK_BUYER_FinanciaA FOREIGN KEY (financia_a_id_buyer) REFERENCES dbo.BUYER(id_buyer)
    );
    PRINT '✓ Tabla BUYER creada exitosamente según Diagrama E-R.';
END
GO

-- 4.1 CATALOGO_SERVICIOS (Catálogo de paquetes y recargos según Diagrama E-R)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CATALOGO_SERVICIOS')
BEGIN
    CREATE TABLE dbo.CATALOGO_SERVICIOS (
        servicioId NVARCHAR(100) PRIMARY KEY,
        nombre_paquete NVARCHAR(200) NOT NULL,
        incluye NVARCHAR(MAX) NOT NULL,
        dirigido_a NVARCHAR(200) NOT NULL,
        precio_base DECIMAL(10,2) NOT NULL,
        recargo_urgencia_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00
    );
    PRINT '✓ Tabla CATALOGO_SERVICIOS creada exitosamente.';
END
GO

-- 4.2 DESCARGA_CONTENIDO (Descargas de recursos asociados a paquetes según Diagrama E-R)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DESCARGA_CONTENIDO')
BEGIN
    CREATE TABLE dbo.DESCARGA_CONTENIDO (
        id_descarga NVARCHAR(100) PRIMARY KEY,
        id_buyer NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES dbo.BUYER(id_buyer) ON DELETE CASCADE,
        servicioId_asociado NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES dbo.CATALOGO_SERVICIOS(servicioId) ON DELETE CASCADE,
        fecha_descarga DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla DESCARGA_CONTENIDO creada exitosamente.';
END
GO

-- 4.3 INTERACCION_RED_SOCIAL (Comportamiento y red social según Diagrama E-R)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INTERACCION_RED_SOCIAL')
BEGIN
    CREATE TABLE dbo.INTERACCION_RED_SOCIAL (
        id_interaccion NVARCHAR(100) PRIMARY KEY,
        id_buyer NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES dbo.BUYER(id_buyer) ON DELETE CASCADE,
        red_social NVARCHAR(100) NOT NULL,
        tipo_interaccion NVARCHAR(100) NOT NULL,
        tema_detectado NVARCHAR(200) NULL,
        fecha DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla INTERACCION_RED_SOCIAL creada exitosamente.';
END
GO

-- 5. FORMULARIO (Auditoría de envío de datos JSON, IP y User-Agent)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FORMULARIO')
BEGIN
    CREATE TABLE dbo.FORMULARIO (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES dbo.BUYER(id_buyer) ON DELETE CASCADE,
        datosJson NVARCHAR(MAX) NOT NULL,
        ip NVARCHAR(50) NULL,
        userAgent NVARCHAR(500) NULL,
        fechaEnvio DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla FORMULARIO creada exitosamente.';
END
GO

-- 6. INTERACCION (Rastro de comportamiento general del funnel)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'INTERACCION')
BEGIN
    CREATE TABLE dbo.INTERACCION (
        id NVARCHAR(50) PRIMARY KEY,
        buyerId NVARCHAR(100) NOT NULL FOREIGN KEY REFERENCES dbo.BUYER(id_buyer) ON DELETE CASCADE,
        tipo NVARCHAR(50) NOT NULL,
        detalle NVARCHAR(MAX) NULL,
        fechaHora DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    PRINT '✓ Tabla INTERACCION creada exitosamente.';
END
GO
