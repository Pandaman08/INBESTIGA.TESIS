import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Actor } from './domain/actor';
import { ESTADOS_OPORTUNIDAD, TRANSICIONES } from './domain/oportunidad-estados';
import { AbrirOportunidadDto, CrearPropuestaDto, ResponderPropuestaDto, TransicionOportunidadDto } from './leads.dto';
import { OportunidadesService } from './oportunidades/oportunidades.service';
import { PropuestasService } from './propuestas/propuestas.service';
import { EventosLeadsService } from './conversaciones/eventos.service';

type ReqConUsuario = Request & { user?: { id: string; rol: 'ADMIN' | 'ASESOR' } };
const actorDe = (req: ReqConUsuario): Actor => ({ tipo: req.user?.rol === 'ASESOR' ? 'ASESOR' : 'ADMIN', id: req.user?.id });

/** API de la fase LEADS (v1). Requiere sesión ADMIN (guard global). */
@ApiTags('LEADS · Oportunidades y propuestas')
@ApiBearerAuth()
@Controller('leads')
export class LeadsController {
  constructor(
    private readonly oportunidades: OportunidadesService,
    private readonly propuestas: PropuestasService,
    private readonly eventos: EventosLeadsService,
  ) {}

  @Get('conversaciones/:id/timeline')
  @ApiOperation({
    summary: 'Línea de tiempo explicable: mensajes (canal, actor, estado de entrega) y eventos operativos verificables, sin razonamientos internos del modelo',
  })
  timeline(@Param('id') id: string) {
    return this.eventos.timeline(id);
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Eventos operativos recientes para el tablero en vivo (no son KPI)' })
  eventosRecientes(@Query('desde') desde?: string, @Query('limite') limite?: string) {
    const d = desde ? new Date(desde) : undefined;
    return this.eventos.listarRecientes(d && !isNaN(d.getTime()) ? d : undefined, limite ? Number(limite) : 100);
  }

  @Get('estados')
  @ApiOperation({ summary: 'Contrato de estados de la oportunidad y transiciones (MANUAL / EVENTO)' })
  estados() {
    return { estados: ESTADOS_OPORTUNIDAD, transiciones: TRANSICIONES };
  }

  @Get('oportunidades')
  @ApiOperation({ summary: 'Listar oportunidades (filtros: buyerId, estado)' })
  listar(@Query('buyerId') buyerId?: string, @Query('estado') estado?: string) {
    return this.oportunidades.listar({ buyerId, estado });
  }

  @Get('oportunidades/:id')
  @ApiOperation({ summary: 'Detalle de la oportunidad con historial, diagnósticos, propuestas versionadas, objeciones y citas' })
  obtener(@Param('id') id: string) {
    return this.oportunidades.obtener(id);
  }

  @Post('oportunidades')
  @ApiOperation({ summary: 'Abrir oportunidad para un BUYER/LEAD (idempotente: devuelve la abierta si existe)' })
  abrir(@Body() dto: AbrirOportunidadDto, @Req() req: ReqConUsuario) {
    return this.oportunidades.abrirParaBuyer(dto.buyerId, actorDe(req));
  }

  @Post('oportunidades/:id/transiciones')
  @ApiOperation({ summary: 'Transición manual autorizada (EN_DIAGNOSTICO, APTA_PARA_COTIZAR, DESCARTADA)' })
  transicionar(@Param('id') id: string, @Body() dto: TransicionOportunidadDto, @Req() req: ReqConUsuario) {
    return this.oportunidades.transicionar(id, dto.estado, actorDe(req), dto.motivo);
  }

  @Post('oportunidades/:id/propuestas')
  @ApiOperation({ summary: 'Crear una nueva versión de propuesta (BORRADOR)' })
  crearPropuesta(@Param('id') id: string, @Body() dto: CrearPropuestaDto, @Req() req: ReqConUsuario) {
    return this.propuestas.crearVersion(id, dto, actorDe(req));
  }

  @Post('propuestas/:id/presentar')
  @ApiOperation({ summary: 'Presentar una versión al estudiante (la primera lleva la oportunidad a EN_NEGOCIACION)' })
  presentar(@Param('id') id: string, @Req() req: ReqConUsuario) {
    return this.propuestas.presentar(id, actorDe(req));
  }

  @Post('propuestas/:id/respuestas')
  @ApiOperation({ summary: 'Registrar la respuesta del estudiante a una versión (ACEPTADA requiere confirmación expresa; no crea PAYER)' })
  responder(@Param('id') id: string, @Body() dto: ResponderPropuestaDto, @Req() req: ReqConUsuario) {
    return this.propuestas.responder(id, dto, actorDe(req));
  }
}
