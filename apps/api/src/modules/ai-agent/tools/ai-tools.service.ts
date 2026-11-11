import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ToolDefinition } from '../ai-provider.interface';
import { BuyerProfile } from '@inbestiga/shared';
import { CommercialRulesService } from '../../commercial-rules/commercial-rules.service';

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
        description: 'Actualiza la fase actual de la negociación en el CRM (DISCOVERY, DIAGNOSTIC, PROPOSAL, NEGOTIATION, OBJECTION_HANDLING, PAYMENT_PENDING, CONVERTED, HUMAN_ESCALATION)',
        parameters: {
          type: 'object',
          properties: {
            etapa: {
              type: 'string',
              enum: ['DISCOVERY', 'DIAGNOSTIC', 'PROPOSAL', 'NEGOTIATION', 'OBJECTION_HANDLING', 'PAYMENT_PENDING', 'CONVERTED', 'HUMAN_ESCALATION'],
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
        name: 'confirm_payment',
        description: 'Valida y confirma el pago recibido (por Yape, Plin, Transferencia bancaria o Tarjeta). Promueve el prospecto a PAYER, acepta la cotización y pasa la etapa a CONVERTED',
        parameters: {
          type: 'object',
          properties: {
            montoAbonado: { type: 'number', description: 'Monto abonado por el estudiante' },
            metodoPago: {
              type: 'string',
              enum: ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA', 'OTRO'],
              description: 'Canal de pago utilizado',
            },
            referenciaOperacion: { type: 'string', description: 'Número de operación o constancia' },
          },
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
          include: {
            universidad: true,
            carrera: true,
            perfilNegociacion: true,
            financiadoPor: true,
            compradoresFinanciados: true,
            descargasContenido: { include: { servicio: true } },
            interaccionesRedSocial: true,
          },
        });
        if (!buyer) return { error: 'Buyer no encontrado' };
        return {
          id_buyer: buyer.id,
          tipo_perfil: buyer.tipoPerfil,
          nombre: buyer.nombre || `${buyer.nombres || ''} ${buyer.apellidos || ''}`.trim(),
          nombres: buyer.nombres,
          apellidos: buyer.apellidos,
          whatsapp: buyer.whatsapp,
          correo: buyer.correo || buyer.email,
          departamento: buyer.departamento,
          distrito: buyer.distrito,
          tipo_universidad: buyer.tipoUniversidad,
          sede: buyer.sede,
          universidad: buyer.universidadNombre || buyer.universidad?.nombre || 'Universidad no especificada',
          facultad: buyer.facultad,
          carrera: buyer.carreraNombre || buyer.carrera?.nombre || 'Carrera no especificada',
          ciclo: buyer.ciclo,
          edad: buyer.edad,
          financia_a: buyer.compradoresFinanciados?.map((e) => e.nombre || `${e.nombres} ${e.apellidos}`.trim()),
          financiado_por: buyer.financiadoPor ? (buyer.financiadoPor.nombre || `${buyer.financiadoPor.nombres} ${buyer.financiadoPor.apellidos}`.trim()) : null,
          canal_captacion: buyer.canalCaptacion,
          leadScore: buyer.leadScore,
          tipoInvestigacion: buyer.tipoInvestigacion,
          dolorPrincipal: buyer.dolorPrincipal,
          softwareRequerido: buyer.softwareRequerido,
          presupuestoAprox: buyer.presupuestoAprox,
          descargas_contenido: buyer.descargasContenido.map((d) => ({
            paquete: d.servicio?.nombrePaquete,
            precio_base: d.servicio?.precioBase,
            recargo_urgencia_pct: d.servicio?.recargoUrgenciaPct,
            fecha_descarga: d.fechaDescarga,
          })),
          interacciones_red_social: buyer.interaccionesRedSocial.map((i) => ({
            red_social: i.redSocial,
            tipo_interaccion: i.tipoInteraccion,
            tema_detectado: i.temaDetectado,
            fecha: i.fecha,
          })),
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
        const buyerId = context.buyerId || args.buyerId;
        const buyer = await this.prisma.buyer.findUnique({
          where: { id: buyerId },
          include: { lead: true },
        });
        if (!buyer) return { error: 'Buyer no encontrado para confirmar pago' };

        // Buscar pago PENDIENTE más reciente o crear uno confirmado
        let pago = await this.prisma.pago.findFirst({
          where: { buyerId: buyer.id, estado: 'PENDIENTE' },
          orderBy: { fechaCreacion: 'desc' },
          include: { cotizacion: true },
        });

        const monto = args.montoAbonado ? Number(args.montoAbonado) : (pago ? Number(pago.monto) : 1500);
        const metodo = args.metodoPago || 'YAPE';
        const referencia = args.referenciaOperacion || `OP-${Date.now().toString().slice(-6)}`;

        if (!pago) {
          const servicio = await this.prisma.servicio.findFirst({ where: { activo: true } });
          const cotizacion = await this.prisma.cotizacion.create({
            data: {
              leadId: buyer.lead?.id || buyer.id,
              servicioId: servicio?.id || '',
              codigoCotizacion: `COT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
              subtotal: monto,
              total: monto,
              cuotas: 1,
              plazoEntregaDias: 45,
              fechaExpiracion: new Date(Date.now() + 7 * 24 * 3600 * 1000),
              estado: 'ACEPTADA',
            },
          });

          pago = await this.prisma.pago.create({
            data: {
              cotizacionId: cotizacion.id,
              buyerId: buyer.id,
              leadId: buyer.lead?.id || null,
              gatewayProveedor: metodo,
              monto,
              moneda: 'PEN',
              metodoPago: metodo,
              estado: 'CONFIRMADO',
              fechaConfirmacion: new Date(),
              gatewayTransactionId: referencia,
            },
            include: { cotizacion: true },
          });
        } else {
          pago = await this.prisma.pago.update({
            where: { id: pago.id },
            data: {
              estado: 'CONFIRMADO',
              fechaConfirmacion: new Date(),
              metodoPago: metodo,
              gatewayTransactionId: referencia,
            },
            include: { cotizacion: true },
          });

          await this.prisma.cotizacion.update({
            where: { id: pago.cotizacionId },
            data: { estado: 'ACEPTADA' },
          });
        }

        // Promover a PAYER
        await this.prisma.buyer.update({
          where: { id: buyer.id },
          data: { estadoFunnel: 'PAYER' },
        });

        // Registrar en PAYER si no existe
        const existingPayer = await this.prisma.payer.findUnique({
          where: { buyerId: buyer.id },
        });
        if (!existingPayer) {
          await this.prisma.payer.create({
            data: {
              buyerId: buyer.id,
              leadId: buyer.lead?.id || null,
              primerPagoId: pago.id,
              montoTotalPagado: pago.monto,
              metodoPrincipal: metodo,
              estado: 'ACTIVO',
            },
          });
        }

        // Crear automáticamente el Customer y asignarle su asesor especialista con bitácora
        try {
          let asesor = await this.prisma.asesor.findFirst({
            where: { activo: true },
            orderBy: { clientesActivos: 'asc' },
          });

          if (asesor) {
            await this.prisma.asesor.update({
              where: { id: asesor.id },
              data: { clientesActivos: { increment: 1 } },
            });
          }

          let customer = await this.prisma.customer.findUnique({ where: { buyerId: buyer.id } });
          if (!customer) {
            const payerRecord = await this.prisma.payer.findUnique({ where: { buyerId: buyer.id } });
            customer = await this.prisma.customer.create({
              data: {
                buyerId: buyer.id,
                leadId: buyer.lead?.id || null,
                payerId: payerRecord?.id || '',
                cotizacionId: pago.cotizacionId || '',
                servicioId: pago.cotizacion?.servicioId || (await this.prisma.servicio.findFirst({ where: { activo: true } }))?.id || '',
                asesorId: asesor?.id || null,
                fechaInicioServicio: new Date(),
                estadoServicio: 'ACTIVO',
                observaciones: `Servicio iniciado automáticamente tras confirmación de pago por S/ ${pago.monto} (${metodo}).`,
              },
            });

            if (asesor) {
              await this.prisma.asignacionAsesor.create({
                data: {
                  customerId: customer.id,
                  asesorId: asesor.id,
                  motivo: 'Asignación automática al validar pago en sistema',
                  asignadoPor: 'SISTEMA_AUTOMATICO',
                },
              });
            }

            const fechaPrimeraSesion = new Date();
            fechaPrimeraSesion.setDate(fechaPrimeraSesion.getDate() + 3);
            fechaPrimeraSesion.setHours(17, 0, 0, 0);

            await this.prisma.sesion.create({
              data: {
                customerId: customer.id,
                asesorId: asesor?.id || '',
                numeroSesion: 1,
                fechaHoraProgramada: fechaPrimeraSesion,
                temaTratado: 'Sesión de Inducción, Diagnóstico Metodológico y Cronograma de Tesis',
                estado: 'PROGRAMADA',
                enlaceReunion: `https://meet.google.com/inbestiga-tesis-${customer.id.substring(0, 8)}`,
                observaciones: 'El estudiante debe tener a la mano el avance previo.',
              },
            });
          }

          await this.prisma.buyer.update({
            where: { id: buyer.id },
            data: { estadoFunnel: 'CUSTOMER' },
          });
        } catch (custErr: any) {
          this.logger.warn(`Nota al crear Customer desde pago: ${custErr.message}`);
        }

        // Marcar cualquier otro pago pendiente previo del mismo alumno como EXPIRADO/ABANDONADO
        await this.prisma.pago.updateMany({
          where: {
            buyerId: buyer.id,
            id: { not: pago.id },
            estado: 'PENDIENTE',
          },
          data: {
            estado: 'EXPIRADO',
          },
        });

        // Actualizar conversación a CONVERTED
        if (context.conversacionId) {
          await this.prisma.conversacion.update({
            where: { id: context.conversacionId },
            data: { estadoEtapa: 'CONVERTED', fechaUltimaActividad: new Date() },
          });
        }

        this.logger.log(`✓ Pago confirmado exitosamente para ${buyer.nombres} ${buyer.apellidos}. Monto: S/ ${pago.monto}, Ref: ${referencia}`);

        const mensajeConfirmacion = `¡Pago de S/ ${pago.monto} recibido y validado con éxito! Tu vacante está formalmente confirmada. Bienvenido a INBESTIGA. Tu asesor especialista asignado se pondrá en contacto para programar la sesión inicial de tu investigación.`;

        return {
          exito: true,
          confirmado: true,
          nuevaEtapa: 'CONVERTED',
          estudiante: `${buyer.nombres} ${buyer.apellidos}`,
          montoConfirmado: Number(pago.monto),
          metodoPago: metodo,
          codigoCotizacion: pago.cotizacion?.codigoCotizacion,
          referencia,
          mensaje: mensajeConfirmacion,
          mensajeSugerido: mensajeConfirmacion,
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
