#!/usr/bin/env bash
# =============================================================================
# INBESTIGA.TESIS - Script de Despliegue Secuencial de los 4 Data Marts
# Metodología Ralph Kimball: Data Marts Independientes por Proceso
# Lee directamente cada archivo desde su carpeta correspondiente (Zero Redundancia)
# =============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
: "${MSSQL_SA_PASSWORD:?Exporte MSSQL_SA_PASSWORD antes de ejecutar este script}"
SQLCMD="docker exec -i -e SQLCMDPASSWORD=$MSSQL_SA_PASSWORD inbestiga-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C"

echo "============================================================================="
echo ">> DESPLEGANDO DATA MARTS DE INBESTIGA EN SQL SERVER"
echo "============================================================================="

echo "1. Inicializando bases de datos físicas de los Data Marts (00_init_schemas.sql)..."
$SQLCMD < "$DIR/00_init_schemas.sql"

echo "2. Desplegando Data Mart 1: Captación y Marketing (02_dm_buyers)..."
$SQLCMD < "$DIR/02_dm_buyers/01_tables.sql"
$SQLCMD < "$DIR/02_dm_buyers/02_views.sql"
$SQLCMD < "$DIR/02_dm_buyers/03_etl.sql"

echo "3. Desplegando Data Mart 2: Negociación y Conversión con IA (03_dm_leads)..."
$SQLCMD < "$DIR/03_dm_leads/01_tables.sql"
$SQLCMD < "$DIR/03_dm_leads/02_views.sql"
$SQLCMD < "$DIR/03_dm_leads/03_etl.sql"

echo "4. Desplegando Data Mart 3: Cobranza y Pasarela Culqi (04_dm_payers)..."
$SQLCMD < "$DIR/04_dm_payers/01_tables.sql"
$SQLCMD < "$DIR/04_dm_payers/02_views.sql"
$SQLCMD < "$DIR/04_dm_payers/03_etl.sql"

echo "5. Desplegando Data Mart 4: Atención, Bitácora y Satisfacción (05_dm_customers)..."
$SQLCMD < "$DIR/05_dm_customers/01_tables.sql"
$SQLCMD < "$DIR/05_dm_customers/02_views.sql"
$SQLCMD < "$DIR/05_dm_customers/03_etl.sql"

echo "6. Creando Orquestador Maestro de ETL en inbestiga_db (06_orchestrator.sql)..."
$SQLCMD < "$DIR/06_orchestrator.sql"

echo "7. Ejecutando primera sincronización ETL completa..."
$SQLCMD -Q "EXEC inbestiga_db.dbo.sp_etl_populate_datamarts;"

echo "============================================================================="
echo "✓ DESPLIEGUE Y SINCRONIZACIÓN EXITOSA DE LOS 4 DATA MARTS"
echo "============================================================================="
