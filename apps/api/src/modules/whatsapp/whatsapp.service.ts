import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OpenWAProvider, SendMessageResult } from './openwa.provider';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WhatsAppService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly openWA: OpenWAProvider,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Al arrancar la API: asegura que exista la sesión en OpenWA y que el webhook
   * de INBESTIGA esté registrado. No bloquea el arranque si OpenWA no está levantado.
   */
  onApplicationBootstrap() {
    if (process.env.OPENWA_AUTO_SETUP === 'false') return;
    void this.configurarIntegracion().catch((e) =>
      this.logger.warn(`OpenWA no disponible al arrancar (${e.response?.data?.message || e.message}). Use POST /whatsapp/setup cuando esté levantado.`),
    );
  }

  /** Crea/inicia la sesión y registra el webhook. Idempotente. */
  async configurarIntegracion() {
    const session = await this.openWA.startSession();
    const webhookUrl = process.env.OPENWA_WEBHOOK_URL;
    let webhook: string = 'no-configurado (falta OPENWA_WEBHOOK_URL)';
    if (webhookUrl) {
      webhook = await this.openWA.ensureWebhook(webhookUrl, process.env.OPENWA_WEBHOOK_SECRET || undefined);
    }
    this.logger.log(`✓ OpenWA listo: sesión "${session.name}" (${session.status}), webhook ${webhook}.`);
    if (session.status !== 'ready') {
      this.logger.log('  → Escanee el QR desde GET /api/v1/whatsapp/status o el dashboard de OpenWA (http://localhost:2785).');
    }
    return { sesion: session, webhook };
  }

  /**
   * Envía mensaje y lo persiste en la tabla MENSAJE
   */
  async enviarMensaje(params: {
    conversacionId: string;
    telefono: string;
    contenido: string;
    tipoMensaje?: string;
    remitente?: string;
    metadata?: any;
  }): Promise<SendMessageResult> {
    const { conversacionId, telefono, contenido, tipoMensaje = 'TEXT', remitente = 'AGENTE_IA', metadata } = params;

    const result = await this.openWA.sendTextMessage({
      chatId: telefono,
      text: contenido,
    });

    const metaToSave = {
      ...(typeof metadata === 'object' ? metadata : {}),
      waMessageId: result.messageId,
      sentTo: telefono,
      ...(result.simulado ? { simulado: true } : {}),
    };

    // Registrar en BD
    await this.prisma.mensaje.create({
      data: {
        conversacionId,
        direccion: 'OUTGOING',
        remitente,
        contenido,
        tipoMensaje,
        estadoEntrega: result.exito ? 'SENT' : 'FAILED',
        metadata: JSON.stringify(metaToSave),
      },
    });

    await this.prisma.conversacion.update({
      where: { id: conversacionId },
      data: { fechaUltimaActividad: new Date() },
    });

    return result;
  }

  async getStatus() {
    return this.openWA.getSessionStatus();
  }
}
