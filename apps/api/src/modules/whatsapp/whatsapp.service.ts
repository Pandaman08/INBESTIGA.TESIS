import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OpenWAProvider, SendMessageResult } from './openwa.provider';
import { PrismaService } from '../../database/prisma.service';

export type CanalMensaje = 'WHATSAPP' | 'CHAT_WEB_INTERNO';

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
   * Registra y envía (si corresponde) un mensaje saliente con su estado REAL.
   *
   * Orden seguro: 1) se RESERVA la fila en MENSAJE (estado PENDIENTE); 2) se envía; 3) se actualiza
   * el estado. Si `respuestaA` ya tiene respuesta del agente, el índice UX_MENSAJE_RESPUESTA_IA
   * impide la reserva y NO se envía nada (sin dobles respuestas por reintentos o reinicios).
   *
   * - canal CHAT_WEB_INTERNO, o `motivoLocal` definido → no se toca WhatsApp: LOCAL_ONLY.
   * - canal WHATSAPP → SENT / QUEUED / FAILED según el gateway. Nunca se reenvía automáticamente.
   */
  async enviarMensaje(params: {
    conversacionId: string;
    telefono: string;
    contenido: string;
    tipoMensaje?: string;
    remitente?: string;
    metadata?: any;
    canal?: CanalMensaje;
    /** Si se indica, el mensaje no se envía y queda LOCAL_ONLY con este motivo (p. ej. SIN_CONSENTIMIENTO). */
    motivoLocal?: string;
    /** Contrato P03 (opcionales para compatibilidad con PAYERS/CUSTOMERS). */
    respuestaA?: string;
    actor?: string;
    actorUsuarioId?: string | null;
    oportunidadId?: string | null;
    consentimientoAplicado?: string;
  }): Promise<SendMessageResult & { mensajeId?: string; duplicado?: boolean }> {
    const {
      conversacionId,
      telefono,
      contenido,
      tipoMensaje = 'TEXT',
      remitente = 'AGENTE_IA',
      metadata,
      canal = 'WHATSAPP',
      motivoLocal,
    } = params;
    const soloLocal = canal === 'CHAT_WEB_INTERNO' || !!motivoLocal;
    const metaBase = typeof metadata === 'object' && metadata ? metadata : {};

    // 1) Reserva
    let reservado: { id: string };
    try {
      reservado = await this.prisma.mensaje.create({
        data: {
          conversacionId,
          direccion: 'OUTGOING',
          remitente,
          actor: params.actor ?? (remitente === 'AGENTE_IA' ? 'AGENTE_IA' : remitente === 'ASESOR_HUMANO' ? 'ASESOR' : 'SISTEMA'),
          actorUsuarioId: params.actorUsuarioId ?? null,
          canal,
          oportunidadId: params.oportunidadId ?? null,
          respuestaA: params.respuestaA ?? null,
          consentimientoAplicado: params.consentimientoAplicado ?? null,
          contenido,
          tipoMensaje,
          estadoEntrega: 'PENDIENTE',
          metadata: JSON.stringify({ ...metaBase, canal }),
        },
        select: { id: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        this.logger.warn(`Respuesta duplicada evitada para el mensaje ${params.respuestaA}.`);
        return { estado: 'LOCAL_ONLY', exito: false, duplicado: true, error: 'RESPUESTA_YA_REGISTRADA' };
      }
      throw e;
    }

    // 2) Envío real (o nada, si es local)
    const result: SendMessageResult = soloLocal
      ? { estado: 'LOCAL_ONLY', exito: false, error: motivoLocal }
      : await this.openWA.sendTextMessage({ chatId: telefono, text: contenido });

    // 3) Estado final
    await this.prisma.mensaje.update({
      where: { id: reservado.id },
      data: {
        estadoEntrega: result.estado,
        ...(result.messageId ? { providerMessageId: result.messageId } : {}),
        metadata: JSON.stringify({
          ...metaBase,
          canal,
          ...(result.messageId ? { waMessageId: result.messageId } : {}),
          ...(result.error ? { errorEntrega: result.error } : {}),
          ...(motivoLocal ? { motivoLocal } : {}),
        }),
      },
    });

    await this.prisma.conversacion.update({
      where: { id: conversacionId },
      data: { fechaUltimaActividad: new Date() },
    });

    return { ...result, mensajeId: reservado.id };
  }

  async getStatus() {
    return this.openWA.getSessionStatus();
  }
}
