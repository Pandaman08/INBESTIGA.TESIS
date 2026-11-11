import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { Actor, esViolacionUnica } from '../domain/actor';
import { EstadoOportunidad, OrigenTransicion, esTerminal, validarTransicion } from '../domain/oportunidad-estados';

type Tx = Prisma.TransactionClient;

/**
 * Ciclo de vida de OPORTUNIDAD_COMERCIAL.
 * Regla de apertura: un LEAD tiene como máximo UNA oportunidad abierta (índice
 * UX_OPORT_ABIERTA_POR_LEAD). Una oportunidad cerrada nunca se reabre: se abre un ciclo nuevo.
 */
@Injectable()
export class OportunidadesService {
  private readonly logger = new Logger(OportunidadesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve la oportunidad abierta del LEAD del BUYER o abre una nueva (idempotente).
   * Si dos procesos la abren a la vez, el índice único hace fallar a uno y este devuelve la existente.
   */
  async abrirParaBuyer(buyerId: string, actor: Actor): Promise<{ oportunidad: any; creada: boolean }> {
    const lead = await this.prisma.lead.findUnique({ where: { buyerId }, select: { id: true } });
    if (!lead) {
      throw new BadRequestException('El estudiante aún no es LEAD (no superó la calificación de BUYERS).');
    }
    return this.abrirParaLead(lead.id, actor);
  }

  async abrirParaLead(leadId: string, actor: Actor): Promise<{ oportunidad: any; creada: boolean }> {
    const abierta = await this.buscarAbierta(leadId);
    if (abierta) return { oportunidad: abierta, creada: false };

    try {
      const oportunidad = await this.prisma.$transaction(async (tx) => {
        const nueva = await tx.oportunidadComercial.create({
          data: { leadId, estado: 'ABIERTA', origen: 'SISTEMA' },
        });
        await this.registrarHistorial(tx, nueva.id, null, 'ABIERTA', actor, 'Apertura de oportunidad');
        return nueva;
      });
      this.logger.log(`Oportunidad ${oportunidad.id} abierta para LEAD ${leadId}`);
      return { oportunidad, creada: true };
    } catch (e) {
      if (esViolacionUnica(e)) {
        const existente = await this.buscarAbierta(leadId);
        if (existente) return { oportunidad: existente, creada: false };
      }
      throw e;
    }
  }

  buscarAbierta(leadId: string) {
    return this.prisma.oportunidadComercial.findFirst({ where: { leadId, fechaCierre: null } });
  }

  async obtener(id: string) {
    const oportunidad = await this.prisma.oportunidadComercial.findUnique({
      where: { id },
      include: {
        lead: { include: { buyer: { include: { universidad: true, carrera: true } } } },
        historial: { orderBy: { fecha: 'asc' } },
        diagnosticos: { orderBy: { fechaDiagnostico: 'asc' } },
        propuestas: { orderBy: { version: 'asc' }, include: { servicio: true, respuestas: true, ajustes: true } },
        objeciones: { orderBy: { fechaRegistro: 'asc' } },
        citas: { orderBy: { inicio: 'asc' } },
        transferencias: true,
        conversion: true,
      },
    });
    if (!oportunidad) throw new NotFoundException('Oportunidad no encontrada.');
    return oportunidad;
  }

  listar(filtro: { buyerId?: string; estado?: string }) {
    return this.prisma.oportunidadComercial.findMany({
      where: {
        ...(filtro.buyerId ? { lead: { buyerId: filtro.buyerId } } : {}),
        ...(filtro.estado ? { estado: filtro.estado } : {}),
      },
      orderBy: { fechaInicio: 'desc' },
      take: 200,
      include: { lead: { select: { buyerId: true, buyer: { select: { nombres: true, apellidos: true } } } } },
    });
  }

  /** Transición pedida por un usuario (solo las marcadas MANUAL en el contrato). */
  async transicionar(id: string, estadoNuevo: string, actor: Actor, motivo?: string) {
    if (estadoNuevo === 'DESCARTADA' && !motivo?.trim()) {
      throw new BadRequestException('Indique el motivo para descartar la oportunidad.');
    }
    return this.prisma.$transaction((tx) => this.aplicarTransicion(tx, id, estadoNuevo as EstadoOportunidad, actor, 'MANUAL', motivo));
  }

  /**
   * Aplica una transición dentro de una transacción existente, con control de concurrencia
   * optimista: solo actualiza si el estado sigue siendo el leído (evita carreras).
   */
  async aplicarTransicion(tx: Tx, id: string, estadoNuevo: EstadoOportunidad, actor: Actor, origen: OrigenTransicion, motivo?: string) {
    const actual = await tx.oportunidadComercial.findUnique({ where: { id } });
    if (!actual) throw new NotFoundException('Oportunidad no encontrada.');

    const error = validarTransicion(actual.estado, estadoNuevo, origen);
    if (error) throw new ConflictException(error);

    const ahora = new Date();
    const data: Prisma.OportunidadComercialUpdateManyMutationInput = { estado: estadoNuevo };
    if (estadoNuevo === 'APTA_PARA_COTIZAR' && !actual.fechaAptaCotizar) data.fechaAptaCotizar = ahora;
    if (esTerminal(estadoNuevo)) {
      data.fechaCierre = ahora;
      data.motivoCierre = motivo ?? null;
    }

    const { count } = await tx.oportunidadComercial.updateMany({ where: { id, estado: actual.estado }, data });
    if (count !== 1) throw new ConflictException('La oportunidad cambió mientras se procesaba la solicitud; vuelva a intentarlo.');

    await this.registrarHistorial(tx, id, actual.estado, estadoNuevo, actor, motivo);
    return tx.oportunidadComercial.findUnique({ where: { id } });
  }

  private registrarHistorial(tx: Tx, oportunidadId: string, anterior: string | null, nuevo: string, actor: Actor, motivo?: string) {
    return tx.oportunidadHistorial.create({
      data: { oportunidadId, estadoAnterior: anterior, estadoNuevo: nuevo, actorTipo: actor.tipo, actorId: actor.id ?? null, motivo: motivo ?? null },
    });
  }
}
