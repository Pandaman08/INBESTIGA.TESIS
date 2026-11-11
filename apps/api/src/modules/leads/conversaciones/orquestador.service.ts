import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { KeyedSerialQueue } from '../../../common/keyed-serial-queue';
import { evaluarEnvioWhatsApp } from '../../../common/contact-policy';
import { AiAgentService } from '../../ai-agent/ai-agent.service';
import { WhatsAppService, CanalMensaje } from '../../whatsapp/whatsapp.service';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { EventosLeadsService } from './eventos.service';

/** Longitud máxima de un mensaje entrante que se procesa (el resto se descarta y se registra). */
export const MAX_CARACTERES_ENTRADA = 4000;

/** Evento de entrada único, independiente del canal. */
export interface EntradaMensaje {
  canal: CanalMensaje;
  buyerId: string;
  contenido: string;
  actor: { tipo: 'BUYER' | 'ADMIN_TEST'; usuarioId?: string | null };
  /** Clave idempotente del evento (webhook: sessionId+messageId; panel: id generado por el cliente). */
  eventoEntradaId?: string;
  providerMessageId?: string;
  /** chatId de WhatsApp (p. ej. @lid) para reconocer al remitente en el futuro. */
  waChatId?: string;
}

export type EstadoAtencion = 'RESPONDIDO' | 'DUPLICADO' | 'ERROR_IA';

export interface ResultadoAtencion {
  estado: EstadoAtencion;
  canal: CanalMensaje;
  conversacionId: string;
  oportunidadId: string | null;
  mensajeEntradaId: string;
  etapa?: string;
  respuestaAgente?: string;
  actionMetadata?: any;
  envio?: any;
}

/**
 * Orquestador conversacional de LEADS (P03).
 * WhatsApp y el chat interno del panel llaman a este MISMO núcleo: mismo estudiante, misma
 * oportunidad, mismo historial, mismas reglas. Los canales solo reciben, entregan e informan estado.
 *
 * Garantías:
 *  - Orden causal y sin respuestas simultáneas: los mensajes de un estudiante se atienden en serie.
 *  - Idempotencia: un evento de entrada se registra una vez (UX_MENSAJE_EVENTO) y cada mensaje
 *    recibe como máximo una respuesta del agente (UX_MENSAJE_RESPUESTA_IA).
 *  - Reinicio seguro: si el proceso cae tras registrar la entrada y antes de responder, el
 *    reintento del mismo evento retoma la atención en lugar de ignorarla.
 */
@Injectable()
export class OrquestadorConversacionalService {
  private readonly logger = new Logger(OrquestadorConversacionalService.name);
  private readonly cola = new KeyedSerialQueue();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiAgentService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsapp: WhatsAppService,
    private readonly oportunidades: OportunidadesService,
    private readonly eventos: EventosLeadsService,
  ) {}

  recibir(entrada: EntradaMensaje): Promise<ResultadoAtencion> {
    return this.cola.run(entrada.buyerId, () => this.atender(entrada));
  }

  /**
   * Conversación vigente del estudiante, vinculada a su oportunidad abierta de LEADS.
   * Si el BUYER es LEAD, se asegura (idempotente) una oportunidad abierta; si la anterior se cerró,
   * se inicia una conversación nueva para el nuevo ciclo.
   */
  async obtenerConversacionVigente(buyerId: string, leadId: string | null) {
    const oportunidadId = leadId ? (await this.oportunidades.abrirParaLead(leadId, { tipo: 'SISTEMA' })).oportunidad.id : null;

    const existente = await this.prisma.conversacion.findFirst({
      where: { buyerId, ...(oportunidadId ? { OR: [{ oportunidadId }, { oportunidadId: null }] } : {}) },
      orderBy: { fechaInicio: 'desc' },
    });
    if (existente) {
      if (oportunidadId && !existente.oportunidadId) {
        return this.prisma.conversacion.update({ where: { id: existente.id }, data: { oportunidadId, leadId } });
      }
      return existente;
    }
    return this.prisma.conversacion.create({
      data: { buyerId, leadId, oportunidadId, canal: 'WHATSAPP', estadoEtapa: 'DISCOVERY' },
    });
  }

  private async atender(e: EntradaMensaje): Promise<ResultadoAtencion> {
    const buyer = await this.prisma.buyer.findUnique({ where: { id: e.buyerId }, include: { lead: { select: { id: true } } } });
    if (!buyer) throw new NotFoundException('Estudiante no encontrado.');

    const conversacion = await this.obtenerConversacionVigente(buyer.id, buyer.lead?.id ?? null);
    const oportunidadId: string | null = conversacion.oportunidadId ?? null;
    const base = { canal: e.canal, conversacionId: conversacion.id, oportunidadId };
    const actorEntrada = { actorTipo: e.actor.tipo, actorId: e.actor.usuarioId ?? null };

    let contenido = (e.contenido || '').trim();
    const recortado = contenido.length > MAX_CARACTERES_ENTRADA;
    if (recortado) contenido = contenido.slice(0, MAX_CARACTERES_ENTRADA);

    // 1. Registrar el evento de entrada (idempotente)
    let entrada: { id: string; estadoProcesamiento: string | null; contenido: string };
    let nueva = true;
    try {
      entrada = await this.prisma.mensaje.create({
        data: {
          conversacionId: conversacion.id,
          oportunidadId,
          direccion: 'INCOMING',
          remitente: e.actor.tipo === 'ADMIN_TEST' ? 'ADMIN_TEST' : 'CLIENTE',
          actor: e.actor.tipo,
          actorUsuarioId: e.actor.usuarioId ?? null,
          canal: e.canal,
          eventoEntradaId: e.eventoEntradaId ?? null,
          providerMessageId: e.providerMessageId ?? null,
          contenido,
          tipoMensaje: 'TEXT',
          estadoEntrega: e.canal === 'CHAT_WEB_INTERNO' ? 'LOCAL_ONLY' : 'DELIVERED',
          estadoProcesamiento: 'RECIBIDO',
          metadata: JSON.stringify({ canal: e.canal, ...(e.waChatId ? { waChatId: e.waChatId } : {}), ...(recortado ? { recortado: true } : {}) }),
        },
        select: { id: true, estadoProcesamiento: true, contenido: true },
      });
    } catch (err: any) {
      if (err?.code !== 'P2002' || !e.eventoEntradaId) throw err;
      const previo = await this.prisma.mensaje.findFirst({
        where: { canal: e.canal, eventoEntradaId: e.eventoEntradaId },
        select: { id: true, estadoProcesamiento: true, contenido: true },
      });
      const yaRespondido =
        previo &&
        (previo.estadoProcesamiento === 'PROCESADO' ||
          (await this.prisma.mensaje.count({ where: { respuestaA: previo.id, actor: 'AGENTE_IA' } })) > 0);
      if (!previo || yaRespondido) {
        await this.eventos.registrar({
          tipo: 'MENSAJE_DUPLICADO',
          resumen: 'Evento de entrada repetido: ignorado (ya fue atendido).',
          ...actorEntrada,
          ...base,
          mensajeId: previo?.id,
          datos: { eventoEntradaId: e.eventoEntradaId },
        });
        return { estado: 'DUPLICADO', ...base, mensajeEntradaId: previo?.id ?? '' };
      }
      // Entrada registrada pero sin respuesta (caída o error previo): se retoma una sola vez.
      entrada = previo;
      nueva = false;
      await this.eventos.registrar({
        tipo: 'PROCESAMIENTO_REANUDADO',
        resumen: 'Se retoma un mensaje recibido que no llegó a responderse.',
        ...actorEntrada,
        ...base,
        mensajeId: previo.id,
      });
    }

    if (nueva) {
      await this.eventos.registrar({
        tipo: 'MENSAJE_RECIBIDO',
        resumen: `Mensaje de ${e.actor.tipo === 'ADMIN_TEST' ? 'prueba interna (admin)' : 'estudiante'} por ${e.canal}${recortado ? ' (recortado)' : ''}.`,
        ...actorEntrada,
        ...base,
        mensajeId: entrada.id,
        datos: { caracteres: entrada.contenido.length },
      });
    }

    // 2. Agente IA (mismo núcleo para ambos canales)
    let ia: Awaited<ReturnType<AiAgentService['procesarRespuestaIA']>>;
    try {
      ia = await this.ai.procesarRespuestaIA({
        conversacionId: conversacion.id,
        buyerId: buyer.id,
        ultimoMensajeCliente: entrada.contenido,
        mensajeEntradaId: entrada.id,
        canal: e.canal,
      });
    } catch (err: any) {
      await this.prisma.mensaje.update({ where: { id: entrada.id }, data: { estadoProcesamiento: 'ERROR' } });
      await this.eventos.registrar({
        tipo: 'IA_ERROR',
        resumen: 'El agente IA no pudo generar respuesta; el mensaje queda pendiente de reintento.',
        actorTipo: 'SISTEMA',
        ...base,
        mensajeId: entrada.id,
        datos: { error: String(err?.message ?? err) },
      });
      this.logger.error(`Error IA en conversación ${conversacion.id}: ${err?.message}`);
      return { estado: 'ERROR_IA', ...base, mensajeEntradaId: entrada.id };
    }

    if (ia.origen === 'HEURISTICA_LOCAL') {
      await this.eventos.registrar({
        tipo: 'IA_NO_DISPONIBLE',
        resumen: 'Ningún proveedor de IA respondió; se usó la respuesta de contingencia local.',
        actorTipo: 'SISTEMA',
        ...base,
        mensajeId: entrada.id,
      });
    }
    if (ia.actionMetadata?.tool) {
      const r = ia.actionMetadata.result ?? {};
      const bloqueada = r.bloqueado === true;
      await this.eventos.registrar({
        tipo: bloqueada ? 'HERRAMIENTA_BLOQUEADA' : 'HERRAMIENTA_EJECUTADA',
        resumen: `${bloqueada ? 'Herramienta bloqueada por reglas de negocio' : 'Herramienta ejecutada'}: ${ia.actionMetadata.tool}.`,
        actorTipo: 'AGENTE_IA',
        ...base,
        mensajeId: entrada.id,
        datos: { herramienta: ia.actionMetadata.tool, exito: !bloqueada && !r.error, error: r.error ?? null },
      });
    }

    // 3. Respuesta por el MISMO canal de entrada (WhatsApp solo con consentimiento y número permitido)
    const politica = e.canal === 'WHATSAPP' ? evaluarEnvioWhatsApp(buyer) : null;
    const consentimientoAplicado =
      e.canal === 'CHAT_WEB_INTERNO'
        ? 'NO_APLICA'
        : politica?.permitido
          ? 'VIGENTE'
          : politica?.motivo === 'SIN_CONSENTIMIENTO'
            ? 'SIN_CONSENTIMIENTO'
            : 'NUMERO_NO_AUTORIZADO';

    const envio = await this.whatsapp.enviarMensaje({
      conversacionId: conversacion.id,
      telefono: buyer.whatsapp,
      contenido: ia.respuestaTexto,
      tipoMensaje: ia.actionMetadata?.tool === 'create_payment_request' ? 'PAYMENT_LINK' : 'TEXT',
      remitente: 'AGENTE_IA',
      actor: 'AGENTE_IA',
      metadata: ia.actionMetadata ? { herramienta: ia.actionMetadata.tool } : undefined,
      canal: e.canal,
      motivoLocal: politica && !politica.permitido ? politica.motivo : undefined,
      respuestaA: entrada.id,
      oportunidadId,
      consentimientoAplicado,
    });

    await this.prisma.mensaje.update({ where: { id: entrada.id }, data: { estadoProcesamiento: 'PROCESADO' } });

    if (envio.duplicado) {
      return { estado: 'DUPLICADO', ...base, mensajeEntradaId: entrada.id };
    }
    await this.eventos.registrar({
      tipo: envio.estado === 'FAILED' ? 'ENVIO_FALLIDO' : 'RESPUESTA_REGISTRADA',
      resumen:
        envio.estado === 'FAILED'
          ? 'La respuesta no pudo enviarse por WhatsApp (no se reintenta automáticamente).'
          : `Respuesta del agente registrada (${envio.estado}).`,
      actorTipo: 'AGENTE_IA',
      ...base,
      mensajeId: envio.mensajeId,
      datos: { estadoEntrega: envio.estado, origen: ia.origen, consentimientoAplicado, error: envio.error ?? null },
    });

    return {
      estado: 'RESPONDIDO',
      ...base,
      mensajeEntradaId: entrada.id,
      etapa: ia.etapaNueva,
      respuestaAgente: ia.respuestaTexto,
      actionMetadata: ia.actionMetadata,
      envio,
    };
  }
}
