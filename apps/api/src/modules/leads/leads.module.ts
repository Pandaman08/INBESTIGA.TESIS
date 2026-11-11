import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { OportunidadesService } from './oportunidades/oportunidades.service';
import { PropuestasService } from './propuestas/propuestas.service';
import { EventosLeadsService } from './conversaciones/eventos.service';

/**
 * Módulo de la fase LEADS (informe cap. 4).
 *
 * Estructura (se completa por fases del roadmap):
 *   domain/          estados de la oportunidad, actor, reglas            (P02)
 *   oportunidades/   ciclo de vida de OPORTUNIDAD_COMERCIAL               (P02)
 *   propuestas/      versiones, presentación y respuesta                  (P02; precios completos en P07)
 *   conversaciones/  orquestador canal-agnóstico, bitácora y línea de tiempo (P03;
 *                    el orquestador vive en LeadsConversacionesModule)
 *   diagnostico/, objeciones/, agenda/, escalamiento/, integracion-payers/ (P07–P08)
 *
 * BUYER sigue siendo la fuente de identidad; LEADS solo la referencia.
 */
@Module({
  controllers: [LeadsController],
  providers: [OportunidadesService, PropuestasService, EventosLeadsService],
  exports: [OportunidadesService, PropuestasService, EventosLeadsService],
})
export class LeadsModule {}
