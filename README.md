# INBESTIGA.TESIS — Prototipo Funcional de Nivel Avanzado

Plataforma académica y tecnológica de captación, calificación, negociación autónoma con IA, pagos reales y atención de estudiantes universitarios para servicios de tesis e investigación científica.

Desarrollada bajo la metodología y funnel **IMPULSE**:
```
UNIVERSO ──> BUYER ──> LEAD ──> PAYER ──> CUSTOMER
```

---

## 1. Stack Tecnológico

* **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons.
* **Backend**: NestJS 10, TypeScript, Arquitectura Modular, API REST, Swagger OpenAPI.
* **Base de Datos**: Microsoft SQL Server 2022 (Linux Container en Docker).
* **ORM**: **Prisma ORM** con conector nativo de SQL Server (`provider = "sqlserver"`).
* **Inteligencia Artificial**: Abstracción `AIProvider` desacoplada (Google Gemini y xAI Grok) con aislamiento estricto de la BD mediante *Function Calling* (*Tools*).
* **WhatsApp**: Integración con contenedor **OpenWA** (puerto `2785`).
* **Business Intelligence / Data Marts**: 4 Bases de Datos físicas departamentales según Ralph Kimball (`inbestiga_dm_buyers`, `inbestiga_dm_leads`, `inbestiga_dm_payers`, `inbestiga_dm_customers`) desacopladas de `inbestiga_db` (OLTP), con dimensiones conformadas instanciadas y procedimiento orquestador ETL `sp_etl_populate_datamarts`.

---

## 2. Estructura del Monorepo

```
INBESTIGA.TESIS/
├── apps/
│   ├── api/                  # Backend NestJS 10 (Puerto :4000)
│   │   ├── prisma/           # schema.prisma y seed.ts
│   │   └── src/              # Módulos de negocio (Auth, Buyers, IA, WhatsApp, Pagos, etc.)
│   └── web/                  # Frontend Next.js 14 (Puerto :3000)
│       └── src/              # Pages: Landing, Formulario, Buyers, Live Chat, Dashboard, Checkout
├── packages/
│   └── shared/               # @inbestiga/shared: tipos, enums y contratos del funnel
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml # Microsoft SQL Server 2022
│   │   └── init-db.sql       # Creación de inbestiga_db y los 4 Data Marts
│   └── sql/
│       ├── transaccional/    # Scripts DDL de la BD transaccional OLTP (inbestiga_db)
│       │   ├── inbestiga_db_completo.sql # Script maestro autocontenido
│       │   └── [01 a 05]_fase*.sql       # Scripts modulares por fase
│       └── datamarts/        # 4 Data Marts Físicamente Independientes (Kimball)
│           ├── 00_init_schemas.sql       # Creación de las 4 bases de datos
│           ├── 02_dm_buyers/             # Tablas, Vistas y ETL de Captación y Marketing (inbestiga_dm_buyers)
│           ├── 03_dm_leads/              # Tablas, Vistas y ETL de Negociación IA (inbestiga_dm_leads)
│           ├── 04_dm_payers/             # Tablas, Vistas y ETL de Cobranza Culqi (inbestiga_dm_payers)
│           ├── 05_dm_customers/          # Tablas, Vistas y ETL de Atención y Bitácora (inbestiga_dm_customers)
│           ├── 06_etl/                   # Procedimientos ETL y orquestador maestro (sp_etl_populate_datamarts)
│           └── build_all_datamarts.sql   # Script maestro de despliegue y carga
└── docs/                     # Documentación académica detallada
    ├── arquitectura.md
    └── guia_demostracion.md
```

---

## 3. Instalación y Puesta en Marcha

### Prerrequisitos
* Node.js v20+ o v24+
* npm v10+ o v11+
* Docker y Docker Compose

### Paso 1: Levantar Microsoft SQL Server 2022
```bash
# Iniciar contenedor inbestiga-mssql en puerto 1433
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### Paso 2: Configurar Variables de Entorno
```bash
cp .env.example .env
cp .env.example apps/api/.env
```

### Paso 3: Instalar Dependencias y Generar Prisma Client
```bash
npm install
npm run build --workspace=@inbestiga/shared
npm run prisma:generate --workspace=apps/api
```

### Paso 4: Sincronizar Base de Datos y Ejecutar Seed
```bash
# Sincroniza las 26 tablas OLTP en SQL Server (inbestiga_db)
npm run prisma:push --workspace=apps/api

# Carga el catálogo universitario, servicios, reglas comerciales y estudiantes de prueba
npm run prisma:seed --workspace=apps/api
```

### Paso 5: Desplegar los 4 Data Marts Independientes y Cargar Datos
```bash
docker exec -i -e SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" inbestiga-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C < infrastructure/sql/datamarts/build_all_datamarts.sql
```

### Paso 6: Iniciar Servidores de Desarrollo o Producción

* **Backend NestJS (Puerto 4000)**:
```bash
npm run dev:api
# Swagger disponible en: http://localhost:4000/api/docs
```

* **Frontend Next.js (Puerto 3000)**:
```bash
npm run dev:web
# Aplicación web disponible en: http://localhost:3000
```

### Paso 7: Conectar WhatsApp (gateway OpenWA)

El agente usa [OpenWA](https://github.com/Pandaman08/OpenWA) como gateway de WhatsApp. Debe estar clonado **junto a** este repositorio:

```
Agente leads/
├── INBESTIGA.TESIS/
└── OpenWA/        # git clone https://github.com/Pandaman08/OpenWA.git
```

1. En el `.env` de la raíz defina `OPENWA_API_KEY` y `OPENWA_WEBHOOK_SECRET` (valores aleatorios).
2. Levante el gateway (la primera vez compila la imagen, tarda unos minutos):
   ```bash
   npm run openwa:up      # logs: npm run openwa:logs
   ```
3. Inicie la API (`npm run dev:api`). Al arrancar crea la sesión `OPENWA_SESSION_NAME` y registra el webhook automáticamente (o manualmente con `POST /api/v1/whatsapp/setup`).
4. Vincule el número: escanee el QR desde el dashboard de OpenWA (`http://localhost:2785`) o desde `GET /api/v1/whatsapp/status` (campo `qr`, data URL). Use un **número dedicado**: OpenWA no es la API oficial de Meta y existe riesgo de bloqueo.
5. Los estudiantes de la semilla son **ficticios** (`@demo.inbestiga.test`): solo reciben WhatsApp si su número está en `WHATSAPP_TEST_ALLOWLIST`. El chat de `/admin/live-chat` es una **prueba interna** y nunca envía por WhatsApp. Detalles en [docs/SEGURIDAD.md](docs/SEGURIDAD.md).

Flujo: estudiante escribe → OpenWA → `POST /api/v1/whatsapp/webhook` (firma HMAC verificada) → `NegotiationService` + Agente IA → `send-text` de OpenWA → estudiante.

---

## 4. Guía Rápida de Demostración para el Docente

1. **Entrar a la aplicación**: Abrir `http://localhost:3000` y mostrar la propuesta de valor y las etapas del Funnel **IMPULSE**.
2. **Formulario y Lead Scoring**: Abrir `http://localhost:3000/formulario`, llenar los datos y ver la tarjeta de cálculo con Lead Score (ej. 92/100 LEAD).
3. **Panel de BUYERS**: Entrar a `http://localhost:3000/admin/buyers` y observar la lista ordenada por **Lead Score DESCendente**.
4. **Acción Central [INICIAR NEGOCIACIÓN]**: Pulsar el botón para un prospecto (ej. Ana Pérez). El Agente IA redacta el primer mensaje hiperpersonalizado usando datos del formulario y lo despacha por OpenWA.
5. **Live Chat Interactivo**: En `http://localhost:3000/admin/live-chat`, observar la conversación y simular objeciones de precio. El backend valida contraofertas ante el Motor de Reglas Comerciales y genera la orden de pago.
6. **Pasarela de Pago Real**: En `http://localhost:3000/checkout/[cotizacionId]`, pagar con Tarjeta o Yape QR. El webhook confirma la transacción:
   - `LEAD` transiciona a `PAYER`.
   - Se crea el registro `CUSTOMER`.
   - Se asigna un Asesor Académico de la especialidad y se agenda la primera sesión con enlace Google Meet.
7. **Dashboard & ETL**: En `http://localhost:3000/admin/dashboard`, revisar los KPIs y pulsar **[EJECUTAR ETL]** para sincronizar los 4 Data Marts independientes desde `inbestiga_db`.

---

## 5. Credenciales Predeterminadas

Las credenciales **no** están en el repositorio. Se definen en el `.env` de la raíz (ver [docs/SEGURIDAD.md](docs/SEGURIDAD.md)):

* **SQL Server**: usuario `sa`, contraseña `MSSQL_SA_PASSWORD`, puerto `1433`
* **Administrador web**: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (creado por `npm run prisma:seed`; inicia sesión en `http://localhost:3000/login`)
* **OpenWA API**: Puerto `2785` / Clave: el valor de `OPENWA_API_KEY` en `.env`
