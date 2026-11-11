import { Controller, Post, Get, Param, Body, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NegotiationService } from './negotiation.service';

@ApiTags('Negociación IA')
@Controller('negotiation')
export class NegotiationController {
  constructor(private readonly negotiationService: NegotiationService) {}

  @Post('iniciar/:buyerId')
  @ApiOperation({ summary: 'Acción central [INICIAR NEGOCIACIÓN]: Activa el agente IA y despacha el primer mensaje a WhatsApp' })
  async iniciarNegociacion(@Param('buyerId') buyerId: string) {
    return this.negotiationService.iniciarNegociacion(buyerId);
  }

  @Get('conversacion/:id')
  @ApiOperation({ summary: 'Obtener historial de mensajes y estado de una conversación' })
  async getConversacion(@Param('id') id: string) {
    return this.negotiationService.getConversacion(id);
  }

  @Post('enviar-mensaje')
  @ApiOperation({
    summary:
      'Chat de PRUEBA (CHAT_WEB_INTERNO): el admin escribe como estudiante de prueba. Se registra como ADMIN_TEST y la respuesta queda LOCAL_ONLY; nada sale por WhatsApp.',
  })
  async enviarMensaje(
    @Req() req: Request & { user?: { id: string } },
    @Body() body: { conversacionId?: string; buyerId?: string; telefono?: string; contenido: string; clientMessageId?: string },
  ) {
    return this.negotiationService.procesarMensajePrueba({ ...body, actorUsuarioId: req.user?.id });
  }

  @Post('conversacion/:id/limpiar')
  @ApiOperation({ summary: 'Limpia el chat y reinicia la conversación a fase DISCOVERY y al alumno a LEAD' })
  async limpiarConversacion(@Param('id') id: string) {
    return this.negotiationService.limpiarConversacion(id);
  }

  @Post('buyer/:buyerId/limpiar')
  @ApiOperation({ summary: 'Limpia el chat y reinicia la conversación activa de un buyer a DISCOVERY' })
  async limpiarConversacionPorBuyer(@Param('buyerId') buyerId: string) {
    return this.negotiationService.limpiarConversacionPorBuyer(buyerId);
  }
}
