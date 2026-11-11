import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { CreateBuyerFormDto } from './dto/create-buyer-form.dto';

@Injectable()
export class BuyersService {
  private readonly logger = new Logger(BuyersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoringService: ScoringService,
  ) {}

  /**
   * Lista todos los BUYERS ordenados por defecto por Lead Score DESCendente.
   */
  async findAll(query: {
    search?: string;
    universidadId?: string;
    carreraId?: string;
    estadoFunnel?: string;
    tipoPerfil?: string;
    orderBy?: 'leadScore' | 'fechaRegistro';
    orderDir?: 'asc' | 'desc';
  }) {
    const {
      search,
      universidadId,
      carreraId,
      estadoFunnel,
      tipoPerfil,
      orderBy = 'leadScore',
      orderDir = 'desc',
    } = query;

    const where: any = {};

    if (universidadId) where.universidadId = universidadId;
    if (carreraId) where.carreraId = carreraId;
    if (estadoFunnel) where.estadoFunnel = estadoFunnel;
    if (tipoPerfil) where.tipoPerfil = tipoPerfil;

    if (search && search.trim().length > 0) {
      where.OR = [
        { nombre: { contains: search } },
        { nombres: { contains: search } },
        { apellidos: { contains: search } },
        { email: { contains: search } },
        { correo: { contains: search } },
        { whatsapp: { contains: search } },
        { universidadNombre: { contains: search } },
        { carreraNombre: { contains: search } },
      ];
    }

    const buyers = await this.prisma.buyer.findMany({
      where,
      orderBy: { [orderBy]: orderDir },
      include: {
        universidad: { select: { id: true, nombre: true, siglas: true, ciudad: true } },
        carrera: { select: { id: true, nombre: true, facultad: true } },
        ubicacion: true,
        canal: { select: { id: true, nombre: true, codigo: true } },
        financiadoPor: { select: { id: true, nombre: true, nombres: true, apellidos: true, whatsapp: true, tipoPerfil: true } },
        compradoresFinanciados: { select: { id: true, nombre: true, nombres: true, apellidos: true, whatsapp: true, tipoPerfil: true } },
        descargasContenido: { include: { servicio: true }, orderBy: { fechaDescarga: 'desc' } },
        interaccionesRedSocial: { orderBy: { fecha: 'desc' } },
        lead: { select: { id: true, scoreCalificado: true, prioridad: true, umbralSuperado: true, criterioCalificacion: true } },
        conversaciones: {
          select: { id: true, estadoEtapa: true, fechaUltimaActividad: true, _count: { select: { mensajes: true } } },
        },
        payer: true,
        pagos: {
          where: { estado: 'CONFIRMADO' },
          orderBy: { fechaConfirmacion: 'desc' },
          take: 1,
        },
        customer: {
          include: {
            asesor: { select: { id: true, nombres: true, apellidos: true, gradoAcademico: true, especialidad: true } },
            servicio: { select: { id: true, nombre: true, codigo: true } },
            sesiones: { orderBy: { fechaHoraProgramada: 'asc' }, take: 1 },
          },
        },
      },
    });

    return buyers.map((b) => ({
      ...b,
      nombreDisplay: b.nombre || `${b.nombres || ''} ${b.apellidos || ''}`.trim() || 'Prospecto',
      emailDisplay: b.correo || b.email,
      universidadDisplay: b.universidadNombre || b.universidad?.nombre || 'No especificada',
      carreraDisplay: b.carreraNombre || b.carrera?.nombre || 'No especificada',
      desgloseScore: b.lead?.criterioCalificacion ? JSON.parse(b.lead.criterioCalificacion) : null,
      tieneConversacionActiva: b.conversaciones.length > 0,
      montoPagado: b.payer?.montoTotalPagado || b.pagos?.[0]?.monto || null,
      asesorAsignado: b.customer?.asesor
        ? `${b.customer.asesor.gradoAcademico || 'Asesor'} ${b.customer.asesor.nombres} ${b.customer.asesor.apellidos}`
        : null,
      servicioContratado: b.customer?.servicio?.nombre || null,
      proximaSesion: b.customer?.sesiones?.[0] || null,
    }));
  }

  /**
   * Obtiene el detalle completo de un BUYER por ID.
   */
  async findById(id: string) {
    const buyer = await this.prisma.buyer.findUnique({
      where: { id },
      include: {
        universidad: true,
        carrera: true,
        ubicacion: true,
        canal: true,
        financiadoPor: true,
        compradoresFinanciados: true,
        descargasContenido: { include: { servicio: true } },
        interaccionesRedSocial: true,
        formularios: { orderBy: { fechaEnvio: 'desc' } },
        interacciones: { orderBy: { fechaHora: 'desc' } },
        lead: true,
        conversaciones: {
          include: {
            mensajes: { orderBy: { fechaHora: 'asc' } },
            diagnosticos: true,
            propuestas: { include: { servicio: true } },
            objeciones: true,
          },
          orderBy: { fechaUltimaActividad: 'desc' },
        },
        pagos: {
          orderBy: { fechaCreacion: 'desc' },
          include: { cotizacion: { include: { servicio: true } } },
        },
        payer: true,
        customer: {
          include: {
            asesor: true,
            servicio: true,
            sesiones: { orderBy: { numeroSesion: 'asc' } },
          },
        },
      },
    });

    if (!buyer) {
      throw new NotFoundException(`No se encontró el BUYER con ID: ${id}`);
    }

    return buyer;
  }

  /**
   * Registra un nuevo BUYER desde el Formulario de Captación,
   * calcula su Lead Score y lo califica como LEAD si supera el umbral (>= 70).
   */
  async createFromForm(dto: CreateBuyerFormDto, ip?: string, userAgent?: string) {
    const fullName = dto.nombre?.trim() || `${dto.nombres || ''} ${dto.apellidos || ''}`.trim() || 'Prospecto Tesis';
    const emailVal = (dto.correo || dto.email || '').toLowerCase().trim();
    const cleanWhatsapp = dto.whatsapp.replace(/\D/g, '');
    const nombresVal = dto.nombres || fullName.split(' ')[0] || '';
    const apellidosVal = dto.apellidos || fullName.split(' ').slice(1).join(' ') || '';
    const canalVal = dto.canalCaptacion || dto.canalCodigo || 'META_ADS';
    const tipoPerfilVal = dto.tipoPerfil || 'ESTUDIANTE';

    this.logger.log(`Registrando nuevo formulario para: ${fullName} (${cleanWhatsapp}) - Perfil: ${tipoPerfilVal}`);

    // 1. Resolver Universidad
    let universidadId = dto.universidadId;
    if (!universidadId && dto.universidad) {
      const uEncontrada = await this.prisma.universidad.findFirst({
        where: {
          OR: [
            { nombre: { contains: dto.universidad } },
            { siglas: { contains: dto.universidad } },
          ],
        },
      });
      if (uEncontrada) universidadId = uEncontrada.id;
    }

    // 2. Resolver Carrera
    let carreraId = dto.carreraId;
    if (!carreraId && dto.carrera) {
      const cEncontrada = await this.prisma.carrera.findFirst({
        where: { nombre: { contains: dto.carrera } },
      });
      if (cEncontrada) carreraId = cEncontrada.id;
    }

    // 3. Resolver Canal
    let canalId: string | undefined;
    if (canalVal) {
      const cnl = await this.prisma.canal.findFirst({
        where: { OR: [{ codigo: canalVal }, { nombre: { contains: canalVal } }] },
      });
      if (cnl) canalId = cnl.id;
    }

    // 4. Calcular Lead Score con el motor
    const resultadoScoring = this.scoringService.calcularScore({
      universidadId,
      carreraId,
      ciclo: dto.ciclo,
      tipoInvestigacion: dto.tipoInvestigacion,
      plazoDefinidoDias: dto.plazoDefinidoDias,
      situacionLaboral: dto.situacionLaboral,
      presupuestoAprox: dto.presupuestoAprox,
      dolorPrincipal: dto.dolorPrincipal,
      softwareRequerido: dto.softwareRequerido,
      consentimientoWhatsapp: dto.consentimientoWhatsapp,
      descargoLeadMagnet: dto.descargoLeadMagnet || Boolean(dto.servicioIdAsociado),
      totalInteracciones7Dias: 1,
    });

    const estadoInicial = resultadoScoring.esLead ? 'LEAD' : 'BUYER';

    // 5. Verificar si el WhatsApp o Email ya existe en la base (Deduplicación)
    const buyerExistente = await this.prisma.buyer.findFirst({
      where: {
        OR: [
          { whatsapp: cleanWhatsapp },
          { email: emailVal },
          { correo: emailVal },
        ],
      },
      include: { lead: true },
    });

    let buyer: any;
    let lead: any = buyerExistente?.lead || null;

    const buyerData = {
      tipoPerfil: tipoPerfilVal,
      nombre: fullName,
      nombres: nombresVal,
      apellidos: apellidosVal,
      whatsapp: cleanWhatsapp,
      email: emailVal,
      correo: emailVal,
      departamento: dto.departamento || 'La Libertad',
      distrito: dto.distrito || 'Trujillo',
      tipoUniversidad: dto.tipoUniversidad || 'PUBLICA',
      sede: dto.sede || 'Sede Central',
      universidadNombre: dto.universidad,
      facultad: dto.facultad || 'Facultad de Ingeniería',
      carreraNombre: dto.carrera,
      ciclo: dto.ciclo,
      edad: dto.edad ? Number(dto.edad) : 23,
      financiaAIdBuyer: dto.financiaAIdBuyer || null,
      canalCaptacion: canalVal,
      universidadId: universidadId || buyerExistente?.universidadId,
      carreraId: carreraId || buyerExistente?.carreraId,
      canalId: canalId || buyerExistente?.canalId,
      tipoInvestigacion: dto.tipoInvestigacion,
      situacionLaboral: dto.situacionLaboral,
      presupuestoAprox: dto.presupuestoAprox,
      dolorPrincipal: dto.dolorPrincipal,
      softwareRequerido: dto.softwareRequerido,
      plazoDefinidoDias: dto.plazoDefinidoDias,
      consentimientoWhatsapp: dto.consentimientoWhatsapp ?? true,
    };

    if (buyerExistente) {
      this.logger.log(`✓ Deduplicación: WhatsApp/Email ${cleanWhatsapp} ya existe en BD. Actualizando historial del BUYER: ${buyerExistente.id}`);

      const nuevoEstado = ['PAYER', 'CUSTOMER'].includes(buyerExistente.estadoFunnel)
        ? buyerExistente.estadoFunnel
        : resultadoScoring.esLead
        ? 'LEAD'
        : buyerExistente.estadoFunnel;

      buyer = await this.prisma.buyer.update({
        where: { id: buyerExistente.id },
        data: {
          ...buyerData,
          leadScore: Math.max(buyerExistente.leadScore, resultadoScoring.score),
          estadoFunnel: nuevoEstado,
          fechaConversionLead: resultadoScoring.esLead && !buyerExistente.fechaConversionLead ? new Date() : buyerExistente.fechaConversionLead,
        },
      });

      if (lead) {
        const prioridad = buyer.leadScore >= 70 ? 'ALTA' : buyer.leadScore >= 40 ? 'MEDIA' : 'BAJA';
        lead = await this.prisma.lead.update({
          where: { id: lead.id },
          data: {
            scoreCalificado: buyer.leadScore,
            prioridad,
            criterioCalificacion: resultadoScoring.criterioCalificacion,
          },
        });
      } else if (resultadoScoring.esLead) {
        const prioridad = buyer.leadScore >= 70 ? 'ALTA' : buyer.leadScore >= 40 ? 'MEDIA' : 'BAJA';
        lead = await this.prisma.lead.create({
          data: {
            buyerId: buyer.id,
            scoreCalificado: buyer.leadScore,
            prioridad,
            umbralSuperado: true,
            criterioCalificacion: resultadoScoring.criterioCalificacion,
          },
        });
      }
    } else {
      buyer = await this.prisma.buyer.create({
        data: {
          ...buyerData,
          leadScore: resultadoScoring.score,
          estadoFunnel: estadoInicial,
          fechaConversionLead: resultadoScoring.esLead ? new Date() : null,
        },
      });

      if (resultadoScoring.esLead) {
        const prioridad = resultadoScoring.score >= 70 ? 'ALTA' : resultadoScoring.score >= 40 ? 'MEDIA' : 'BAJA';
        lead = await this.prisma.lead.create({
          data: {
            buyerId: buyer.id,
            scoreCalificado: resultadoScoring.score,
            prioridad,
            umbralSuperado: true,
            criterioCalificacion: resultadoScoring.criterioCalificacion,
          },
        });

        await this.prisma.notificacion.create({
          data: {
            tipo: 'LEAD_CALIFICADO',
            titulo: `Nuevo LEAD Calificado: ${fullName}`,
            mensaje: `Score obtenido: ${resultadoScoring.score}/100. Carrera: ${dto.carrera} (${dto.universidad}). Listo para iniciar negociación.`,
            metadata: JSON.stringify({ buyerId: buyer.id, leadId: lead.id, score: resultadoScoring.score }),
          },
        });
      }
    }

    // 6.1 Registrar en DESCARGA_CONTENIDO si seleccionó paquete o descargó recurso
    let servicioAsociadoId = dto.servicioIdAsociado;
    if (!servicioAsociadoId && dto.descargoLeadMagnet) {
      const primerServicio = await this.prisma.catalogoServicios.findFirst();
      if (primerServicio) servicioAsociadoId = primerServicio.servicioId;
    }
    if (servicioAsociadoId) {
      await this.prisma.descargaContenido.create({
        data: {
          idBuyer: buyer.id,
          servicioIdAsociado: servicioAsociadoId,
        },
      });
    }

    // 6.2 Registrar en INTERACCION_RED_SOCIAL si procede de campaña/red social
    if (dto.redSocial || dto.tipoInteraccion) {
      await this.prisma.interaccionRedSocial.create({
        data: {
          idBuyer: buyer.id,
          redSocial: dto.redSocial || canalVal,
          tipoInteraccion: dto.tipoInteraccion || 'ENVIO_FORMULARIO',
          temaDetectado: dto.temaDetectado || dto.dolorPrincipal || 'Consulta general tesis',
        },
      });
    }

    // 7. Guardar formulario crudo (historial auditable)
    await this.prisma.formulario.create({
      data: {
        buyerId: buyer.id,
        datosJson: JSON.stringify(dto),
        ip: ip || null,
        userAgent: userAgent || null,
      },
    });

    // 8. Guardar interacción en el historial
    await this.prisma.interaccion.create({
      data: {
        buyerId: buyer.id,
        tipo: 'ENVIO_FORMULARIO',
        detalle: buyerExistente
          ? `Actualización de datos por reenvío de formulario (Score: ${buyer.leadScore})`
          : `Envío de formulario inicial con score calculado: ${resultadoScoring.score}`,
      },
    });

    this.logger.log(`BUYER procesado: ${buyer.id} - Score: ${buyer.leadScore}/100 - Estado: ${buyer.estadoFunnel}`);

    return {
      buyerId: buyer.id,
      leadId: lead?.id || null,
      nombre: buyer.nombre,
      nombres: buyer.nombres,
      apellidos: buyer.apellidos,
      leadScore: resultadoScoring.score,
      estadoFunnel: estadoInicial,
      esLead: resultadoScoring.esLead,
      explicacionScore: resultadoScoring.explicacion,
      desgloseScore: resultadoScoring.desglose,
    };
  }

  async getCatalogos() {
    const [universidades, catalogoServicios, estudiantesFinanciables] = await Promise.all([
      this.prisma.universidad.findMany({
        where: { activo: true },
        include: { carreras: { where: { activo: true } } },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.catalogoServicios.findMany({
        orderBy: { precioBase: 'desc' },
      }),
      this.prisma.buyer.findMany({
        where: { tipoPerfil: 'ESTUDIANTE' },
        select: { id: true, nombre: true, nombres: true, apellidos: true, carreraNombre: true, universidadNombre: true },
        orderBy: { fechaRegistro: 'desc' },
        take: 20,
      }),
    ]);

    return {
      universidades,
      catalogoServicios,
      estudiantesFinanciables: estudiantesFinanciables.map((e) => ({
        id: e.id,
        nombre: e.nombre || `${e.nombres || ''} ${e.apellidos || ''}`.trim(),
        detalle: `${e.carreraNombre || 'Carrera'} - ${e.universidadNombre || 'Universidad'}`,
      })),
      tiposPerfil: [
        { value: 'ESTUDIANTE', label: 'Estudiante Universitario (Pregrado / Posgrado)' },
        { value: 'EGRESADO', label: 'Egresado / Bachiller' },
        { value: 'PADRE_FAMILIA', label: 'Padre de Familia / Financiador' },
        { value: 'APODERADO', label: 'Apoderado / Tutor' },
      ],
      canales: [
        { value: 'TIKTOK', label: 'TikTok' },
        { value: 'META_ADS', label: 'Meta Ads (Facebook / Instagram)' },
        { value: 'GOOGLE', label: 'Búsqueda en Google' },
        { value: 'ORGANICO', label: 'Página Web / Orgánico' },
        { value: 'RECOMENDACION', label: 'Recomendación / Colega' },
      ],
    };
  }
}
