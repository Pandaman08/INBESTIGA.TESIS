import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { Actor, esViolacionUnica } from '../domain/actor';
import { OportunidadesService } from '../oportunidades/oportunidades.service';

export interface CrearPropuestaInput {
  servicioId: string;
  precioPropuesto: number;
  numeroCuotas?: number;
  plazoDias?: number;
  vigenciaHasta?: Date;
  justificacion?: string;
  conversacionId?: string;
}

export interface ResponderPropuestaInput {
  tipoRespuesta: 'ACEPTADA' | 'RECHAZADA' | 'SOLICITA_AJUSTE';
  /** La aceptación exige una acción expresa del estudiante (informe Tabla 7). */
  confirmacionExpresa?: boolean;
  canal?: string;
  observacion?: string;
  evidenciaMensajeId?: string;
}

const ESTADOS_COTIZABLES = ['APTA_PARA_COTIZAR', 'EN_NEGOCIACION'];
const dec = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(v);

/**
 * Propuestas versionadas por oportunidad (informe 4.4.2):
 *  - cada versión es un registro nuevo (las anteriores se conservan intactas);
 *  - la versión se numera dentro de la oportunidad (UX_PROPUESTA_VERSION);
 *  - la aceptación se asocia a UNA versión vigente y no crea PAYER: solo lleva la oportunidad a ACEPTADA.
 * El cálculo completo de precio (tarifas, ajustes, topes) se implementa en P07; aquí se valida
 * como mínimo que el precio esté dentro del rango del servicio.
 */
@Injectable()
export class PropuestasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oportunidades: OportunidadesService,
  ) {}

  async crearVersion(oportunidadId: string, input: CrearPropuestaInput, actor: Actor) {
    const oportunidad = await this.prisma.oportunidadComercial.findUnique({ where: { id: oportunidadId } });
    if (!oportunidad) throw new NotFoundException('Oportunidad no encontrada.');
    if (!ESTADOS_COTIZABLES.includes(oportunidad.estado)) {
      throw new ConflictException(`Solo se cotiza una oportunidad APTA_PARA_COTIZAR o EN_NEGOCIACION (actual: ${oportunidad.estado}).`);
    }

    const servicio = await this.prisma.servicio.findUnique({ where: { id: input.servicioId } });
    if (!servicio || !servicio.activo) throw new BadRequestException('Servicio inexistente o inactivo.');

    const precio = dec(input.precioPropuesto);
    if (precio.lt(servicio.precioMinimo) || precio.gt(servicio.precioMaximo)) {
      throw new BadRequestException(
        `El precio ${precio.toFixed(2)} está fuera del rango permitido del servicio (${dec(servicio.precioMinimo).toFixed(2)} – ${dec(servicio.precioMaximo).toFixed(2)}).`,
      );
    }
    const cuotas = input.numeroCuotas ?? 1;
    if (cuotas < 1 || cuotas > servicio.maxCuotas) throw new BadRequestException(`Número de cuotas fuera de rango (1–${servicio.maxCuotas}).`);

    const base = dec(servicio.precioBase);
    const descuentoPct = base.gt(precio) ? base.minus(precio).div(base).times(100).toDecimalPlaces(2) : dec(0);

    // Dos intentos: si otra petición tomó la misma versión, el índice único lo detecta y se renumera.
    for (let intento = 0; intento < 2; intento++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const ultima = await tx.propuesta.aggregate({ where: { oportunidadId }, _max: { version: true } });
          return tx.propuesta.create({
            data: {
              oportunidadId,
              leadId: oportunidad.leadId,
              conversacionId: input.conversacionId ?? null,
              servicioId: servicio.id,
              version: (ultima._max.version ?? 0) + 1,
              precioOriginal: base,
              precioPropuesto: precio,
              descuentoAplicadoPct: descuentoPct,
              numeroCuotas: cuotas,
              montoPorCuota: precio.div(cuotas).toDecimalPlaces(2),
              plazoDias: input.plazoDias ?? 30,
              vigenciaHasta: input.vigenciaHasta ?? null,
              justificacion: input.justificacion ?? null,
              generadaPor: actor.tipo === 'AGENTE_IA' ? 'AGENTE_IA' : actor.tipo === 'ASESOR' ? 'ASESOR' : 'ADMIN',
              estado: 'BORRADOR',
            },
          });
        });
      } catch (e) {
        if (esViolacionUnica(e) && intento === 0) continue;
        throw e;
      }
    }
    throw new ConflictException('No se pudo asignar la versión de la propuesta; vuelva a intentarlo.');
  }

  /**
   * Presenta una versión al estudiante. La primera presentación de la oportunidad la lleva a
   * EN_NEGOCIACION (evento que cierra K2). Las versiones presentadas antes quedan REEMPLAZADAS.
   */
  async presentar(propuestaId: string, actor: Actor) {
    const diasVigencia = Number(process.env.LEADS_VIGENCIA_PROPUESTA_DIAS || 7);
    return this.prisma.$transaction(async (tx) => {
      const propuesta = await tx.propuesta.findUnique({ where: { id: propuestaId }, include: { oportunidad: true } });
      if (!propuesta?.oportunidad) throw new NotFoundException('Propuesta de oportunidad no encontrada.');
      if (propuesta.estado !== 'BORRADOR') throw new ConflictException(`Solo se presenta un BORRADOR (actual: ${propuesta.estado}).`);
      if (!ESTADOS_COTIZABLES.includes(propuesta.oportunidad.estado)) {
        throw new ConflictException(`La oportunidad no admite propuestas en estado ${propuesta.oportunidad.estado}.`);
      }

      const ahora = new Date();
      const { count } = await tx.propuesta.updateMany({
        where: { id: propuestaId, estado: 'BORRADOR' },
        data: {
          estado: 'ENVIADA',
          fechaPresentacion: ahora,
          vigenciaHasta: propuesta.vigenciaHasta ?? new Date(ahora.getTime() + diasVigencia * 86_400_000),
        },
      });
      if (count !== 1) throw new ConflictException('La propuesta cambió mientras se procesaba; vuelva a intentarlo.');

      await tx.propuesta.updateMany({
        where: { oportunidadId: propuesta.oportunidadId, id: { not: propuestaId }, estado: 'ENVIADA' },
        data: { estado: 'REEMPLAZADA' },
      });

      if (propuesta.oportunidad.estado === 'APTA_PARA_COTIZAR') {
        await this.oportunidades.aplicarTransicion(tx, propuesta.oportunidad.id, 'EN_NEGOCIACION', actor, 'EVENTO', `Primera propuesta presentada (v${propuesta.version})`);
      }
      return tx.propuesta.findUnique({ where: { id: propuestaId } });
    });
  }

  /**
   * Registra la respuesta del estudiante a una versión concreta.
   * ACEPTADA: exige acción expresa, versión ENVIADA y vigente, y que la oportunidad no tenga ya otra
   * versión aceptada. Lleva la oportunidad a ACEPTADA. No crea PAYER ni registra pagos.
   */
  async responder(propuestaId: string, input: ResponderPropuestaInput, actor: Actor) {
    if (input.tipoRespuesta === 'ACEPTADA' && input.confirmacionExpresa !== true) {
      throw new BadRequestException('La aceptación requiere confirmación expresa del estudiante.');
    }

    return this.prisma.$transaction(async (tx) => {
      const propuesta = await tx.propuesta.findUnique({ where: { id: propuestaId }, include: { oportunidad: true } });
      if (!propuesta?.oportunidad) throw new NotFoundException('Propuesta de oportunidad no encontrada.');
      if (propuesta.estado !== 'ENVIADA') {
        throw new ConflictException(`Solo se responde una versión presentada y vigente (actual: ${propuesta.estado}).`);
      }

      const ahora = new Date();
      if (input.tipoRespuesta === 'ACEPTADA') {
        if (propuesta.vigenciaHasta && propuesta.vigenciaHasta < ahora) {
          throw new ConflictException('La versión venció; genere una nueva versión de la propuesta.');
        }
        const otraAceptada = await tx.propuesta.count({
          where: { oportunidadId: propuesta.oportunidadId, estado: 'ACEPTADA', id: { not: propuestaId } },
        });
        if (otraAceptada > 0) throw new ConflictException('La oportunidad ya tiene otra versión aceptada.');
      }

      const respuesta = await tx.respuestaPropuesta.create({
        data: {
          propuestaId,
          tipoRespuesta: input.tipoRespuesta,
          fechaRespuesta: ahora,
          canal: input.canal ?? null,
          actorTipo: actor.tipo,
          actorId: actor.id ?? null,
          observacion: input.observacion ?? null,
          evidenciaMensajeId: input.evidenciaMensajeId ?? null,
        },
      });

      if (input.tipoRespuesta === 'ACEPTADA' || input.tipoRespuesta === 'RECHAZADA') {
        const { count } = await tx.propuesta.updateMany({
          where: { id: propuestaId, estado: 'ENVIADA' },
          data: { estado: input.tipoRespuesta },
        });
        if (count !== 1) throw new ConflictException('La propuesta cambió mientras se procesaba; vuelva a intentarlo.');
      }

      if (input.tipoRespuesta === 'ACEPTADA') {
        await this.oportunidades.aplicarTransicion(tx, propuesta.oportunidad.id, 'ACEPTADA', actor, 'EVENTO', `Aceptación expresa de la versión ${propuesta.version}`);
      }
      return respuesta;
    });
  }
}
