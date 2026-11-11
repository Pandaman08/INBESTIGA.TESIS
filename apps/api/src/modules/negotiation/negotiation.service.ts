import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiAgentService } from '../ai-agent/ai-agent.service';
import { WhatsAppService, CanalMensaje } from '../whatsapp/whatsapp.service';
import { esBuyerFicticio, evaluarEnvioWhatsApp } from '../../common/contact-policy';
import { OportunidadesService } from '../leads/oportunidades/oportunidades.service';

/** Tipo de notificación usado como bandeja de cuarentena de remitentes no identificados. */
export const NOTIF_CUARENTENA_WHATSAPP = 'WHATSAPP_REMITENTE_NO_IDENTIFICADO';

type BuyerMin = {
  id: string;
  nombres: string;
  apellidos: string;
  email: string;
  whatsapp: string;
  consentimientoWhatsapp: boolean;
};

@Injectable()
export class NegotiationService {
  private readonly logger = new Logger(NegotiationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAgentService: AiAgentService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsappService: WhatsAppService,
    private readonly oportunidades: OportunidadesService,
  ) {}

  /**
   * ACCIÓN CENTRAL: [ INICIAR NEGOCIACIÓN ]
   * El agente IA redacta el primer mensaje personalizado. Se envía por WhatsApp solo si
   * el BUYER tiene consentimiento vigente (y, si es ficticio, un número de prueba autorizado);
   * en caso contrario queda registrado como LOCAL_ONLY, sin afirmar un envío.
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

    const conversacion = await this.obtenerOCrearConversacion(buyer.id, buyer.lead?.id ?? null);

    const mensajeInicial = await this.aiAgentService.generarMensajeInicial(buyer.id);

    const politica = evaluarEnvioWhatsApp(buyer);
    const envioResultado = await this.whatsappService.enviarMensaje({
      conversacionId: conversacion.id,
      telefono: buyer.whatsapp,
      contenido: mensajeInicial,
      tipoMensaje: 'TEXT',
      remitente: 'AGENTE_IA',
      metadata: { accion: 'INICIO_NEGOCIACION', score: buyer.leadScore },
      canal: 'WHATSAPP',
      motivoLocal: politica.permitido ? undefined : politica.motivo,
    });

    await this.prisma.conversacion.update({
      where: { id: conversacion.id },
      data: { estadoEtapa: 'DIAGNOSTIC', fechaUltimaActividad: new Date() },
    });

    await this.prisma.notificacion.create({
      data: {
        tipo: 'NEGOCIACION_INICIADA',
        titulo: `Negociación iniciada con ${buyer.nombres}`,
        mensaje:
          envioResultado.estado === 'SENT' || envioResultado.estado === 'QUEUED'
            ? `El Agente IA envió el primer mensaje por WhatsApp (${envioResultado.estado}).`
            : `El primer mensaje quedó registrado sin enviarse (${envioResultado.estado}${envioResultado.error ? `: ${envioResultado.error}` : ''}).`,
        metadata: JSON.stringify({ buyerId: buyer.id, conversacionId: conversacion.id, estadoEntrega: envioResultado.estado }),
      },
    });

    return {
      exito: envioResultado.exito,
      conversacionId: conversacion.id,
      buyerId: buyer.id,
      estudiante: `${buyer.nombres} ${buyer.apellidos}`,
      estadoEtapa: 'DIAGNOSTIC',
      mensajeInicial,
      envio: envioResultado,
    };
  }

  /**
   * Mensaje entrante REAL de WhatsApp (webhook OpenWA).
   * Solo se atiende si el remitente corresponde a UN único BUYER; si no hay coincidencia
   * inequívoca, el mensaje va a cuarentena para revisión humana y no se responde.
   */
  async procesarMensajeEstudiante(telefono: string, contenido: string, opts: { waChatId?: string } = {}) {
    const waChatId = opts.waChatId;
    const identificacion = await this.identificarRemitente(telefono, waChatId);

    if (identificacion.tipo !== 'UNICO') {
      await this.enviarACuarentena({ telefono, waChatId, contenido, motivo: identificacion.tipo, candidatos: identificacion.candidatos });
      return { exito: false, estado: 'CUARENTENA', motivo: identificacion.tipo };
    }

    const buyer = identificacion.buyer;
    const politica = evaluarEnvioWhatsApp(buyer);
    return this.atenderMensaje(buyer, contenido, {
      canal: 'WHATSAPP',
      remitenteEntrada: 'CLIENTE',
      metadataEntrada: { canal: 'WHATSAPP', ...(waChatId ? { waChatId } : {}) },
      motivoLocal: politica.permitido ? undefined : politica.motivo,
    });
  }

  /**
   * Conversación de PRUEBA desde el panel (CHAT_WEB_INTERNO): el administrador escribe como
   * estudiante de prueba. Nada sale por WhatsApp; todo queda LOCAL_ONLY y el mensaje de entrada
   * se registra con actor ADMIN_TEST y el usuario real que lo escribió.
   */
  async procesarMensajePrueba(params: {
    conversacionId?: string;
    buyerId?: string;
    telefono?: string;
    contenido: string;
    actorUsuarioId?: string;
  }) {
    const contenido = (params.contenido || '').trim();
    if (!contenido) throw new BadRequestException('El mensaje está vacío.');

    let buyer: BuyerMin | null = null;
    if (params.conversacionId) {
      const conv = await this.prisma.conversacion.findUnique({ where: { id: params.conversacionId }, include: { buyer: true } });
      buyer = conv?.buyer ?? null;
    } else if (params.buyerId) {
      buyer = await this.prisma.buyer.findUnique({ where: { id: params.buyerId } });
    } else if (params.telefono) {
      // Compatibilidad con el cliente web anterior: solo si el número identifica a UN buyer.
      const ident = await this.identificarRemitente(params.telefono);
      if (ident.tipo === 'UNICO') buyer = ident.buyer;
      else throw new BadRequestException('El teléfono no identifica a un único estudiante; envíe conversacionId o buyerId.');
    }
    if (!buyer) throw new NotFoundException('Estudiante o conversación no encontrados.');

    return this.atenderMensaje(buyer, contenido, {
      canal: 'CHAT_WEB_INTERNO',
      remitenteEntrada: 'ADMIN_TEST',
      metadataEntrada: { canal: 'CHAT_WEB_INTERNO', actor: 'ADMIN_TEST', actorUsuarioId: params.actorUsuarioId ?? null },
    });
  }

  /** Núcleo común: persiste la entrada, invoca al agente IA y registra/envía la respuesta. */
  private async atenderMensaje(
    buyer: BuyerMin,
    contenido: string,
    opts: { canal: CanalMensaje; remitenteEntrada: 'CLIENTE' | 'ADMIN_TEST'; metadataEntrada: Record<string, any>; motivoLocal?: string },
  ) {
    const lead = await this.prisma.lead.findUnique({ where: { buyerId: buyer.id }, select: { id: true } });
    const conversacion = await this.obtenerOCrearConversacion(buyer.id, lead?.id ?? null);

    await this.prisma.mensaje.create({
      data: {
        conversacionId: conversacion.id,
        direccion: 'INCOMING',
        remitente: opts.remitenteEntrada,
        contenido,
        tipoMensaje: 'TEXT',
        estadoEntrega: opts.canal === 'CHAT_WEB_INTERNO' ? 'LOCAL_ONLY' : 'DELIVERED',
        metadata: JSON.stringify(opts.metadataEntrada),
      },
    });

    const { respuestaTexto, etapaNueva, actionMetadata } = await this.aiAgentService.procesarRespuestaIA({
      conversacionId: conversacion.id,
      buyerId: buyer.id,
      ultimoMensajeCliente: contenido,
    });

    const envioResultado = await this.whatsappService.enviarMensaje({
      conversacionId: conversacion.id,
      telefono: buyer.whatsapp,
      contenido: respuestaTexto,
      tipoMensaje: actionMetadata?.tool === 'create_payment_request' ? 'PAYMENT_LINK' : 'TEXT',
      remitente: 'AGENTE_IA',
      metadata: actionMetadata,
      canal: opts.canal,
      motivoLocal: opts.motivoLocal,
    });

    return {
      exito: true,
      canal: opts.canal,
      conversacionId: conversacion.id,
      etapa: etapaNueva,
      respuestaAgente: respuestaTexto,
      actionMetadata,
      envio: envioResultado,
    };
  }

  /**
   * Identifica al BUYER de un remitente de WhatsApp de forma inequívoca:
   *  1) por número normalizado (con/sin código 51) → debe existir exactamente un BUYER;
   *  2) si no, por el chatId (@lid) ya vinculado a un mensaje entrante previo de un único BUYER.
   */
  async identificarRemitente(
    telefono: string,
    waChatId?: string,
  ): Promise<
    | { tipo: 'UNICO'; buyer: BuyerMin; candidatos?: undefined }
    | { tipo: 'NO_REGISTRADO'; candidatos?: undefined }
    | { tipo: 'AMBIGUO'; candidatos: string[] }
  > {
    const digits = (telefono || '').replace(/\D/g, '');
    const variantes = new Set<string>();
    if (digits.length >= 9) {
      variantes.add(digits);
      if (digits.startsWith('51') && digits.length === 11) variantes.add(digits.substring(2));
      if (digits.length === 9) variantes.add(`51${digits}`);
    }

    if (variantes.size > 0) {
      const porTelefono = await this.prisma.buyer.findMany({
        where: { whatsapp: { in: [...variantes] } },
        take: 5,
      });
      if (porTelefono.length === 1) return { tipo: 'UNICO', buyer: porTelefono[0] };
      if (porTelefono.length > 1) return { tipo: 'AMBIGUO', candidatos: porTelefono.map((b) => b.id) };
    }

    if (waChatId) {
      const previos = await this.prisma.mensaje.findMany({
        where: { direccion: 'INCOMING', metadata: { contains: `"waChatId":"${waChatId}"` } },
        select: { conversacion: { select: { buyerId: true } } },
        take: 50,
      });
      const ids = [...new Set(previos.map((m) => m.conversacion.buyerId))];
      if (ids.length === 1) {
        const buyer = await this.prisma.buyer.findUnique({ where: { id: ids[0] } });
        if (buyer) return { tipo: 'UNICO', buyer };
      }
      if (ids.length > 1) return { tipo: 'AMBIGUO', candidatos: ids };
    }

    return { tipo: 'NO_REGISTRADO' };
  }

  /** Registra el mensaje en la bandeja de revisión humana. No responde al remitente. */
  private async enviarACuarentena(p: { telefono: string; waChatId?: string; contenido: string; motivo: string; candidatos?: string[] }) {
    this.logger.warn(
      `Remitente de WhatsApp en cuarentena (${p.motivo}). ` +
        (p.waChatId?.endsWith('@lid') ? 'Active RESOLVE_LID_TO_PHONE=true en OpenWA para resolver el teléfono.' : ''),
    );
    await this.prisma.notificacion.create({
      data: {
        tipo: NOTIF_CUARENTENA_WHATSAPP,
        titulo: p.motivo === 'AMBIGUO' ? 'Mensaje de WhatsApp con remitente ambiguo' : 'Mensaje de WhatsApp de remitente no registrado',
        mensaje: p.contenido.substring(0, 500),
        metadata: JSON.stringify({
          motivo: p.motivo,
          waChatId: p.waChatId ?? null,
          telefono: (p.telefono || '').replace(/\D/g, ''),
          candidatos: p.candidatos ?? [],
        }),
      },
    });
  }

  async listarCuarentena() {
    return this.prisma.notificacion.findMany({
      where: { tipo: NOTIF_CUARENTENA_WHATSAPP },
      orderBy: { fechaCreacion: 'desc' },
      take: 200,
    });
  }

  /**
   * Conversación vigente del estudiante, vinculada a su oportunidad abierta de LEADS.
   * Si el BUYER ya es LEAD, se asegura (idempotente) una oportunidad abierta y la conversación
   * queda asociada a ella; si la oportunidad anterior se cerró, se usa una conversación nueva.
   */
  private async obtenerOCrearConversacion(buyerId: string, leadId: string | null) {
    const oportunidadId = leadId
      ? (await this.oportunidades.abrirParaLead(leadId, { tipo: 'SISTEMA' })).oportunidad.id
      : null;

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
   * Reinicio SEGURO de una conversación de prueba.
   * Solo procede si:
   *  - el reinicio de sandbox está habilitado (LEADS_SANDBOX_RESET_ENABLED, por defecto solo fuera de producción);
   *  - el BUYER es ficticio (dominio de email reservado, ver contact-policy);
   *  - el BUYER no tiene registros de PAYERS/CUSTOMERS (PAYER, PAGO, COTIZACION, CUSTOMER).
   * Solo borra datos propios de LEADS de esa conversación. Nunca toca PAYERS ni CUSTOMERS.
   */
  async limpiarConversacion(id: string) {
    const conversacion = await this.prisma.conversacion.findUnique({
      where: { id },
      include: { buyer: true },
    });
    if (!conversacion) {
      throw new NotFoundException(`Conversación con ID ${id} no encontrada.`);
    }

    await this.verificarResetPermitido(conversacion.buyer);

    const propuestasIds = (
      await this.prisma.propuesta.findMany({ where: { conversacionId: id }, select: { id: true } })
    ).map((p) => p.id);

    await this.prisma.$transaction([
      this.prisma.mensaje.deleteMany({ where: { conversacionId: id } }),
      this.prisma.objecion.deleteMany({ where: { conversacionId: id } }),
      this.prisma.diagnostico.deleteMany({ where: { conversacionId: id } }),
      this.prisma.seguimiento.deleteMany({ where: { conversacionId: id } }),
      this.prisma.propuesta.deleteMany({ where: { id: { in: propuestasIds } } }),
      this.prisma.conversacion.update({
        where: { id },
        data: { estadoEtapa: 'DISCOVERY', fechaUltimaActividad: new Date() },
      }),
    ]);

    // La oportunidad no se borra: se cierra como DESCARTADA y la próxima interacción abre un ciclo nuevo.
    if (conversacion.oportunidadId) {
      const op = await this.prisma.oportunidadComercial.findUnique({ where: { id: conversacion.oportunidadId } });
      if (op && !op.fechaCierre) {
        await this.oportunidades.transicionar(op.id, 'DESCARTADA', { tipo: 'SISTEMA' }, 'REINICIO_SANDBOX: conversación de prueba reiniciada');
      }
      await this.prisma.conversacion.update({ where: { id }, data: { oportunidadId: null } });
    }

    this.logger.log(`✓ Conversación de prueba ${id} reiniciada (solo datos LEADS).`);

    return {
      exito: true,
      mensaje: 'Conversación de prueba reiniciada. Solo se eliminaron datos de LEADS de este estudiante ficticio.',
      conversacion: await this.getConversacion(id),
    };
  }

  /**
   * Reinicia la conversación asociada a un buyer por su buyerId (mismas restricciones).
   */
  async limpiarConversacionPorBuyer(buyerId: string) {
    const buyer = await this.prisma.buyer.findUnique({ where: { id: buyerId } });
    if (!buyer) throw new NotFoundException('Estudiante no encontrado.');

    const conversacion = await this.prisma.conversacion.findFirst({
      where: { buyerId },
      orderBy: { fechaInicio: 'desc' },
    });

    if (!conversacion) {
      await this.verificarResetPermitido(buyer);
      return { exito: true, mensaje: 'El estudiante de prueba no tenía conversación previa.' };
    }

    return this.limpiarConversacion(conversacion.id);
  }

  private async verificarResetPermitido(buyer: { id: string; email: string }) {
    const habilitado = (process.env.LEADS_SANDBOX_RESET_ENABLED ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true';
    if (!habilitado) {
      throw new ForbiddenException('El reinicio de conversaciones de prueba está deshabilitado en este entorno.');
    }
    if (!esBuyerFicticio(buyer)) {
      throw new ForbiddenException(
        'Solo se pueden reiniciar estudiantes FICTICIOS (email con dominio de prueba, p. ej. @demo.inbestiga.test). Este registro se considera real.',
      );
    }
    const [payer, pagos, cotizaciones, customer, transferencias] = await Promise.all([
      this.prisma.payer.count({ where: { buyerId: buyer.id } }),
      this.prisma.pago.count({ where: { buyerId: buyer.id } }),
      this.prisma.cotizacion.count({ where: { lead: { buyerId: buyer.id } } }),
      this.prisma.customer.count({ where: { buyerId: buyer.id } }),
      this.prisma.transferenciaPayer.count({ where: { oportunidad: { lead: { buyerId: buyer.id } } } }),
    ]);
    if (payer + pagos + cotizaciones + customer + transferencias > 0) {
      throw new ConflictException(
        'El estudiante ya tiene registros de PAYERS/CUSTOMERS (cotización, pago, payer o customer). LEADS no los borra; reinicio rechazado.',
      );
    }
  }
}
