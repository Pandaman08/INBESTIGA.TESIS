import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ToolDefinition } from '../ai-provider.interface';
import { BuyerProfile } from '@inbestiga/shared';
import { CommercialRulesService } from '../../commercial-rules/commercial-rules.service';

/** Etapas que el agente puede fijar. PAYMENT_PENDING/CONVERTED solo los fija el flujo de PAYERS. */
const ETAPAS_PERMITIDAS_IA = ['DISCOVERY', 'DIAGNOSTIC', 'PROPOSAL', 'NEGOTIATION', 'OBJECTION_HANDLING', 'HUMAN_ESCALATION'];

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesService: CommercialRulesService,
  ) {}

  /**
   * Retorna las definiciones JSON Schema de las herramientas permitidas para el LLM.
   */
  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'get_buyer_profile',
        description: 'Obtiene el perfil académico completo del estudiante (universidad, carrera, dolor principal, presupuesto)',
        parameters: {
          type: 'object',
          properties: {
            buyerId: { type: 'string', description: 'ID único del BUYER o LEAD' },
          },
          required: ['buyerId'],
        },
      },
      {
        name: 'get_available_services',
        description: 'Consulta el catálogo de servicios de tesis vigentes y sus precios oficiales de lista',
        parameters: {
          type: 'object',
          properties: {
            tipoInvestigacion: {
              type: 'string',
              description: 'Filtro opcional por tipo de investigación (TESIS, PLAN_DE_TESIS)',
            },
          },
        },
      },
      {
        name: 'calculate_offer',
        description: 'Calcula y valida matemáticamente una oferta con descuento o facilidades de pago ante el Motor de Reglas Comerciales',
        parameters: {
          type: 'object',
          properties: {
            buyerId: { type: 'string', description: 'ID del estudiante (opcional, se toma del contexto)' },
            servicioId: { type: 'string', description: 'ID del servicio a cotizar (opcional)' },
            descuentoPropuestoPct: { type: 'number', description: 'Porcentaje de descuento propuesto (máx 15%)' },
            numeroCuotas: { type: 'number', description: 'Número de cuotas mensuales (1 a 3)' },
          },
        },
      },
      {
        name: 'record_objection',
        description: 'Registra formalmente una objeción planteada por el estudiante (precio, tiempo, confianza, método de pago)',
        parameters: {
          type: 'object',
          properties: {
            conversacionId: { type: 'string', description: 'ID de conversación (opcional)' },
            tipo: { type: 'string', enum: ['PRECIO', 'TIEMPO', 'CONFIANZA', 'COMPARACION', 'METODO_PAGO', 'OTRO'] },
            descripcion: { type: 'string' },
          },
          required: ['tipo', 'descripcion'],
        },
      },
      {
        name: 'update_stage',
        description: 'Actualiza la fase actual de la negociación en el CRM (DISCOVERY, DIAGNOSTIC, PROPOSAL, NEGOTIATION, OBJECTION_HANDLING, HUMAN_ESCALATION). Los estados de pago los define PAYERS',
        parameters: {
          type: 'object',
          properties: {
            etapa: {
              type: 'string',
              enum: ETAPAS_PERMITIDAS_IA,
              description: 'Nueva etapa de la negociación según el avance de la conversación',
            },
            motivo: { type: 'string', description: 'Motivo o resumen del avance de fase' },
          },
          required: ['etapa'],
        },
      },
      {
        name: 'create_payment_request',
        description: 'Genera la cotización oficial y el enlace exclusivo a la pasarela de pagos Culqi (que acepta Yape directo, tarjetas de débito/crédito y PagoEfectivo) cuando el estudiante acepta la propuesta o consulta por medios de pago',
        parameters: {
          type: 'object',
          properties: {
            buyerId: { type: 'string', description: 'ID del estudiante (opcional, se toma del contexto)' },
            servicioId: { type: 'string', description: 'ID del servicio (opcional)' },
            monto: { type: 'number', description: 'Monto total acordado (opcional)' },
            cuotas: { type: 'number', description: 'Número de cuotas acordadas (1 o 2)' },
          },
        },
      },
      {
        name: 'schedule_meeting',
        description: 'Programa formalmente una sesión diagnóstica virtual 1 a 1 por Google Meet entre el estudiante y un asesor especialista, registrándola en el sistema',
        parameters: {
          type: 'object',
          properties: {
            fecha: { type: 'string', description: 'Fecha acordada (ej. "viernes 20 de septiembre" o "este viernes")' },
            hora: { type: 'string', description: 'Hora acordada (ej. "15:00" o "3:00 p.m.")' },
            tema: { type: 'string', description: 'Objetivo de la reunión (ej. "Elección y delimitación de tema de tesis")' },
            modalidad: { type: 'string', description: 'Plataforma (GOOGLE_MEET)' },
          },
          required: ['fecha', 'hora'],
        },
      },
      {
        name: 'escalate_to_human',
        description: 'Deriva la conversación a un asesor humano cuando el estudiante solicita condiciones excepcionales',
        parameters: {
          type: 'object',
          properties: {
            conversacionId: { type: 'string' },
            motivo: { type: 'string' },
          },
          required: ['conversacionId', 'motivo'],
        },
      },
    ];
  }

  /**
   * Ejecuta una herramienta invocada por la IA de manera segura y controlada por el backend.
   */
  async executeTool(name: string, args: Record<string, any>, context: { conversacionId?: string; buyerId?: string }) {
    this.logger.log(`[Tool Execution] Herramienta invocada por IA: ${name} con argumentos: ${JSON.stringify(args)}`);

    switch (name) {
      case 'get_buyer_profile': {
        const id = context.buyerId || args.buyerId;
        const buyer = await this.prisma.buyer.findUnique({
          where: { id },
          include: { universidad: true, carrera: true, perfilNegociacion: true },
        });
        if (!buyer) return { error: 'Buyer no encontrado' };
        return {
          nombres: buyer.nombres,
          apellidos: buyer.apellidos,
          universidad: buyer.universidad?.nombre || 'Universidad no especificada',
          carrera: buyer.carrera?.nombre || 'Carrera no especificada',
          ciclo: buyer.ciclo,
          tipoInvestigacion: buyer.tipoInvestigacion,
          dolorPrincipal: buyer.dolorPrincipal,
          softwareRequerido: buyer.softwareRequerido,
          presupuestoAprox: buyer.presupuestoAprox,
          leadScore: buyer.leadScore,
        };
      }

      case 'get_available_services': {
        const servicios = await this.prisma.servicio.findMany({
          where: { activo: true },
          select: { id: true, nombre: true, codigo: true, precioBase: true, maxCuotas: true, plazoSemanasMin: true },
        });
        const listaTexto = servicios.map((s) => `• *${s.nombre}*: S/ ${s.precioBase} (hasta en ${s.maxCuotas} cuotas)`).join('\n');
        return {
          servicios,
          mensajeSugerido: `Contamos con las siguientes modalidades de asesoría para tu investigación:\n\n${listaTexto}\n\nTodas incluyen acompañamiento 1 a 1 con un asesor Doctor o Magíster y garantía de aprobación. ¿Cuál de estas modalidades se ajusta mejor a tu objetivo actual?`,
        };
      }

      case 'calculate_offer': {
        let servicioId = args.servicioId;
        if (!servicioId) {
          const primerServicio = await this.prisma.servicio.findFirst({ where: { activo: true } });
          servicioId = primerServicio?.id;
        }

        const buyerId = context.buyerId || args.buyerId || '';
        const resultado = await this.rulesService.validarYCalcularOferta({
          buyerId,
          servicioId,
          descuentoPropuestoPct: Number(args.descuentoPropuestoPct || 0),
          numeroCuotas: Number(args.numeroCuotas || 1),
        });

        // Registrar propuesta en la BD
        if (context.conversacionId && resultado.valido) {
          try {
            await this.prisma.propuesta.create({
              data: {
                conversacionId: context.conversacionId,
                servicioId,
                precioOriginal: resultado.precioBase,
                precioPropuesto: resultado.precioFinal,
                descuentoAplicadoPct: resultado.descuentoAplicadoPct,
                numeroCuotas: resultado.numeroCuotas,
                montoPorCuota: resultado.montoPorCuota,
                plazoDias: resultado.plazoSemanas * 7,
                estado: 'ENVIADA',
              },
            });
          } catch (e: any) {
            this.logger.warn(`Nota al registrar propuesta: ${e.message}`);
          }
        }

        const mensajeSugerido = resultado.valido
          ? `Te comento que para tu investigación el servicio de ${resultado.servicioNombre} te queda en S/ ${resultado.precioFinal} (con ${resultado.descuentoAplicadoPct}% de descuento aplicado) y puedes abonarlo en ${resultado.numeroCuotas} cuota(s) de S/ ${resultado.montoPorCuota}. ¿Te parece bien este esquema para coordinar tu inicio con el asesor?`
          : `Hemos consultado la disponibilidad y el precio mínimo autorizado para este servicio es de S/ ${resultado.precioFinal} en ${resultado.numeroCuotas} cuotas de S/ ${resultado.montoPorCuota}. Es el máximo beneficio institucional que podemos otorgar. ¿Deseas que reservemos tu vacante?`;

        return { ...resultado, mensajeSugerido, nuevaEtapa: 'NEGOTIATION' };
      }

      case 'record_objection': {
        const conversacionId = context.conversacionId || args.conversacionId;
        if (conversacionId) {
          try {
            await this.prisma.objecion.create({
              data: {
                conversacionId,
                tipo: args.tipo || 'PRECIO',
                descripcion: args.descripcion || 'Objeción registrada por el estudiante',
                resuelta: false,
              },
            });
          } catch (e: any) {
            this.logger.warn(`No se pudo persistir objeción en BD: ${e.message}`);
          }
        }
        return {
          registrado: true,
          nuevaEtapa: 'OBJECTION_HANDLING',
          guiaRespuesta:
            args.tipo === 'PRECIO'
              ? 'Ofrece facilidades de pago en cuotas (hasta 3 cuotas) o un 10% de descuento institucional para su universidad.'
              : 'Enfatiza que el asesor asignado tiene experiencia comprobada en su universidad y carrera.',
        };
      }

      case 'update_stage': {
        const etapa = args.etapa;
        if (!ETAPAS_PERMITIDAS_IA.includes(etapa)) {
          return { actualizado: false, error: `Etapa no permitida para el agente: ${etapa}` };
        }
        if (context.conversacionId && etapa) {
          await this.prisma.conversacion.update({
            where: { id: context.conversacionId },
            data: { estadoEtapa: etapa, fechaUltimaActividad: new Date() },
          });
        }
        return {
          actualizado: true,
          nuevaEtapa: etapa,
          motivo: args.motivo || 'Actualización de fase por flujo de conversación',
        };
      }

      case 'schedule_meeting': {
        const buyerId = context.buyerId || args.buyerId;
        const buyer = await this.prisma.buyer.findUnique({
          where: { id: buyerId },
          include: { lead: true, carrera: true, universidad: true },
        });

        // Buscar asesor afín a la carrera del estudiante
        let asesor = await this.prisma.asesor.findFirst({
          where: { activo: true },
          orderBy: { clientesActivos: 'asc' },
        });

        if (!asesor) {
          asesor = await this.prisma.asesor.findFirst();
        }

        // Generar enlace único y funcional de Google Meet (formato estándar de 10 caracteres: 3-4-3)
        const generateRoomCode = () => {
          const chars = 'abcdefghijklmnopqrstuvwxyz';
          const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
          return `${rand(3)}-${rand(4)}-${rand(3)}`;
        };
        const meetCode = generateRoomCode();
        const meetUrl = `https://meet.google.com/${meetCode}`;

        // Registrar la sesión en la base de datos si ya existe Customer
        try {
          const customer = await this.prisma.customer.findFirst({
            where: { buyerId: buyer?.id },
          });

          if (customer && asesor) {
            await this.prisma.sesion.create({
              data: {
                customerId: customer.id,
                asesorId: asesor.id,
                numeroSesion: 1,
                fechaHoraProgramada: new Date(),
                temaTratado: args.tema || 'Sesión Diagnóstica: Elección y delimitación de tema de tesis',
                estado: 'PROGRAMADA',
                enlaceReunion: meetUrl,
                observaciones: `Videollamada agendada por IA para ${args.fecha} a las ${args.hora}`,
              },
            });
          }
        } catch (err: any) {
          this.logger.warn(`Nota al registrar sesión diagnóstica: ${err.message}`);
        }

        // Actualizar etapa de la conversación a DIAGNOSTIC
        if (context.conversacionId) {
          await this.prisma.conversacion.update({
            where: { id: context.conversacionId },
            data: { estadoEtapa: 'DIAGNOSTIC', fechaUltimaActividad: new Date() },
          });

          await this.prisma.notificacion.create({
            data: {
              tipo: 'SESION_PROGRAMADA',
              titulo: `Videollamada Google Meet Agendada: ${buyer?.nombres || 'Estudiante'}`,
              mensaje: `Sesión diagnóstica para ${args.fecha} a las ${args.hora}. Sala: ${meetUrl}`,
              metadata: JSON.stringify({ buyerId, fecha: args.fecha, hora: args.hora, meetUrl }),
            },
          });
        }

        const nombreEstudiante = buyer?.nombres || 'estimado estudiante';
        const diaHoraTexto = `${args.fecha} a las ${args.hora}`;
        const mensajeSugerido = `¡Perfecto, ${nombreEstudiante}! 🙌\n\nConfirmo nuestra sesión diagnóstica virtual para el *${diaHoraTexto}* (hora de Perú).\n\n🔗 *Enlace de la videollamada (Google Meet):*\n${meetUrl}\n\nEn esta reunión de 30 minutos revisaremos tus áreas de interés, delimitaremos un problema viable para la ${buyer?.universidad?.siglas || 'universidad'} y definiremos el tema ideal para tu tesis.\n\nTe enviaremos un recordatorio previo. ¡Nos vemos en la videollamada! 🚀`;

        return {
          agendado: true,
          fecha: args.fecha,
          hora: args.hora,
          tema: args.tema,
          enlaceMeet: meetUrl,
          asesor: asesor ? `${asesor.nombres} ${asesor.apellidos}` : 'Asesor Especialista',
          nuevaEtapa: 'DIAGNOSTIC',
          mensajeSugerido,
        };
      }

      case 'create_payment_request': {
        const buyerId = context.buyerId || args.buyerId;
        const buyer = await this.prisma.buyer.findUnique({
          where: { id: buyerId },
          include: { lead: true },
        });
        if (!buyer) return { error: 'Buyer no encontrado para generar pago' };

        // 1. Identificar el servicio adecuado:
        // Primero, si se pasó args.servicioId, buscar por ID, código o nombre
        let servicio: any = null;
        if (args.servicioId) {
          servicio = await this.prisma.servicio.findFirst({
            where: {
              OR: [
                { id: args.servicioId },
                { codigo: { contains: args.servicioId } },
                { nombre: { contains: args.servicioId } },
              ],
            },
          });
        }

        // Si no se encontró por args.servicioId, buscar si hubo una propuesta previa
        if (!servicio) {
          const ultimaPropuesta = await this.prisma.propuesta.findFirst({
            where: { conversacionId: context.conversacionId },
            orderBy: { fechaCreacion: 'desc' },
            include: { servicio: true },
          });
          servicio = ultimaPropuesta?.servicio;
        }

        // Si aún no hay servicio específico, buscar Asesoría Integral por defecto para tesis
        if (!servicio) {
          servicio = await this.prisma.servicio.findFirst({
            where: { codigo: 'TESIS_INTEGRAL', activo: true },
          }) || (await this.prisma.servicio.findFirst({ where: { activo: true } }));
        }

        if (!servicio) return { error: 'No hay servicios disponibles' };

        // 2. Determinar montos con consistencia
        const subtotal = Number(servicio.precioBase);
        // Si args.monto vino explícito desde el chat (ej. 2200), respetarlo
        let total = args.monto && Number(args.monto) > 0 ? Number(args.monto) : subtotal;

        // Si no se pasó monto explícito, revisar si había una propuesta con descuento previo
        if (!args.monto) {
          const ultimaProp = await this.prisma.propuesta.findFirst({
            where: { conversacionId: context.conversacionId, servicioId: servicio.id },
            orderBy: { fechaCreacion: 'desc' },
          });
          if (ultimaProp) {
            total = Number(ultimaProp.precioPropuesto);
          }
        }

        const descuento = Math.max(0, subtotal - total);
        const cuotas = Number(args.cuotas || 1);
        const codigoCotizacion = `COT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

        // Crear cotización oficial en base de datos
        const cotizacion = await this.prisma.cotizacion.create({
          data: {
            leadId: buyer.lead?.id || buyer.id,
            servicioId: servicio.id,
            codigoCotizacion,
            subtotal,
            descuento,
            total,
            cuotas,
            plazoEntregaDias: 45,
            fechaExpiracion: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 días
            estado: 'ACTIVA',
          },
        });

        // Crear orden de Pago PENDIENTE
        const pago = await this.prisma.pago.create({
          data: {
            cotizacionId: cotizacion.id,
            buyerId: buyer.id,
            leadId: buyer.lead?.id || null,
            gatewayProveedor: process.env.PAYMENT_PROVIDER || 'CULQI',
            monto: total,
            moneda: 'PEN',
            metodoPago: 'CARD',
            estado: 'PENDIENTE',
          },
        });

        const culqiExpressUrl = 'https://express.culqi.com/pago/1E696A426C';

        this.logger.log(`Enlace de pago oficial Culqi generado con éxito: ${culqiExpressUrl} (Servicio: ${servicio.nombre}, Monto: S/ ${total}, Cotización: ${codigoCotizacion})`);

        const mensajeSugerido = `¡Excelente decisión! Hemos formalizado tu cotización oficial ${codigoCotizacion} para ${servicio.nombre} por S/ ${total} en ${cuotas} cuota(s).

Para tu comodidad y seguridad, nuestro único medio de pago oficial es la pasarela de Culqi:
👉 ${culqiExpressUrl}

La pasarela de Culqi te permite pagar fácilmente con el método de tu preferencia: Yape directo, tarjetas de débito o crédito (Visa, Mastercard, AMEX) o PagoEfectivo, todo en un solo enlace seguro. Al completar tu pago, el sistema lo confirmará automáticamente para darte la bienvenida y coordinar la primera sesión con tu asesor especialista.`;

        return {
          cotizacionId: cotizacion.id,
          codigoCotizacion,
          pagoId: pago.id,
          servicio: servicio.nombre,
          subtotal,
          descuento,
          montoTotal: total,
          cuotas,
          medioPagoOficial: 'Pasarela Culqi (Única opción autorizada)',
          enlaceCulqi: culqiExpressUrl,
          nuevaEtapa: 'PAYMENT_PENDING',
          metodosPago: {
            pasarelaOficialCulqi: culqiExpressUrl,
            descripcion: 'Pasarela oficial Culqi (integra Yape directo, Tarjetas de Débito/Crédito y PagoEfectivo)',
            opcionExclusiva: 'Únicamente pasarela de pagos Culqi. No se proporcionan números personales ni transferencias manuales.',
            titular: 'INBESTIGA ASESORÍA ACADÉMICA S.A.C.',
          },
          mensajeSugerido,
        };
      }

      case 'confirm_payment': {
        // Frontera LEADS/PAYERS: un mensaje del estudiante ("ya pagué") NUNCA acredita un pago,
        // ni crea PAYER/CUSTOMER. La confirmación llega solo desde PAYERS (webhook de la pasarela).
        this.logger.warn('Intento de confirm_payment bloqueado: LEADS no confirma pagos.');
        return {
          exito: false,
          bloqueado: true,
          mensajeSugerido:
            'Gracias por avisarnos. La confirmación del pago la realiza nuestra área de pagos cuando la pasarela valida la transacción; te avisaremos apenas esté verificada.',
        };
      }
      case 'escalate_to_human': {
        if (context.conversacionId) {
          await this.prisma.conversacion.update({
            where: { id: context.conversacionId },
            data: { estadoEtapa: 'HUMAN_ESCALATION' },
          });

          await this.prisma.notificacion.create({
            data: {
              tipo: 'ESCALACION_HUMANA',
              titulo: 'Intervención requerida en negociación',
              mensaje: `El estudiante solicitó escalamiento: ${args.motivo || 'Condiciones comerciales especiales'}`,
            },
          });
        }
        return { escalado: true, nuevaEtapa: 'HUMAN_ESCALATION', mensaje: 'Un asesor humano continuará la atención en breve.' };
      }

      default:
        return { error: `Herramienta desconocida: ${name}` };
    }
  }
}
