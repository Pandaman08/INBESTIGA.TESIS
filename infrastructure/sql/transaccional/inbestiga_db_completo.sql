-- =============================================================================
-- PROYECTO: INBESTIGA.TESIS — UNIVERSIDAD NACIONAL DE TRUJILLO (2026-II)
-- CURSO: Inteligencia de Negocios | Docente: Dr. Mendoza Rivera Ricardo Dario
-- SCRIPT MAESTRO INTEGRAL: BASE DE DATOS TRANSACCIONAL (OLTP)
-- Motor: Microsoft SQL Server 2019 / 2022
-- Base de Datos: inbestiga_db
-- Descripción: Script autocontenido con DDL completo (Tablas, Llaves Foráneas,
--              Restricciones CHECK, Valores por Defecto, Índices) y Datos Semilla
-- =============================================================================

USE master;
GO

-- 1. CREACIÓN DE LA BASE DE DATOS
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'inbestiga_db')
BEGIN
    CREATE DATABASE inbestiga_db COLLATE Modern_Spanish_CI_AS;
    PRINT '✓ Base de datos inbestiga_db creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'i La base de datos inbestiga_db ya existe.';
END
GO

USE inbestiga_db;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '=============================================================================';
PRINT 'INICIANDO DESPLIEGUE DEL MODELO TRANSACCIONAL (OLTP) - inbestiga_db';
PRINT '=============================================================================';
GO

-- =============================================================================
-- SECCIÓN 0: SEGURIDAD, USUARIOS Y CONFIGURACIÓN DEL AGENTE IA
-- =============================================================================

-- 0.1. USUARIO (Gestión de acceso: Administradores, Asesores y Supervisores)
IF OBJECT_ID('dbo.USUARIO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.USUARIO (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_USUARIO PRIMARY KEY,
        username NVARCHAR(100) NOT NULL CONSTRAINT UQ_USUARIO_username UNIQUE,
        email NVARCHAR(150) NOT NULL CONSTRAINT UQ_USUARIO_email UNIQUE,
        passwordHash NVARCHAR(255) NOT NULL,
        rol NVARCHAR(50) NOT NULL CONSTRAINT DF_USUARIO_rol DEFAULT 'ADMIN', -- ADMIN, ASESOR, SUPERVISOR
        activo BIT NOT NULL CONSTRAINT DF_USUARIO_activo DEFAULT 1,
        fechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_USUARIO_fechaCreacion DEFAULT GETDATE()
    );
    PRINT '✓ Tabla USUARIO creada.';
END
GO

-- 0.2. CONFIGURACION_AGENTE (Parámetros del Agente Negociador y Asistente IA)
IF OBJECT_ID('dbo.CONFIGURACION_AGENTE', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CONFIGURACION_AGENTE (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_CONFIGURACION_AGENTE PRIMARY KEY,
        proveedorIA NVARCHAR(50) NOT NULL CONSTRAINT DF_CONF_proveedor DEFAULT 'GROQ', -- GEMINI, GROQ, OPENROUTER
        modelo NVARCHAR(100) NOT NULL CONSTRAINT DF_CONF_modelo DEFAULT 'llama-3.3-70b-versatile',
        promptSistema NVARCHAR(MAX) NOT NULL,
        tono NVARCHAR(100) NOT NULL CONSTRAINT DF_CONF_tono DEFAULT 'Profesional, empático, académico y resolutivo',
        estilo NVARCHAR(100) NOT NULL CONSTRAINT DF_CONF_estilo DEFAULT 'Consultor experto en investigación universitaria',
        permitirNegociacion BIT NOT NULL CONSTRAINT DF_CONF_permitirNeg DEFAULT 1,
        maxDescuentoNegociablePct DECIMAL(5,2) NOT NULL CONSTRAINT DF_CONF_maxDesc DEFAULT 15.00,
        maxCuotasNegociables INT NOT NULL CONSTRAINT DF_CONF_maxCuotas DEFAULT 3,
        reglasObjecionesJson NVARCHAR(MAX) NULL,
        horarioInicio NVARCHAR(10) NOT NULL CONSTRAINT DF_CONF_hInicio DEFAULT '08:00',
        horarioFin NVARCHAR(10) NOT NULL CONSTRAINT DF_CONF_hFin DEFAULT '22:00',
        activo BIT NOT NULL CONSTRAINT DF_CONF_activo DEFAULT 1
    );
    PRINT '✓ Tabla CONFIGURACION_AGENTE creada.';
END
GO

-- 0.3. NOTIFICACION (Alertas operativas de cobranza, scoring y derivación humana)
IF OBJECT_ID('dbo.NOTIFICACION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.NOTIFICACION (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_NOTIFICACION PRIMARY KEY,
        usuarioId NVARCHAR(50) NULL CONSTRAINT FK_NOTIFICACION_USUARIO FOREIGN KEY REFERENCES dbo.USUARIO(id) ON DELETE SET NULL,
        tipo NVARCHAR(50) NOT NULL, -- LEAD_CALIFICADO, NEGOCIACION_INICIADA, PAGO_CONFIRMADO, SESION_PROGRAMADA, ESCALACION_HUMANA
        titulo NVARCHAR(200) NOT NULL,
        mensaje NVARCHAR(MAX) NOT NULL,
        leido BIT NOT NULL CONSTRAINT DF_NOTIFICACION_leido DEFAULT 0,
        fechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_NOTIFICACION_fecha DEFAULT GETDATE(),
        metadata NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla NOTIFICACION creada.';
END
GO

-- =============================================================================
-- SECCIÓN 1: CATÁLOGOS ACADÉMICOS Y GEOGRÁFICOS TRANSVERSALES
-- =============================================================================

-- 1.1. UNIVERSIDAD (Catálogo de universidades del Perú)
IF OBJECT_ID('dbo.UNIVERSIDAD', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UNIVERSIDAD (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_UNIVERSIDAD PRIMARY KEY,
        nombre NVARCHAR(200) NOT NULL,
        siglas NVARCHAR(20) NOT NULL CONSTRAINT UQ_UNIVERSIDAD_siglas UNIQUE,
        ciudad NVARCHAR(100) NOT NULL,
        tipo NVARCHAR(20) NOT NULL CONSTRAINT CK_UNIVERSIDAD_tipo CHECK (tipo IN ('PUBLICA', 'PRIVADA')),
        activo BIT NOT NULL CONSTRAINT DF_UNIVERSIDAD_activo DEFAULT 1
    );
    PRINT '✓ Tabla UNIVERSIDAD creada.';
END
GO

-- 1.2. CARRERA (Especialidades profesionales organizadas por facultades y áreas)
IF OBJECT_ID('dbo.CARRERA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CARRERA (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_CARRERA PRIMARY KEY,
        universidadId NVARCHAR(50) NOT NULL CONSTRAINT FK_CARRERA_UNIVERSIDAD FOREIGN KEY REFERENCES dbo.UNIVERSIDAD(id),
        nombre NVARCHAR(150) NOT NULL,
        facultad NVARCHAR(150) NOT NULL,
        areaConocimiento NVARCHAR(50) NOT NULL, -- INGENIERIA, SOCIALES, NEGOCIOS, DERECHO, CIENCIAS_SALUD
        activo BIT NOT NULL CONSTRAINT DF_CARRERA_activo DEFAULT 1
    );
    PRINT '✓ Tabla CARRERA creada.';
END
GO

-- 1.3. UBICACION (Georreferenciación demográfica nacional)
IF OBJECT_ID('dbo.UBICACION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UBICACION (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_UBICACION PRIMARY KEY,
        departamento NVARCHAR(100) NOT NULL,
        provincia NVARCHAR(100) NOT NULL,
        distrito NVARCHAR(100) NOT NULL
    );
    PRINT '✓ Tabla UBICACION creada.';
END
GO

-- =============================================================================
-- SECCIÓN 2: FASE 1 — BUYERS (CAPTACIÓN Y MARKETING)
-- (Conforme a la Figura 1: Modelo E-R de la Fase BUYERS, pág. 11 del Informe)
-- =============================================================================

-- 2.1. CANAL (Canales de tráfico de marketing)
IF OBJECT_ID('dbo.CANAL', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CANAL (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_CANAL PRIMARY KEY,
        nombre NVARCHAR(100) NOT NULL,
        codigo NVARCHAR(50) NOT NULL CONSTRAINT UQ_CANAL_codigo UNIQUE, -- META_ADS, TIKTOK, GOOGLE, ORGANICO, REFERIDO
        tipo NVARCHAR(50) NOT NULL, -- PAGADO, ORGANICO, REFERIDO
        descripcion NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla CANAL creada.';
END
GO

-- 2.2. CAMPAÑA (Campañas con presupuesto para cálculo del Costo por Lead - CPL)
IF OBJECT_ID('dbo.CAMPAÑA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CAMPAÑA (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_CAMPANA PRIMARY KEY,
        canalId NVARCHAR(50) NOT NULL CONSTRAINT FK_CAMPANA_CANAL FOREIGN KEY REFERENCES dbo.CANAL(id),
        nombre NVARCHAR(150) NOT NULL,
        presupuesto DECIMAL(10,2) NOT NULL CONSTRAINT DF_CAMPANA_presupuesto DEFAULT 0.00,
        fechaInicio DATETIME2 NOT NULL,
        fechaFin DATETIME2 NULL,
        activo BIT NOT NULL CONSTRAINT DF_CAMPANA_activo DEFAULT 1
    );
    PRINT '✓ Tabla CAMPAÑA creada.';
END
GO

-- 2.3. CONTENIDO (Piezas de contenido y Lead Magnets descargables)
IF OBJECT_ID('dbo.CONTENIDO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CONTENIDO (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_CONTENIDO PRIMARY KEY,
        campanaId NVARCHAR(50) NOT NULL CONSTRAINT FK_CONTENIDO_CAMPANA FOREIGN KEY REFERENCES dbo.CAMPAÑA(id),
        titulo NVARCHAR(200) NOT NULL,
        tipo NVARCHAR(50) NOT NULL, -- VIDEO, POST, LANDING, GUIA_PDF, PLANTILLA
        url NVARCHAR(500) NULL,
        leadMagnet BIT NOT NULL CONSTRAINT DF_CONTENIDO_leadMagnet DEFAULT 0,
        activo BIT NOT NULL CONSTRAINT DF_CONTENIDO_activo DEFAULT 1
    );
    PRINT '✓ Tabla CONTENIDO creada.';
END
GO

-- 2.4. BUYER (Entidad central de captación: Estudiante postulante)
IF OBJECT_ID('dbo.BUYER', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BUYER (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_BUYER PRIMARY KEY,
        nombres NVARCHAR(100) NOT NULL,
        apellidos NVARCHAR(100) NOT NULL,
        whatsapp NVARCHAR(50) NOT NULL,
        email NVARCHAR(150) NOT NULL,
        universidadId NVARCHAR(50) NULL CONSTRAINT FK_BUYER_UNIVERSIDAD FOREIGN KEY REFERENCES dbo.UNIVERSIDAD(id),
        carreraId NVARCHAR(50) NULL CONSTRAINT FK_BUYER_CARRERA FOREIGN KEY REFERENCES dbo.CARRERA(id),
        ubicacionId NVARCHAR(50) NULL CONSTRAINT FK_BUYER_UBICACION FOREIGN KEY REFERENCES dbo.UBICACION(id),
        canalId NVARCHAR(50) NULL CONSTRAINT FK_BUYER_CANAL FOREIGN KEY REFERENCES dbo.CANAL(id),
        campanaId NVARCHAR(50) NULL CONSTRAINT FK_BUYER_CAMPANA FOREIGN KEY REFERENCES dbo.CAMPAÑA(id),
        ciclo NVARCHAR(50) NULL, -- 8vo, 9no, 10mo, EGRESADO, BACHILLER, MAESTRIA
        tipoInvestigacion NVARCHAR(50) NULL, -- TESIS, PLAN_DE_TESIS, ARTICULO_CIENTIFICO, TESINA
        situacionLaboral NVARCHAR(50) NULL, -- TRABAJA_TIEMPO_COMPLETO, MEDIO_TIEMPO, SOLO_ESTUDIA
        presupuestoAprox DECIMAL(10,2) NULL,
        dolorPrincipal NVARCHAR(100) NULL, -- METODOLOGIA, ESTADISTICA, ASESOR_NO_RESPONDE, FALTA_TIEMPO
        softwareRequerido NVARCHAR(50) NULL, -- SPSS, R, PYTHON, ATLAS_TI, STATA
        plazoDefinidoDias INT NULL,
        leadScore INT NOT NULL CONSTRAINT DF_BUYER_leadScore DEFAULT 0,
        estadoFunnel NVARCHAR(50) NOT NULL CONSTRAINT DF_BUYER_estadoFunnel DEFAULT 'BUYER', -- BUYER, LEAD, PAYER, CUSTOMER
        consentimientoWhatsapp BIT NOT NULL CONSTRAINT DF_BUYER_consentimiento DEFAULT 1,
        fechaRegistro DATETIME2 NOT NULL CONSTRAINT DF_BUYER_fechaRegistro DEFAULT GETDATE(),
        fechaConversionLead DATETIME2 NULL
    );
    PRINT '✓ Tabla BUYER creada.';
END
GO

-- 2.5. FORMULARIO (Auditoría de recepción técnica de postulaciones)
IF OBJECT_ID('dbo.FORMULARIO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.FORMULARIO (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_FORMULARIO PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL CONSTRAINT FK_FORMULARIO_BUYER FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        datosJson NVARCHAR(MAX) NOT NULL,
        ip NVARCHAR(50) NULL,
        userAgent NVARCHAR(500) NULL,
        fechaEnvio DATETIME2 NOT NULL CONSTRAINT DF_FORMULARIO_fechaEnvio DEFAULT GETDATE()
    );
    PRINT '✓ Tabla FORMULARIO creada.';
END
GO

-- 2.6. INTERACCION (Eventos de contacto, visitas e interacciones de WhatsApp)
IF OBJECT_ID('dbo.INTERACCION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.INTERACCION (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_INTERACCION PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL CONSTRAINT FK_INTERACCION_BUYER FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        tipo NVARCHAR(50) NOT NULL, -- VISITA, DESCARGA_LEAD_MAGNET, CLIC_ANUNCIO, ENVIO_FORMULARIO, MENSAJE_WHATSAPP
        detalle NVARCHAR(MAX) NULL,
        fechaHora DATETIME2 NOT NULL CONSTRAINT DF_INTERACCION_fechaHora DEFAULT GETDATE()
    );
    PRINT '✓ Tabla INTERACCION creada.';
END
GO

-- =============================================================================
-- SECCIÓN 3: FASE 2 — LEADS (CONVERSIÓN Y NEGOCIACIÓN CON IA)
-- (Conforme a la Figura 3: Modelo E-R de la Fase LEADS, pág. 18 del Informe)
-- =============================================================================

-- 3.1. LEAD (Estudiante calificado con Lead Score >= 70 puntos)
IF OBJECT_ID('dbo.LEAD', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LEAD (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_LEAD PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL CONSTRAINT UQ_LEAD_buyerId UNIQUE CONSTRAINT FK_LEAD_BUYER FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        scoreCalificado INT NOT NULL,
        prioridad NVARCHAR(20) NOT NULL CONSTRAINT DF_LEAD_prioridad DEFAULT 'MEDIA', -- ALTA, MEDIA, BAJA
        fechaCalificacion DATETIME2 NOT NULL CONSTRAINT DF_LEAD_fechaCalificacion DEFAULT GETDATE(),
        umbralSuperado BIT NOT NULL CONSTRAINT DF_LEAD_umbralSuperado DEFAULT 1,
        criterioCalificacion NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla LEAD creada.';
END
GO

-- 3.2. PERFIL_NEGOCIACION (Pantalla del Perfil de Negociación - Sección 4.2 del Informe)
IF OBJECT_ID('dbo.PERFIL_NEGOCIACION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PERFIL_NEGOCIACION (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_PERFIL_NEGOCIACION PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL CONSTRAINT UQ_PERFIL_buyerId UNIQUE CONSTRAINT FK_PERFIL_BUYER FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        presupuestoEstimado DECIMAL(10,2) NULL,
        urgenciaNivel NVARCHAR(50) NULL, -- ALTA, MEDIA, BAJA
        objecionPredominante NVARCHAR(50) NULL, -- PRECIO, TIEMPO, CONFIANZA
        scoreSensibilidadPrecio INT NULL CONSTRAINT DF_PERFIL_sensibilidad DEFAULT 50, -- 0-100
        notas NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla PERFIL_NEGOCIACION creada.';
END
GO

-- 3.3. SERVICIO (Catálogo de asesorías académicas especializadas)
IF OBJECT_ID('dbo.SERVICIO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SERVICIO (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_SERVICIO PRIMARY KEY,
        nombre NVARCHAR(150) NOT NULL,
        codigo NVARCHAR(50) NOT NULL CONSTRAINT UQ_SERVICIO_codigo UNIQUE, -- TESIS_INTEGRAL, PLAN_TESIS, ANALISIS_ESTADISTICO, ARTICULO
        descripcion NVARCHAR(MAX) NOT NULL,
        tipoInvestigacion NVARCHAR(50) NOT NULL, -- TESIS, PLAN_DE_TESIS, ARTICULO_CIENTIFICO
        precioBase DECIMAL(10,2) NOT NULL,
        precioMinimo DECIMAL(10,2) NOT NULL,
        precioMaximo DECIMAL(10,2) NOT NULL,
        plazoSemanasMin INT NOT NULL CONSTRAINT DF_SERVICIO_plazoMin DEFAULT 4,
        plazoSemanasMax INT NOT NULL CONSTRAINT DF_SERVICIO_plazoMax DEFAULT 16,
        maxCuotas INT NOT NULL CONSTRAINT DF_SERVICIO_maxCuotas DEFAULT 4,
        activo BIT NOT NULL CONSTRAINT DF_SERVICIO_activo DEFAULT 1
    );
    PRINT '✓ Tabla SERVICIO creada.';
END
GO

-- 3.4. REGLA_COMERCIAL (Matriz de límites de descuento y cuotas autorizadas)
IF OBJECT_ID('dbo.REGLA_COMERCIAL', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.REGLA_COMERCIAL (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_REGLA_COMERCIAL PRIMARY KEY,
        servicioId NVARCHAR(50) NOT NULL CONSTRAINT FK_REGLA_SERVICIO FOREIGN KEY REFERENCES dbo.SERVICIO(id) ON DELETE CASCADE,
        tipoInvestigacion NVARCHAR(50) NULL,
        descuentoMaximoPct DECIMAL(5,2) NOT NULL CONSTRAINT DF_REGLA_descMax DEFAULT 15.00,
        descuentoPagoUnicoPct DECIMAL(5,2) NOT NULL CONSTRAINT DF_REGLA_descPagoUnico DEFAULT 10.00,
        cuotaMinima DECIMAL(10,2) NOT NULL CONSTRAINT DF_REGLA_cuotaMin DEFAULT 200.00,
        plazoMinimoDias INT NOT NULL CONSTRAINT DF_REGLA_plazoMin DEFAULT 15,
        plazoMaximoDias INT NOT NULL CONSTRAINT DF_REGLA_plazoMax DEFAULT 120,
        condicionesEspeciales NVARCHAR(MAX) NULL,
        activo BIT NOT NULL CONSTRAINT DF_REGLA_activo DEFAULT 1
    );
    PRINT '✓ Tabla REGLA_COMERCIAL creada.';
END
GO

-- 3.5. CONVERSACION (Sesión de negociación en WhatsApp gestionada por el Agente IA)
IF OBJECT_ID('dbo.CONVERSACION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CONVERSACION (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_CONVERSACION PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL CONSTRAINT FK_CONVERSACION_BUYER FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL CONSTRAINT FK_CONVERSACION_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        canal NVARCHAR(50) NOT NULL CONSTRAINT DF_CONVERSACION_canal DEFAULT 'WHATSAPP',
        estadoEtapa NVARCHAR(50) NOT NULL CONSTRAINT DF_CONVERSACION_etapa DEFAULT 'DISCOVERY', -- DISCOVERY, DIAGNOSTIC, PROPOSAL, OBJECTION_HANDLING, NEGOTIATION, CLOSING, PAYMENT, PAYMENT_PENDING, CONVERTED, HUMAN_ESCALATION, ABANDONED
        fechaInicio DATETIME2 NOT NULL CONSTRAINT DF_CONVERSACION_inicio DEFAULT GETDATE(),
        fechaUltimaActividad DATETIME2 NOT NULL CONSTRAINT DF_CONVERSACION_actividad DEFAULT GETDATE()
    );
    PRINT '✓ Tabla CONVERSACION creada.';
END
GO

-- 3.6. MENSAJE (Trazabilidad atómica de mensajes: Cliente vs Agente IA vs Asesor Humano)
IF OBJECT_ID('dbo.MENSAJE', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MENSAJE (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_MENSAJE PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL CONSTRAINT FK_MENSAJE_CONVERSACION FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        direccion NVARCHAR(20) NOT NULL CONSTRAINT CK_MENSAJE_direccion CHECK (direccion IN ('INCOMING', 'OUTGOING')),
        remitente NVARCHAR(50) NOT NULL CONSTRAINT CK_MENSAJE_remitente CHECK (remitente IN ('CLIENTE', 'AGENTE_IA', 'ASESOR_HUMANO')),
        contenido NVARCHAR(MAX) NOT NULL,
        tipoMensaje NVARCHAR(50) NOT NULL CONSTRAINT DF_MENSAJE_tipo DEFAULT 'TEXT', -- TEXT, PAYMENT_LINK, QUOTE, DOCUMENT
        fechaHora DATETIME2 NOT NULL CONSTRAINT DF_MENSAJE_fechaHora DEFAULT GETDATE(),
        estadoEntrega NVARCHAR(50) NOT NULL CONSTRAINT DF_MENSAJE_entrega DEFAULT 'SENT', -- SENT, DELIVERED, READ, FAILED
        respuestaA NVARCHAR(50) NULL,
        metadata NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla MENSAJE creada.';
END
GO

-- 3.7. DIAGNOSTICO (Ficha de diagnóstico metodológico estructurada por el Agente)
IF OBJECT_ID('dbo.DIAGNOSTICO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DIAGNOSTICO (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_DIAGNOSTICO PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL CONSTRAINT FK_DIAGNOSTICO_CONV FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL CONSTRAINT FK_DIAGNOSTICO_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        temaInvestigacion NVARCHAR(255) NULL,
        avanceActualPct INT NOT NULL CONSTRAINT DF_DIAGNOSTICO_avance DEFAULT 0,
        principalesDificultades NVARCHAR(MAX) NULL,
        resumenIA NVARCHAR(MAX) NULL,
        fechaDiagnostico DATETIME2 NOT NULL CONSTRAINT DF_DIAGNOSTICO_fecha DEFAULT GETDATE()
    );
    PRINT '✓ Tabla DIAGNOSTICO creada.';
END
GO

-- 3.8. PROPUESTA (Ofertas comerciales emitidas con plazos y descuentos)
IF OBJECT_ID('dbo.PROPUESTA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PROPUESTA (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_PROPUESTA PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL CONSTRAINT FK_PROPUESTA_CONV FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL CONSTRAINT FK_PROPUESTA_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        servicioId NVARCHAR(50) NOT NULL CONSTRAINT FK_PROPUESTA_SERVICIO FOREIGN KEY REFERENCES dbo.SERVICIO(id),
        precioOriginal DECIMAL(10,2) NOT NULL,
        precioPropuesto DECIMAL(10,2) NOT NULL,
        descuentoAplicadoPct DECIMAL(5,2) NOT NULL CONSTRAINT DF_PROPUESTA_desc DEFAULT 0.00,
        numeroCuotas INT NOT NULL CONSTRAINT DF_PROPUESTA_cuotas DEFAULT 1,
        montoPorCuota DECIMAL(10,2) NOT NULL,
        plazoDias INT NOT NULL CONSTRAINT DF_PROPUESTA_plazo DEFAULT 30,
        justificacion NVARCHAR(MAX) NULL,
        estado NVARCHAR(50) NOT NULL CONSTRAINT DF_PROPUESTA_estado DEFAULT 'BORRADOR', -- BORRADOR, ENVIADA, ACEPTADA, RECHAZADA
        fechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_PROPUESTA_fechaCreacion DEFAULT GETDATE()
    );
    PRINT '✓ Tabla PROPUESTA creada.';
END
GO

-- 3.9. OBJECION (Registro de dudas y contra-argumentación de la IA)
IF OBJECT_ID('dbo.OBJECION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OBJECION (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_OBJECION PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL CONSTRAINT FK_OBJECION_CONV FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL CONSTRAINT FK_OBJECION_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        tipo NVARCHAR(50) NOT NULL, -- PRECIO, TIEMPO, CONFIANZA, COMPARACION, METODO_PAGO, OTRO
        descripcion NVARCHAR(MAX) NOT NULL,
        respuestaAgente NVARCHAR(MAX) NULL,
        resuelta BIT NOT NULL CONSTRAINT DF_OBJECION_resuelta DEFAULT 0,
        fechaRegistro DATETIME2 NOT NULL CONSTRAINT DF_OBJECION_fecha DEFAULT GETDATE()
    );
    PRINT '✓ Tabla OBJECION creada.';
END
GO

-- 3.10. SEGUIMIENTO (Plan de llamadas y recordatorios comerciales)
IF OBJECT_ID('dbo.SEGUIMIENTO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SEGUIMIENTO (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_SEGUIMIENTO PRIMARY KEY,
        conversacionId NVARCHAR(50) NOT NULL CONSTRAINT FK_SEGUIMIENTO_CONV FOREIGN KEY REFERENCES dbo.CONVERSACION(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL CONSTRAINT FK_SEGUIMIENTO_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        tipo NVARCHAR(50) NOT NULL, -- RECORDATORIO, CONSULTA_DUDA, OFERTA_LIMITADA
        fechaProgramada DATETIME2 NOT NULL,
        fechaEjecutada DATETIME2 NULL,
        estado NVARCHAR(50) NOT NULL CONSTRAINT DF_SEGUIMIENTO_estado DEFAULT 'PENDIENTE', -- PENDIENTE, EJECUTADO, CANCELADO
        resultado NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla SEGUIMIENTO creada.';
END
GO

-- =============================================================================
-- SECCIÓN 4: FASE 3 — PAYERS (COBRANZA Y PASARELA CULQI)
-- (Conforme a la Sección 5 del Informe Académico, pág. 20-23)
-- =============================================================================

-- 4.1. COTIZACION (Orden previa al Checkout con código oficial: COT-2026-XXXX)
IF OBJECT_ID('dbo.COTIZACION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.COTIZACION (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_COTIZACION PRIMARY KEY,
        leadId NVARCHAR(50) NOT NULL CONSTRAINT FK_COTIZACION_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        propuestaId NVARCHAR(50) NULL CONSTRAINT FK_COTIZACION_PROPUESTA FOREIGN KEY REFERENCES dbo.PROPUESTA(id),
        servicioId NVARCHAR(50) NOT NULL CONSTRAINT FK_COTIZACION_SERVICIO FOREIGN KEY REFERENCES dbo.SERVICIO(id),
        codigoCotizacion NVARCHAR(50) NOT NULL CONSTRAINT UQ_COTIZACION_codigo UNIQUE,
        subtotal DECIMAL(10,2) NOT NULL,
        descuento DECIMAL(10,2) NOT NULL CONSTRAINT DF_COTIZACION_descuento DEFAULT 0.00,
        total DECIMAL(10,2) NOT NULL,
        cuotas INT NOT NULL CONSTRAINT DF_COTIZACION_cuotas DEFAULT 1,
        plazoEntregaDias INT NOT NULL CONSTRAINT DF_COTIZACION_plazo DEFAULT 30,
        fechaEmision DATETIME2 NOT NULL CONSTRAINT DF_COTIZACION_fechaEmision DEFAULT GETDATE(),
        fechaExpiracion DATETIME2 NOT NULL,
        estado NVARCHAR(50) NOT NULL CONSTRAINT DF_COTIZACION_estado DEFAULT 'ACTIVA' -- ACTIVA, ACEPTADA, CANCELADA, EXPIRADA
    );
    PRINT '✓ Tabla COTIZACION creada.';
END
GO

-- 4.2. PAGO (Transacciones bancarias procesadas vía Culqi Express o Stripe)
IF OBJECT_ID('dbo.PAGO', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PAGO (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_PAGO PRIMARY KEY,
        cotizacionId NVARCHAR(50) NOT NULL CONSTRAINT FK_PAGO_COTIZACION FOREIGN KEY REFERENCES dbo.COTIZACION(id),
        buyerId NVARCHAR(50) NOT NULL CONSTRAINT FK_PAGO_BUYER FOREIGN KEY REFERENCES dbo.BUYER(id),
        leadId NVARCHAR(50) NULL CONSTRAINT FK_PAGO_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        gatewayProveedor NVARCHAR(50) NOT NULL, -- CULQI, STRIPE, YAPE
        gatewayTransactionId NVARCHAR(150) NULL CONSTRAINT UQ_PAGO_gatewayId UNIQUE,
        monto DECIMAL(10,2) NOT NULL,
        moneda NVARCHAR(10) NOT NULL CONSTRAINT DF_PAGO_moneda DEFAULT 'PEN',
        metodoPago NVARCHAR(50) NOT NULL CONSTRAINT DF_PAGO_metodo DEFAULT 'CARD', -- CARD, YAPE, TRANSFER, PAGOEFECTIVO
        estado NVARCHAR(50) NOT NULL CONSTRAINT DF_PAGO_estado DEFAULT 'PENDIENTE', -- PENDIENTE, CONFIRMADO, FALLIDO, REEMBOLSADO
        fechaCreacion DATETIME2 NOT NULL CONSTRAINT DF_PAGO_fechaCreacion DEFAULT GETDATE(),
        fechaConfirmacion DATETIME2 NULL,
        gatewayPayload NVARCHAR(MAX) NULL,
        comprobanteUrl NVARCHAR(500) NULL
    );
    PRINT '✓ Tabla PAGO creada.';
END
GO

-- 4.3. PAYER (Estudiante con pago confirmado que adquiere estatus de cliente formal)
IF OBJECT_ID('dbo.PAYER', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PAYER (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_PAYER PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL CONSTRAINT UQ_PAYER_buyerId UNIQUE CONSTRAINT FK_PAYER_BUYER FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL CONSTRAINT UQ_PAYER_leadId UNIQUE CONSTRAINT FK_PAYER_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        primerPagoId NVARCHAR(50) NOT NULL CONSTRAINT FK_PAYER_PAGO FOREIGN KEY REFERENCES dbo.PAGO(id),
        montoTotalPagado DECIMAL(10,2) NOT NULL CONSTRAINT DF_PAYER_montoTotal DEFAULT 0.00,
        metodoPrincipal NVARCHAR(50) NOT NULL CONSTRAINT DF_PAYER_metodo DEFAULT 'CARD',
        fechaConversionPayer DATETIME2 NOT NULL CONSTRAINT DF_PAYER_fecha DEFAULT GETDATE(),
        estado NVARCHAR(50) NOT NULL CONSTRAINT DF_PAYER_estado DEFAULT 'ACTIVO' -- ACTIVO, CONCLUIDO, REEMBOLSADO
    );
    PRINT '✓ Tabla PAYER creada.';
END
GO

-- =============================================================================
-- SECCIÓN 5: FASE 4 — CUSTOMERS (ATENCIÓN, ASESORÍA Y BITÁCORA DE TESIS)
-- (Conforme a la Sección 6 del Informe Académico, pág. 24-28, Figuras 6 y Mockups)
-- =============================================================================

-- 5.1. ASESOR (Cuerpo docente y especialistas: Doctores y Magísteres)
IF OBJECT_ID('dbo.ASESOR', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ASESOR (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_ASESOR PRIMARY KEY,
        nombres NVARCHAR(100) NOT NULL,
        apellidos NVARCHAR(100) NOT NULL,
        especialidad NVARCHAR(200) NOT NULL,
        gradoAcademico NVARCHAR(50) NOT NULL, -- DOCTOR, MAGISTER, LICENCIADO
        email NVARCHAR(150) NOT NULL CONSTRAINT UQ_ASESOR_email UNIQUE,
        whatsapp NVARCHAR(50) NOT NULL,
        maxClientesSimultaneos INT NOT NULL CONSTRAINT DF_ASESOR_maxClientes DEFAULT 10,
        clientesActivos INT NOT NULL CONSTRAINT DF_ASESOR_clientesActivos DEFAULT 0,
        activo BIT NOT NULL CONSTRAINT DF_ASESOR_activo DEFAULT 1
    );
    PRINT '✓ Tabla ASESOR creada.';
END
GO

-- 5.2. CUSTOMER (Tesista activo con servicio de asesoría y expediente en marcha)
IF OBJECT_ID('dbo.CUSTOMER', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CUSTOMER (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_CUSTOMER PRIMARY KEY,
        buyerId NVARCHAR(50) NOT NULL CONSTRAINT UQ_CUSTOMER_buyerId UNIQUE CONSTRAINT FK_CUSTOMER_BUYER FOREIGN KEY REFERENCES dbo.BUYER(id) ON DELETE CASCADE,
        leadId NVARCHAR(50) NULL CONSTRAINT UQ_CUSTOMER_leadId UNIQUE CONSTRAINT FK_CUSTOMER_LEAD FOREIGN KEY REFERENCES dbo.LEAD(id),
        payerId NVARCHAR(50) NOT NULL CONSTRAINT UQ_CUSTOMER_payerId UNIQUE CONSTRAINT FK_CUSTOMER_PAYER FOREIGN KEY REFERENCES dbo.PAYER(id),
        cotizacionId NVARCHAR(50) NOT NULL CONSTRAINT FK_CUSTOMER_COTIZACION FOREIGN KEY REFERENCES dbo.COTIZACION(id),
        servicioId NVARCHAR(50) NOT NULL CONSTRAINT FK_CUSTOMER_SERVICIO FOREIGN KEY REFERENCES dbo.SERVICIO(id),
        asesorId NVARCHAR(50) NULL CONSTRAINT FK_CUSTOMER_ASESOR FOREIGN KEY REFERENCES dbo.ASESOR(id),
        fechaInicioServicio DATETIME2 NOT NULL CONSTRAINT DF_CUSTOMER_inicio DEFAULT GETDATE(),
        estadoServicio NVARCHAR(50) NOT NULL CONSTRAINT DF_CUSTOMER_estado DEFAULT 'ACTIVO', -- ACTIVO, EN_CURSO, FINALIZADO, PAUSADO
        observaciones NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla CUSTOMER creada.';
END
GO

-- 5.3. ASIGNACION_ASESOR (Historial de emparejamiento académico asesor-tesista)
IF OBJECT_ID('dbo.ASIGNACION_ASESOR', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ASIGNACION_ASESOR (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_ASIGNACION_ASESOR PRIMARY KEY,
        customerId NVARCHAR(50) NOT NULL CONSTRAINT FK_ASIGNACION_CUSTOMER FOREIGN KEY REFERENCES dbo.CUSTOMER(id) ON DELETE CASCADE,
        asesorId NVARCHAR(50) NOT NULL CONSTRAINT FK_ASIGNACION_ASESOR FOREIGN KEY REFERENCES dbo.ASESOR(id),
        fechaAsignacion DATETIME2 NOT NULL CONSTRAINT DF_ASIGNACION_fecha DEFAULT GETDATE(),
        motivo NVARCHAR(500) NULL,
        asignadoPor NVARCHAR(50) NOT NULL CONSTRAINT DF_ASIGNACION_asignadoPor DEFAULT 'SISTEMA', -- SISTEMA, COORDINADOR
        activo BIT NOT NULL CONSTRAINT DF_ASIGNACION_activo DEFAULT 1
    );
    PRINT '✓ Tabla ASIGNACION_ASESOR creada.';
END
GO

-- 5.4. SESION (Bitácora de asesorías, actas de avance y revisión de capítulos)
IF OBJECT_ID('dbo.SESION', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SESION (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_SESION PRIMARY KEY,
        customerId NVARCHAR(50) NOT NULL CONSTRAINT FK_SESION_CUSTOMER FOREIGN KEY REFERENCES dbo.CUSTOMER(id) ON DELETE CASCADE,
        asesorId NVARCHAR(50) NOT NULL CONSTRAINT FK_SESION_ASESOR FOREIGN KEY REFERENCES dbo.ASESOR(id),
        numeroSesion INT NOT NULL CONSTRAINT DF_SESION_numero DEFAULT 1,
        fechaHoraProgramada DATETIME2 NOT NULL,
        fechaHoraRealizada DATETIME2 NULL,
        temaTratado NVARCHAR(250) NOT NULL,
        estado NVARCHAR(50) NOT NULL CONSTRAINT DF_SESION_estado DEFAULT 'PROGRAMADA', -- PROGRAMADA, REALIZADA, REPROGRAMADA, CANCELADA
        enlaceReunion NVARCHAR(500) NULL,
        observaciones NVARCHAR(MAX) NULL
    );
    PRINT '✓ Tabla SESION creada.';
END
GO

-- 5.5. BITACORA_TESIS (Registro de entregables, observaciones y avance de capítulos)
IF OBJECT_ID('dbo.BITACORA_TESIS', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BITACORA_TESIS (
        id NVARCHAR(50) NOT NULL CONSTRAINT PK_BITACORA_TESIS PRIMARY KEY,
        customerId NVARCHAR(50) NOT NULL CONSTRAINT FK_BITACORA_CUSTOMER FOREIGN KEY REFERENCES dbo.CUSTOMER(id) ON DELETE CASCADE,
        numeroCapitulo INT NOT NULL,
        tituloCapitulo NVARCHAR(150) NOT NULL,
        porcentajeAvance DECIMAL(5,2) NOT NULL CONSTRAINT DF_BITACORA_avance DEFAULT 0.00,
        observacionesDocente NVARCHAR(MAX) NULL,
        fechaRevision DATETIME2 NOT NULL CONSTRAINT DF_BITACORA_fecha DEFAULT GETDATE(),
        aprobado BIT NOT NULL CONSTRAINT DF_BITACORA_aprobado DEFAULT 0
    );
    PRINT '✓ Tabla BITACORA_TESIS creada.';
END
GO

-- =============================================================================
-- SECCIÓN 6: ÍNDICES TRANSACCIONALES OPTIMIZADOS (OLTP)
-- =============================================================================

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BUYER_leadScore' AND object_id = OBJECT_ID('dbo.BUYER'))
    CREATE NONCLUSTERED INDEX IX_BUYER_leadScore ON dbo.BUYER(leadScore);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BUYER_fechaRegistro' AND object_id = OBJECT_ID('dbo.BUYER'))
    CREATE NONCLUSTERED INDEX IX_BUYER_fechaRegistro ON dbo.BUYER(fechaRegistro);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CONVERSACION_buyerId' AND object_id = OBJECT_ID('dbo.CONVERSACION'))
    CREATE NONCLUSTERED INDEX IX_CONVERSACION_buyerId ON dbo.CONVERSACION(buyerId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MENSAJE_conversacionId' AND object_id = OBJECT_ID('dbo.MENSAJE'))
    CREATE NONCLUSTERED INDEX IX_MENSAJE_conversacionId ON dbo.MENSAJE(conversacionId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MENSAJE_fechaHora' AND object_id = OBJECT_ID('dbo.MENSAJE'))
    CREATE NONCLUSTERED INDEX IX_MENSAJE_fechaHora ON dbo.MENSAJE(fechaHora);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PAGO_fechaConfirmacion' AND object_id = OBJECT_ID('dbo.PAGO'))
    CREATE NONCLUSTERED INDEX IX_PAGO_fechaConfirmacion ON dbo.PAGO(fechaConfirmacion);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CUSTOMER_fechaInicioServicio' AND object_id = OBJECT_ID('dbo.CUSTOMER'))
    CREATE NONCLUSTERED INDEX IX_CUSTOMER_fechaInicioServicio ON dbo.CUSTOMER(fechaInicioServicio);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SESION_customerId' AND object_id = OBJECT_ID('dbo.SESION'))
    CREATE NONCLUSTERED INDEX IX_SESION_customerId ON dbo.SESION(customerId);
GO

-- =============================================================================
-- SECCIÓN 7: DATOS SEMILLA TRANSVERSALES Y CATÁLOGOS BASE
-- =============================================================================

-- 7.1. Universidades Peruanas
IF NOT EXISTS (SELECT 1 FROM dbo.UNIVERSIDAD WHERE siglas = 'UNT')
BEGIN
    INSERT INTO dbo.UNIVERSIDAD (id, nombre, siglas, ciudad, tipo, activo) VALUES
    ('uni-001-unt', 'Universidad Nacional de Trujillo', 'UNT', 'Trujillo', 'PUBLICA', 1),
    ('uni-002-upao', 'Universidad Privada Antenor Orrego', 'UPAO', 'Trujillo', 'PRIVADA', 1),
    ('uni-003-ucv', 'Universidad César Vallejo', 'UCV', 'Trujillo', 'PRIVADA', 1),
    ('uni-004-upn', 'Universidad Privada del Norte', 'UPN', 'Trujillo', 'PRIVADA', 1),
    ('uni-005-unmsm', 'Universidad Nacional Mayor de San Marcos', 'UNMSM', 'Lima', 'PUBLICA', 1),
    ('uni-006-uni', 'Universidad Nacional de Ingeniería', 'UNI', 'Lima', 'PUBLICA', 1);
    PRINT '✓ Datos semilla insertados en UNIVERSIDAD.';
END
GO

-- 7.2. Ubicaciones
IF NOT EXISTS (SELECT 1 FROM dbo.UBICACION WHERE departamento = 'La Libertad' AND provincia = 'Trujillo')
BEGIN
    INSERT INTO dbo.UBICACION (id, departamento, provincia, distrito) VALUES
    ('ubi-001', 'La Libertad', 'Trujillo', 'Trujillo'),
    ('ubi-002', 'La Libertad', 'Trujillo', 'Víctor Larco Herrera'),
    ('ubi-003', 'La Libertad', 'Trujillo', 'Huanchaco'),
    ('ubi-004', 'Lima', 'Lima', 'San Isidro'),
    ('ubi-005', 'Lima', 'Lima', 'Los Olivos'),
    ('ubi-006', 'Lambayeque', 'Chiclayo', 'Chiclayo');
    PRINT '✓ Datos semilla insertados en UBICACION.';
END
GO

-- 7.3. Canales de Marketing
IF NOT EXISTS (SELECT 1 FROM dbo.CANAL WHERE codigo = 'META_ADS')
BEGIN
    INSERT INTO dbo.CANAL (id, nombre, codigo, tipo, descripcion) VALUES
    ('cnl-001', 'Meta Ads (Facebook / Instagram)', 'META_ADS', 'PAGADO', 'Campañas de anuncios pagados en Instagram y Facebook feeds/reels'),
    ('cnl-002', 'TikTok Ads', 'TIKTOK', 'PAGADO', 'Pauta de video corto orientada a estudiantes universitarios de últimos ciclos'),
    ('cnl-003', 'Google Search & Display', 'GOOGLE', 'PAGADO', 'Búsqueda intencional por palabras clave: asesoría de tesis, spss tesis'),
    ('cnl-004', 'Búsqueda Orgánica / Web', 'ORGANICO', 'ORGANICO', 'Tráfico inbound desde el blog científico y SEO de la plataforma'),
    ('cnl-005', 'Recomendación / Boca a Boca', 'REFERIDO', 'REFERIDO', 'Tesistas graduados que recomiendan el servicio a sus compañeros');
    PRINT '✓ Datos semilla insertados en CANAL.';
END
GO

-- 7.4. Catálogo de Servicios de Asesoría de Tesis
IF NOT EXISTS (SELECT 1 FROM dbo.SERVICIO WHERE codigo = 'TESIS_INTEGRAL')
BEGIN
    INSERT INTO dbo.SERVICIO (id, nombre, codigo, descripcion, tipoInvestigacion, precioBase, precioMinimo, precioMaximo, plazoSemanasMin, plazoSemanasMax, maxCuotas, activo) VALUES
    ('srv-001', 'Asesoría Integral de Tesis de Titulación', 'TESIS_INTEGRAL', 'Acompañamiento integral desde la formulación del problema hasta la sustentación ante jurado.', 'TESIS', 2500.00, 2000.00, 3500.00, 8, 16, 4, 1),
    ('srv-002', 'Desarrollo de Plan o Proyecto de Tesis', 'PLAN_TESIS', 'Elaboración del proyecto/plan de tesis conforme al reglamento específico de la universidad.', 'PLAN_DE_TESIS', 1200.00, 950.00, 1600.00, 4, 8, 2, 1),
    ('srv-003', 'Análisis Estadístico y Prueba de Hipótesis', 'ANALISIS_ESTADISTICO', 'Procesamiento de datos empíricos en SPSS/R Studio, análisis inferencial y redacción de resultados.', 'TESIS', 800.00, 650.00, 1200.00, 2, 4, 2, 1),
    ('srv-004', 'Redacción de Artículo Científico (Scopus / Scielo)', 'ARTICULO', 'Estructuración de artículo científico en formato IMRyD para publicación en revista indexada.', 'ARTICULO_CIENTIFICO', 1800.00, 1500.00, 2500.00, 6, 12, 3, 1);
    PRINT '✓ Datos semilla insertados en SERVICIO.';
END
GO

-- 7.5. Reglas Comerciales para los Servicios
IF NOT EXISTS (SELECT 1 FROM dbo.REGLA_COMERCIAL)
BEGIN
    INSERT INTO dbo.REGLA_COMERCIAL (id, servicioId, tipoInvestigacion, descuentoMaximoPct, descuentoPagoUnicoPct, cuotaMinima, plazoMinimoDias, plazoMaximoDias, activo) VALUES
    ('rgl-001', 'srv-001', 'TESIS', 15.00, 10.00, 500.00, 30, 120, 1),
    ('rgl-002', 'srv-002', 'PLAN_DE_TESIS', 12.00, 10.00, 400.00, 20, 60, 1),
    ('rgl-003', 'srv-003', 'TESIS', 10.00, 8.00, 300.00, 10, 30, 1),
    ('rgl-004', 'srv-004', 'ARTICULO_CIENTIFICO', 15.00, 10.00, 500.00, 30, 90, 1);
    PRINT '✓ Datos semilla insertados en REGLA_COMERCIAL.';
END
GO

-- 7.6. Asesores Metodológicos (Cuerpo Docente)
IF NOT EXISTS (SELECT 1 FROM dbo.ASESOR)
BEGIN
    INSERT INTO dbo.ASESOR (id, nombres, apellidos, especialidad, gradoAcademico, email, whatsapp, maxClientesSimultaneos, clientesActivos, activo) VALUES
    ('asr-001', 'Ricardo Darío', 'Mendoza Rivera', 'Inteligencia de Negocios y Sistemas de Información', 'DOCTOR', 'rmendoza@unitru.edu.pe', '+51944123456', 10, 2, 1),
    ('asr-002', 'Carlos Alberto', 'García Benites', 'Metodología de Investigación Cuantitativa e Informática', 'DOCTOR', 'cgarcia@inbestiga.pe', '+51944654321', 10, 2, 1),
    ('asr-003', 'Elena Beatriz', 'Sánchez Palacios', 'Estadística Aplicada y Modelos Multivariados en SPSS', 'MAGISTER', 'esanchez@inbestiga.pe', '+51944789012', 8, 1, 1),
    ('asr-004', 'Martín Andrés', 'Vásquez Córdova', 'Gestión de Proyectos de Software y Minería de Datos', 'MAGISTER', 'mvasquez@inbestiga.pe', '+51944345678', 8, 1, 1);
    PRINT '✓ Datos semilla insertados en ASESOR.';
END
GO

-- 7.7. Usuario Administrador Inicial
-- Retirado: este script creaba un administrador con contraseña conocida ("password").
-- El administrador se crea con `npm run prisma:seed`, que exige SEED_ADMIN_EMAIL y
-- SEED_ADMIN_PASSWORD en el entorno (ver docs/SEGURIDAD.md).

PRINT '=============================================================================';
PRINT '✓ DESPLIEGUE COMPLETO (DDL + SEED DATA) DE inbestiga_db CULMINADO CON ÉXITO.';
PRINT '=============================================================================';
GO
