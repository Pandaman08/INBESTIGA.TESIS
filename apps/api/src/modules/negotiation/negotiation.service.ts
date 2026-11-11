import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiAgentService } from '../ai-agent/ai-agent.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class NegotiationService {
  private readonly logger = new Logger(NegotiationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAgentService: AiAgentService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsappService: WhatsAppService,
  ) {}

  /**
   * ACCIÓN CENTRAL: [ INICIAR NEGOCIACIÓN ]
   * El administrador pulsa este botón.
   * El sistema analiza el formulario del estudiante, genera el primer mensaje hiperpersonalizado,
   * y lo envía automáticamente al WhatsApp del estudiante a través de OpenWA.
   */
  async iniciarNegociacion(buyerId: string) {
    this.logger.log(`Iniciando negociación automática para Buyer ID: ${buyerId}`);

    const buyer = await this.prisma.buyer.findUnique({
      where: { id: buyerId },
      include: { universidad: true, carrera: true, lead: true },
    });

    if (!buyer) {
      throw new NotFoundException(`No se encontró el prospecto con ID: ${buyerId}`);
    }

    if (!buyer.whatsapp) {
      throw new BadRequestException('El prospecto no cuenta con número de WhatsApp registrado.');
    }

    // 1. Obtener o crear conversación activa
    let conversacion = await this.prisma.conversacion.findFirst({
      where: { buyerId: buyer.id },
      orderBy: { fechaInicio: 'desc' },
    });

    if (!conversacion) {
      conversacion = await this.prisma.conversacion.create({
        data: {
          buyerId: buyer.id,
          leadId: buyer.lead?.id || null,
          canal: 'WHATSAPP',
          estadoEtapa: 'DISCOVERY',
        },
      });
    }

    // 2. El Agente IA genera el primer mensaje personalizado
    const mensajeInicial = await this.aiAgentService.generarMensajeInicial(buyer.id);

    // 3. Enviar a través de OpenWA al WhatsApp real del estudiante
    const envioResultado = await this.whatsappService.enviarMensaje({
      conversacionId: conversacion.id,
      telefono: buyer.whatsapp,
      contenido: mensajeInicial,
      tipoMensaje: 'TEXT',
      remitente: 'AGENTE_IA',
      metadata: { accion: 'INICIO_NEGOCIACION', score: buyer.leadScore },
    });

    // 4. Actualizar etapa conversacional a DIAGNOSTIC
    await this.prisma.conversacion.update({
      where: { id: conversacion.id },
      data: {
        estadoEtapa: 'DIAGNOSTIC',
        fechaUltimaActividad: new Date(),
      },
    });

    // 5. Notificación en el sistema
    await this.prisma.notificacion.create({
      data: {
        tipo: 'NEGOCIACION_INICIADA',
        titulo: `Negociación Iniciada con ${buyer.nombres}`,
        mensaje: `El Agente IA envió el primer mensaje a WhatsApp (${buyer.whatsapp}) para asesoría de ${buyer.carrera?.nombre || 'Tesis'}.`,
        metadata: JSON.stringify({ buyerId: buyer.id, conversacionId: conversacion.id }),
      },
    });

    this.logger.log(`✓ Negociación iniciada con éxito. Mensaje despachado a WhatsApp: "${mensajeInicial.substring(0, 70)}..."`);

    return {
      exito: true,
      conversacionId: conversacion.id,
      buyerId: buyer.id,
      estudiante: `${buyer.nombres} ${buyer.apellidos}`,
      whatsapp: buyer.whatsapp,
      estadoEtapa: 'DIAGNOSTIC',
      mensajeInicial,
      envio: envioResultado,
    };
  }

  /**
   * Procesa la respuesta entrante del estudiante vía OpenWA Webhook o simulación en vivo.
   */
  async procesarMensajeEstudiante(telefono: string, contenido: string, opts: { waChatId?: string } = {}) {
    const cleanPhone = telefono.replace(/\D/g, '');
    const waChatId = opts.waChatId;

    // Buscar el buyer correspondiente por teléfono
    let buyer = await this.prisma.buyer.findFirst({
      where: {
        OR: [
          { whatsapp: cleanPhone },
          { whatsapp: cleanPhone.startsWith('51') ? cleanPhone.substring(2) : cleanPhone },
          { whatsapp: `51${cleanPhone}` },
        ],
      },
    });

    // Si WhatsApp entregó un identificador de privacidad (@lid) sin teléfono resuelto,
    // buscar un mensaje entrante previo donde ya se haya registrado ese mismo chat.
    // Nunca se "adivina" el estudiante: responder al equivocado filtraría datos de otra persona.
    if (!buyer && waChatId) {
      const mensajePrevio = await this.prisma.mensaje.findFirst({
        where: {
          direccion: 'INCOMING',
          metadata: { contains: `"waChatId":"${waChatId}"` },
        },
        include: { conversacion: { include: { buyer: true } } },
        orderBy: { fechaHora: 'desc' },
      });

      if (mensajePrevio?.conversacion?.buyer) {
        buyer = mensajePrevio.conversacion.buyer;
        this.logger.log(`✓ Buyer ${buyer.nombres} identificado por su chat de WhatsApp ${waChatId}.`);
      }
    }

    if (!buyer) {
      this.logger.warn(
        `No se encontró ningún Buyer registrado para el remitente ${waChatId || cleanPhone}. ` +
          (waChatId?.endsWith('@lid') ? 'Active RESOLVE_LID_TO_PHONE=true en OpenWA para resolver el teléfono.' : ''),
      );
      return { exito: false, mensaje: 'Estudiante no registrado' };
    }

    // Buscar o crear conversación
    let conversacion = await this.prisma.conversacion.findFirst({
      where: { buyerId: buyer.id },
      orderBy: { fechaInicio: 'desc' },
    });

    if (!conversacion) {
      conversacion = await this.prisma.conversacion.create({
        data: {
          buyerId: buyer.id,
          canal: 'WHATSAPP',
          estadoEtapa: 'DISCOVERY',
        },
      });
    }

    // 1. Guardar mensaje entrante del cliente en BD
    await this.prisma.mensaje.create({
      data: {
        conversacionId: conversacion.id,
        direccion: 'INCOMING',
        remitente: 'CLIENTE',
        contenido,
        tipoMensaje: 'TEXT',
        estadoEntrega: 'DELIVERED',
        ...(waChatId ? { metadata: JSON.stringify({ waChatId }) } : {}),
      },
    });

    // 2. Despertar al Agente IA para analizar contexto, memoria y generar respuesta
    const { respuestaTexto, etapaNueva, actionMetadata } = await this.aiAgentService.procesarRespuestaIA({
      conversacionId: conversacion.id,
      buyerId: buyer.id,
      ultimoMensajeCliente: contenido,
    });

    // 3. Despachar la respuesta de la IA a través de WhatsApp / OpenWA
    const envioResultado = await this.whatsappService.enviarMensaje({
      conversacionId: conversacion.id,
      telefono: buyer.whatsapp,
      contenido: respuestaTexto,
      tipoMensaje: actionMetadata?.tool === 'create_payment_request' ? 'PAYMENT_LINK' : 'TEXT',
      remitente: 'AGENTE_IA',
      metadata: actionMetadata,
    });

    return {
      exito: true,
      conversacionId: conversacion.id,
      etapa: etapaNueva,
      respuestaAgente: respuestaTexto,
      actionMetadata,
      envio: envioResultado,
    };
  }

  /**
   * Obtiene los mensajes y el estado completo de una conversación.
   */
  async getConversacion(id: string) {
    const conversacion = await this.prisma.conversacion.findUnique({
      where: { id },
      include: {
        buyer: { include: { universidad: true, carrera: true } },
        mensajes: { orderBy: { fechaHora: 'asc' } },
        diagnosticos: true,
        propuestas: { include: { servicio: true } },
        objeciones: true,
      },
    });

    if (!conversacion) {
      throw new NotFoundException(`Conversación con ID ${id} no encontrada.`);
    }

    return conversacion;
  }

  /**
   * Limpia completamente el historial de mensajes y reinicia la conversación a fase DISCOVERY
   * y al estudiante a estado LEAD para permitir pruebas continuas y limpias.
   */
  async limpiarConversacion(id: string) {
    const conversacion = await this.prisma.conversacion.findUnique({
      where: { id },
      include: { buyer: true },
    });

    if (!conversacion) {
      throw new NotFoundException(`Conversación con ID ${id} no encontrada.`);
    }

    const buyerId = conversacion.buyerId;

    // 1. Eliminar mensajes de la conversación
    await this.prisma.mensaje.deleteMany({
      where: { conversacionId: id },
    });

    // 2. Eliminar objeciones, diagnósticos y seguimientos de esta conversación
    await this.prisma.objecion.deleteMany({ where: { conversacionId: id } });
    await this.prisma.diagnostico.deleteMany({ where: { conversacionId: id } });
    await this.prisma.seguimiento.deleteMany({ where: { conversacionId: id } });

    // 3. Limpiar registros de pagos y cotizaciones creados en pruebas para este buyer
    try {
      await this.prisma.payer.deleteMany({ where: { buyerId } });
      await this.prisma.pago.deleteMany({ where: { buyerId } });
      await this.prisma.cotizacion.deleteMany({ where: { leadId: buyerId } });
      await this.prisma.propuesta.deleteMany({ where: { conversacionId: id } });
    } catch (e: any) {
      this.logger.warn(`Nota al limpiar entidades secundarias de pago: ${e.message}`);
    }

    // 4. Restablecer la conversación a etapa inicial DISCOVERY
    const conversacionActualizada = await this.prisma.conversacion.update({
      where: { id },
      data: {
        estadoEtapa: 'DISCOVERY',
        fechaUltimaActividad: new Date(),
      },
      include: {
        buyer: { include: { universidad: true, carrera: true } },
        mensajes: true,
      },
    });

    // 5. Restablecer estado de Funnel del Buyer a LEAD
    await this.prisma.buyer.update({
      where: { id: buyerId },
      data: { estadoFunnel: 'LEAD' },
    });

    this.logger.log(`✓ Conversación ${id} y cliente ${buyerId} reiniciados exitosamente a DISCOVERY / LEAD.`);

    return {
      exito: true,
      mensaje: 'Chat reiniciado exitosamente. Puedes iniciar una nueva prueba desde cero.',
      conversacion: conversacionActualizada,
    };
  }

  /**
   * Reinicia la conversación asociada a un buyer por su buyerId.
   */
  async limpiarConversacionPorBuyer(buyerId: string) {
    const conversacion = await this.prisma.conversacion.findFirst({
      where: { buyerId },
      orderBy: { fechaInicio: 'desc' },
    });

    if (!conversacion) {
      // Si no tiene conversación, solo asegurar que su estado sea LEAD
      await this.prisma.buyer.update({
        where: { id: buyerId },
        data: { estadoFunnel: 'LEAD' },
      });
      return {
        exito: true,
        mensaje: 'Estado del prospecto verificado como LEAD. No tenía conversación previa.',
      };
    }

    return this.limpiarConversacion(conversacion.id);
  }
}
