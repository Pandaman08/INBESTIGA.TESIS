# P03.7 — Matriz de compatibilidad LEADS

## Decisión de arquitectura

El OLTP actual (`inbestiga_db`) se conserva como fuente transaccional canónica de la aplicación. Los scripts académicos `01_OLTP_ER.sql` y `03_DataMart_DDL.sql` se validan en una instancia aislada, pero no se ejecutan sobre el OLTP del repositorio porque recrean también PAYERS y CUSTOMERS y usan claves `INT IDENTITY` incompatibles con Prisma.

La integración adoptada es aditiva:

```text
inbestiga_db (Prisma, OLTP canónico)
  └── sp_etl_leads(@Corte) — transacción, DELETE+INSERT de hechos
        └── INBESTIGA_MART (8 dimensiones + 3 hechos + vistas R1–R4)
              └── API /dashboard/leads/* → dashboard LEADS
```

Las dimensiones analíticas conservan los identificadores `String` del OLTP en columnas de negocio. Las claves físicas del DataMart siguen siendo `INT IDENTITY`, por lo que no se exponen al dominio transaccional.

## Correspondencia principal

| Script / concepto | Prisma actual | Tipo actual → DataMart | Cardinalidad | Compatibilidad | Estrategia no destructiva |
|---|---|---|---|---|---|
| `CONTACTO` + `PERFIL_ACADEMICO` | `BUYER`, `UNIVERSIDAD`, `CARRERA` | `String` → `Dim_Estudiante.idContacto VARCHAR(100)` | 1 BUYER : 0..1 LEAD | Parcial: BUYER concentra datos que el script separa | Proyección analítica; no se duplican contactos |
| `UNIVERSIDAD` | `Universidad` | `String` → `Dim_Ubicacion.idUniversidad VARCHAR(100)` | 1 : N BUYERS | Compatible semánticamente; no existe `sede` equivalente | Se usa `ciudad` como sede y se conserva miembro desconocido |
| `CANAL`, `CAMPANIA` | `Canal`, `Campana` (`CAMPAÑA`) | `String` → `Dim_Canal_Captacion` | N : 1 | Compatible | Se conserva pareja canal/campaña como clave natural |
| `SERVICIO`, `TARIFA`, `REGLA_PRECIO` | `Servicio`, `ReglaComercial` | `String` → `Dim_Servicio` | 1 : N propuestas | Parcial: la tarifa vigente vive en regla Prisma | El precio histórico se toma de `Propuesta`; no se recalcula desde tarifa |
| `ASESOR` | `Asesor` | `String` → `Dim_Asesor` | 1 : N oportunidades | Compatible; rol/equipo no son columnas actuales | Se materializa rol LEADS y miembro `Agente IA` |
| `LEAD` | `Lead` | `String` | 1 BUYER : 0..1 LEAD | Compatible | Se usa como puente hacia oportunidades |
| `OPORTUNIDAD_COMERCIAL` | `OportunidadComercial` | `String` | 1 LEAD : N ciclos | Compatible | Grano de K1–K5; no se mezclan conversaciones |
| `DIAGNOSTICO` | `Diagnostico` | `String` | N : 1 oportunidad | Compatible con adaptación de nombres | Primera solicitud determinística por oportunidad |
| `PROPUESTA` | `Propuesta` | `String` | N versiones : 1 oportunidad | Compatible; historial de precio se conserva | Primera presentación y primera aceptación se seleccionan con `ROW_NUMBER`/`MIN` |
| `RESPUESTA_PROPUESTA` | `RespuestaPropuesta` | `String` | N : 1 propuesta | Compatible | Solo `ACEPTADA` cuenta para M6/M10 |
| `OBJECION` | `Objecion` | `String` | N : 1 propuesta/oportunidad | Compatible | Primera objeción elegible por oportunidad |
| `TRANSFERENCIA_PAYER` | `TransferenciaPayer` | `String` | N : 1 oportunidad | Compatible | Solo evidencia de acuerdo transferido |
| `CONVERSION_PAYER_REF` | `ConversionPayerRef` | `String` | 0..1 : 1 oportunidad | Compatible | Única fuente para M8/K5; no crea PAYER |
| `CITA_VIRTUAL`, `ESCALAMIENTO` | `CitaVirtual`, `Escalamiento` | `String` | N : 1 oportunidad | Compatible | Solo R4 operativo |
| `MENSAJE`, `EVENTO_LEADS` | `Mensaje`, `EventoLeads` | `String` | N : 1 conversación/oportunidad | Compatible | Evidencia transaccional de conversación; no alimenta KPI por sí sola |

## Incompatibilidades deliberadamente no ocultas

1. El script académico divide datos de contacto y perfil académico; Prisma los mantiene en `BUYER` y sus relaciones.
2. Los scripts usan `INT IDENTITY`; Prisma usa UUID/String. El DataMart usa claves sustitutas enteras y guarda la clave de negocio String.
3. Los scripts recrean el OLTP completo y mezclan fases; la migración de P03.7 no los usa para actualizar `inbestiga_db`.
4. `TARIFA` del script no existe como tabla equivalente; el motor actual usa `SERVICIO` + `REGLA_COMERCIAL`. Los precios de propuestas ya presentadas son históricos y no se recalculan.

## Archivos de integración

- `infrastructure/sql/leads/01_leads_mart_ddl.sql`: DDL aditivo.
- `infrastructure/sql/leads/02_leads_mart_etl.sql`: procedimiento `INBESTIGA_MART.dbo.sp_etl_leads`.
- `infrastructure/sql/leads/03_leads_mart_reports.sql`: KPI oficiales y vistas R1–R4.

Los scripts originales se conservan sin cambios como referencia académica y se ejecutan solo en SQL Server aislado.

## Evidencia de validación P03.7

- La instancia `inbestiga-p037-dev` (puerto aislado 11433) ejecutó los cinco scripts originales sin tocar la base de la aplicación. La conciliación produjo M1–M10 = `180, 144, 150, 120, 135, 54, 200, 36, 50, 20` y K1–K5 = `80 %, 80 %, 40 %, 40 %, 18 %`.
- La instancia `inbestiga-p037-current` (puerto aislado 12433) se creó desde el schema Prisma actual y se usó para validar el DDL aditivo, la conexión NestJS, el chat interno, el procedimiento ETL y los reportes.
- La migración formal del repositorio quedó bloqueada por P3019: `migration_lock.toml` declara `sqlserver` y el schema declara `mssql`. No se modificó ni se eliminó el historial; la instancia descartable se preparó con `prisma migrate diff --from-empty` solo para probar la integración.
- La primera ejecución del ETL descubrió una colisión de la dimensión de investigación por relaciones 1:N; se corrigió agrupando por la clave natural `(TipoTesis, RangoAvance, EmpresaAplicacion)` antes del `MERGE`.
- La primera prueba concurrente descubrió que la instancia creada desde el schema no incluía los índices filtrados de la migración 4. Aplicados dichos índices en la instancia aislada, el mismo `clientMessageId` produjo una sola fila de entrada y estados `RESPONDIDO`/`DUPLICADO`.
- El endpoint `/dashboard/leads` se ajustó para serializar `BIGINT` de SQL Server; `/dashboard/leads/reportes/r4` devuelve cinco controles sin exigir que el DataMart cree una vista sobre el OLTP.

La carga de la semilla actual no contiene oportunidades comerciales, por lo que esa instancia produjo hechos vacíos y KPI `NO APLICABLE`; no se presentan como los resultados simulados del script académico. La prueba conversacional sí abrió oportunidades y persistió dos mensajes locales por BUYER, con respuesta de contingencia `HEURISTICA_LOCAL` porque la prueba se ejecutó sin claves de proveedor IA.
