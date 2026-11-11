import {
  Controller,
  Post,
  Body,
  Get,
  Logger,
  Inject,
  forwardRef,
  Headers,
  Req,
  HttpCode,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/auth.decorators';
import { WhatsAppService } from './whatsapp.service';
import { NegotiationService } from '../negotiation/negotiation.service';

/**
 * Sobre que OpenWA envía a cada webhook (OpenWA/docs/06-api-specification.md §6.6):
 * { event, timestamp, sessionId, idempotencyKey, deliveryId, data }
 */
interface OpenWAWebhookEnvelope {
  event: string;
  sessionId?: string;
  idempotencyKey?: string;
  data?: {
    id?: string;
    from?: string;
    to?: string;
    body?: string;
    type?: string;
    fromMe?: boolean;
    isGroup?: boolean;
    kind?: 'individual' | 'group' | 'channel' | 'status' | 'broadcast' | 'unknown';
    senderPhone?: string | null;
    status?: string;
    [key: string]: any;
  };
}

@ApiTags('WhatsApp / OpenWA')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);
  /** Claves de idempotencia ya procesadas (OpenWA reintenta entregas). */
  private readonly procesados = new Map<string, number>();
  private avisoSinFirma = false;

  constructor(
    private readonly whatsappService: WhatsAppService,
    @Inject(forwardRef(() => NegotiationService))
    private readonly negotiationService: NegotiationService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Estado de la sesión de WhatsApp en OpenWA y QR (data URL) si falta vincular' })
  async getStatus() {
    return this.whatsappService.getStatus();
  }

  @Post('setup')
  @ApiOperation({ summary: 'Crea/inicia la sesión en OpenWA y registra el webhook de INBESTIGA (idempotente)' })
  async setup() {
    return this.whatsappService.configurarIntegracion();
  }

  @Post('webhook')
  @Public() // autenticado por firma HMAC (X-OpenWA-Signature)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @HttpCode(200)
  @ApiOperation({ summary: 'Receptor de webhooks de OpenWA (message.received, session.status)' })
  handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() payload: OpenWAWebhookEnvelope,
    @Headers('x-openwa-signature') signature?: string,
    @Headers('x-openwa-idempotency-key') idempotencyHeader?: string,
  ) {
    this.verificarFirma(req.rawBody, signature);

    const event = payload?.event;
    const data = payload?.data;

    if (event === 'session.status') {
      this.logger.log(`OpenWA sesión ${payload.sessionId}: estado → ${data?.status}`);
      return { status: 'ok' };
    }
    if (event !== 'message.received' || !data) {
      return { status: 'ignored', reason: `evento ${event}` };
    }

    // Solo chats 1-a-1 con texto; nunca grupos, estados, canales ni mensajes propios.
    const esIndividual = data.kind ? data.kind === 'individual' : !data.isGroup;
    const texto = (data.body || '').trim();
    if (data.fromMe || !esIndividual || !data.from || data.type !== 'text' || !texto) {
      return { status: 'ignored' };
    }

    const idemKey = idempotencyHeader || payload.idempotencyKey || data.id;
    if (idemKey && this.yaProcesado(idemKey)) {
      return { status: 'duplicate' };
    }

    // Si WhatsApp entrega un identificador de privacidad (@lid), usar el teléfono
    // resuelto por OpenWA (requiere RESOLVE_LID_TO_PHONE=true en OpenWA).
    const waChatId = data.from;
    const telefono = waChatId.endsWith('@lid') && data.senderPhone ? data.senderPhone : waChatId.split('@')[0];

    this.logger.log(`Mensaje entrante de ${waChatId}${telefono !== waChatId.split('@')[0] ? ` (tel. ${telefono})` : ''}: "${texto.substring(0, 80)}"`);

    // Responder 200 de inmediato: la IA puede tardar más que el timeout del webhook de OpenWA.
    // El orquestador serializa por estudiante y la BD deduplica por evento (sessionId + messageId),
    // así que un reintento de OpenWA no genera una segunda respuesta ni siquiera tras un reinicio.
    const eventoEntradaId = `${payload.sessionId ?? 'sin-sesion'}:${data.id ?? idemKey}`;
    void this.negotiationService
      .procesarMensajeEstudiante(telefono, texto, { waChatId, eventoEntradaId, providerMessageId: data.id })
      .catch((e) => this.logger.error(`Error procesando mensaje de WhatsApp: ${e.message}`, e.stack));

    return { status: 'accepted' };
  }

  @Get('cuarentena')
  @ApiOperation({ summary: 'Mensajes entrantes de remitentes no identificados o ambiguos, pendientes de revisión humana' })
  async cuarentena() {
    return this.negotiationService.listarCuarentena();
  }

  @Post('simulate-incoming')
  @ApiOperation({
    summary: 'Prueba interna: el admin escribe como estudiante (CHAT_WEB_INTERNO, LOCAL_ONLY). No envía nada por WhatsApp.',
  })
  async simulateIncoming(
    @Req() req: Request & { user?: { id: string } },
    @Body() body: { telefono?: string; buyerId?: string; conversacionId?: string; contenido?: string; mensaje?: string; text?: string },
  ) {
    const habilitado = (process.env.WHATSAPP_SIMULATION_ENABLED ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true';
    if (!habilitado) throw new ForbiddenException('La simulación está deshabilitada en este entorno.');
    const texto = body.contenido || body.mensaje || body.text || '';
    return this.negotiationService.procesarMensajePrueba({
      telefono: body.telefono,
      buyerId: body.buyerId,
      conversacionId: body.conversacionId,
      contenido: texto,
      actorUsuarioId: req.user?.id,
    });
  }

  private verificarFirma(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.OPENWA_WEBHOOK_SECRET;
    if (!secret) {
      // Solo desarrollo: en producción la API no arranca sin secreto (config/env.validation.ts).
      if (!this.avisoSinFirma) {
        this.logger.warn('OPENWA_WEBHOOK_SECRET no configurado: los webhooks se aceptan SIN verificar firma (solo desarrollo).');
        this.avisoSinFirma = true;
      }
      return;
    }

    if (!signature || !rawBody) {
      throw new UnauthorizedException('Firma de webhook ausente');
    }
    const esperado = Buffer.from('sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex'));
    const recibido = Buffer.from(signature);
    if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) {
      throw new UnauthorizedException('Firma de webhook inválida');
    }
  }

  private yaProcesado(key: string): boolean {
    const ahora = Date.now();
    if (this.procesados.size > 5000) {
      for (const [k, t] of this.procesados) if (ahora - t > 60 * 60 * 1000) this.procesados.delete(k);
    }
    if (this.procesados.has(key)) return true;
    this.procesados.set(key, ahora);
    return false;
  }

}
