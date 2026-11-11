import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Tipos de evento operativo de LEADS. Sirven a la línea de tiempo y al tablero en vivo;
 * NO son indicadores (los KPI K1–K5 salen del DataMart).
 */
export type TipoEventoLeads =
  | 'MENSAJE_RECIBIDO'
  | 'MENSAJE_DUPLICADO'
  | 'PROCESAMIENTO_REANUDADO'
  | 'HERRAMIENTA_EJECUTADA'
  | 'HERRAMIENTA_BLOQUEADA'
  | 'RESPUESTA_REGISTRADA'
  | 'ENVIO_FALLIDO'
  | 'IA_NO_DISPONIBLE'
  | 'IA_ERROR'
  | 'REMITENTE_EN_CUARENTENA'
  | 'NEGOCIACION_INICIADA';

export interface EventoInput {
  tipo: TipoEventoLeads;
  resumen: string;
  actorTipo: string;
  actorId?: string | null;
  oportunidadId?: string | null;
  conversacionId?: string | null;
  mensajeId?: string | null;
  canal?: string | null;
  datos?: Record<string, unknown>;
}

/** Claves que nunca se guardan en la bitácora (datos de contacto). */
const CLAVES_PII = /^(whatsapp|telefono|phone|email|correo|chatid|wachatid|senderphone|sentto|dni|documento)$/i;
const MAX_TEXTO = 300;

/** Elimina datos de contacto y recorta textos largos (profundidad acotada). */
export function sanearDatos(valor: unknown, profundidad = 0): unknown {
  if (valor === null || valor === undefined) return valor;
  if (typeof valor === 'string') return valor.length > MAX_TEXTO ? `${valor.slice(0, MAX_TEXTO)}…` : valor;
  if (typeof valor !== 'object') return valor;
  if (profundidad >= 3) return '[…]';
  if (Array.isArray(valor)) return valor.slice(0, 20).map((v) => sanearDatos(v, profundidad + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CLAVES_PII.test(k)) continue;
    out[k] = sanearDatos(v, profundidad + 1);
  }
  return out;
}

@Injectable()
export class EventosLeadsService {
  private readonly logger = new Logger(EventosLeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Registra un evento. Nunca interrumpe el flujo principal si la bitácora falla. */
  async registrar(e: EventoInput): Promise<void> {
    try {
      await this.prisma.eventoLeads.create({
        data: {
          tipo: e.tipo,
          resumen: e.resumen.slice(0, 500),
          actorTipo: e.actorTipo,
          actorId: e.actorId ?? null,
          oportunidadId: e.oportunidadId ?? null,
          conversacionId: e.conversacionId ?? null,
          mensajeId: e.mensajeId ?? null,
          canal: e.canal ?? null,
          datos: e.datos ? JSON.stringify(sanearDatos(e.datos)) : null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`No se pudo registrar el evento ${e.tipo}: ${err.message}`);
    }
  }

  listarRecientes(desde?: Date, limite = 100) {
    return this.prisma.eventoLeads.findMany({
      where: desde ? { fecha: { gt: desde } } : {},
      orderBy: { fecha: 'desc' },
      take: Math.min(Math.max(limite, 1), 500),
    });
  }

  /** Línea de tiempo explicable de una conversación: mensajes + eventos, en orden. */
  async timeline(conversacionId: string) {
    const [mensajes, eventos] = await Promise.all([
      this.prisma.mensaje.findMany({
        where: { conversacionId },
        orderBy: { fechaHora: 'asc' },
        select: {
          id: true,
          fechaHora: true,
          direccion: true,
          actor: true,
          remitente: true,
          canal: true,
          contenido: true,
          estadoEntrega: true,
          estadoProcesamiento: true,
          respuestaA: true,
          consentimientoAplicado: true,
        },
      }),
      this.prisma.eventoLeads.findMany({ where: { conversacionId }, orderBy: { fecha: 'asc' } }),
    ]);
    const items = [
      ...mensajes.map((m) => ({ tipo: 'MENSAJE' as const, fecha: m.fechaHora, mensaje: m })),
      ...eventos.map((ev) => ({
        tipo: 'EVENTO' as const,
        fecha: ev.fecha,
        evento: { ...ev, datos: ev.datos ? JSON.parse(ev.datos) : null },
      })),
    ].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return { conversacionId, items };
  }
}
