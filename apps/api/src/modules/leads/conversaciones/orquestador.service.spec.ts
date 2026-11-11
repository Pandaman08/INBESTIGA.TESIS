import { OrquestadorConversacionalService, MAX_CARACTERES_ENTRADA } from './orquestador.service';
import { EventosLeadsService } from './eventos.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';

/**
 * Almacén en memoria con las restricciones de la migración 4:
 *  UX_MENSAJE_EVENTO (canal, eventoEntradaId) y UX_MENSAJE_RESPUESTA_IA (respuestaA, actor = AGENTE_IA).
 */
function crearStore() {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const db = { buyer: [] as any[], conversacion: [] as any[], mensaje: [] as any[], evento: [] as any[] };
  const unico = () => Object.assign(new Error('unique'), { code: 'P2002' });
  const cumple = (r: any, w: any = {}) =>
    Object.entries(w).every(([k, v]: [string, any]) => {
      if (k === 'OR') return v.some((c: any) => cumple(r, c));
      if (v && typeof v === 'object' && 'not' in v) return r[k] !== v.not;
      return (r[k] ?? null) === (v ?? null);
    });

  const prisma: any = {
    db,
    buyer: {
      findUnique: async ({ where }: any) => {
        const b = db.buyer.find((x) => x.id === where.id);
        return b ? { ...b, lead: b.leadId ? { id: b.leadId } : null } : null;
      },
    },
    conversacion: {
      findFirst: async ({ where }: any) => [...db.conversacion].reverse().find((c) => cumple(c, where)) ?? null,
      create: async ({ data }: any) => {
        const c = { id: id('conv'), fechaInicio: new Date(), ...data };
        db.conversacion.push(c);
        return { ...c };
      },
      update: async ({ where, data }: any) => {
        const c = db.conversacion.find((x) => x.id === where.id);
        Object.assign(c, data);
        return { ...c };
      },
    },
    mensaje: {
      create: async ({ data }: any) => {
        if (data.eventoEntradaId && db.mensaje.some((m) => m.canal === data.canal && m.eventoEntradaId === data.eventoEntradaId)) throw unico();
        if (data.respuestaA && data.actor === 'AGENTE_IA' && db.mensaje.some((m) => m.respuestaA === data.respuestaA && m.actor === 'AGENTE_IA')) throw unico();
        const m = { id: id('msg'), fechaHora: new Date(), ...data };
        db.mensaje.push(m);
        return { ...m };
      },
      findFirst: async ({ where }: any) => db.mensaje.find((m) => cumple(m, where)) ?? null,
      count: async ({ where }: any) => db.mensaje.filter((m) => cumple(m, where)).length,
      update: async ({ where, data }: any) => {
        const m = db.mensaje.find((x) => x.id === where.id);
        Object.assign(m, data);
        return { ...m };
      },
    },
    eventoLeads: {
      create: async ({ data }: any) => {
        db.evento.push({ id: id('ev'), fecha: new Date(), ...data });
      },
    },
  };
  return prisma;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function montar(opts: { iaDelayMs?: number } = {}) {
  const prisma = crearStore();
  prisma.db.buyer.push(
    { id: 'b1', leadId: 'lead-1', whatsapp: '51900000001', email: 'b1@gmail.com', consentimientoWhatsapp: true },
    { id: 'b2', leadId: 'lead-2', whatsapp: '51900000002', email: 'b2@gmail.com', consentimientoWhatsapp: true },
    { id: 'b-sin', leadId: 'lead-3', whatsapp: '51900000003', email: 'b3@gmail.com', consentimientoWhatsapp: false },
  );
  let activas = 0;
  const concurrencia = { maxPorBuyer: {} as Record<string, number>, maxGlobal: 0, activasPorBuyer: {} as Record<string, number> };
  const ai = {
    procesarRespuestaIA: jest.fn(async ({ buyerId, ultimoMensajeCliente }: any) => {
      activas++;
      concurrencia.activasPorBuyer[buyerId] = (concurrencia.activasPorBuyer[buyerId] ?? 0) + 1;
      concurrencia.maxGlobal = Math.max(concurrencia.maxGlobal, activas);
      concurrencia.maxPorBuyer[buyerId] = Math.max(concurrencia.maxPorBuyer[buyerId] ?? 0, concurrencia.activasPorBuyer[buyerId]);
      await esperar(opts.iaDelayMs ?? 0);
      activas--;
      concurrencia.activasPorBuyer[buyerId]--;
      return { respuestaTexto: `R: ${ultimoMensajeCliente}`, etapaNueva: 'DIAGNOSTIC', actionMetadata: null, origen: 'MODELO' };
    }),
  };
  const openWA = { sendTextMessage: jest.fn().mockResolvedValue({ estado: 'SENT', exito: true, messageId: 'wa-1' }) };
  const whatsapp = new WhatsAppService(openWA as any, prisma);
  const oportunidades = { abrirParaLead: jest.fn(async (leadId: string) => ({ oportunidad: { id: `op-${leadId}` }, creada: false })) };
  const eventos = new EventosLeadsService(prisma);
  const orq = new OrquestadorConversacionalService(prisma, ai as any, whatsapp, oportunidades as any, eventos);
  return { prisma, ai, openWA, oportunidades, orq, concurrencia };
}

const wa = (buyerId: string, contenido: string, eventoEntradaId?: string) => ({
  canal: 'WHATSAPP' as const,
  buyerId,
  contenido,
  actor: { tipo: 'BUYER' as const },
  eventoEntradaId,
});
const web = (buyerId: string, contenido: string, eventoEntradaId?: string) => ({
  canal: 'CHAT_WEB_INTERNO' as const,
  buyerId,
  contenido,
  actor: { tipo: 'ADMIN_TEST' as const, usuarioId: 'u-admin' },
  eventoEntradaId,
});
const tiposEvento = (prisma: any) => prisma.db.evento.map((e: any) => e.tipo);

describe('Orquestador conversacional (P03)', () => {
  it('canal cruzado: WhatsApp y chat interno del mismo estudiante comparten conversación y oportunidad; cada respuesta sale por su canal', async () => {
    const { orq, prisma, openWA } = montar();
    const r1 = await orq.recibir(wa('b1', 'Hola por WhatsApp', 's:m1'));
    const r2 = await orq.recibir(web('b1', 'Hola desde el panel', 'cli-1'));

    expect(r1.conversacionId).toBe(r2.conversacionId);
    expect(r1.oportunidadId).toBe('op-lead-1');
    expect(r2.oportunidadId).toBe('op-lead-1');
    expect(openWA.sendTextMessage).toHaveBeenCalledTimes(1); // solo la respuesta al mensaje de WhatsApp

    const salientes = prisma.db.mensaje.filter((m: any) => m.direccion === 'OUTGOING');
    expect(salientes.map((m: any) => [m.canal, m.estadoEntrega, m.actor])).toEqual([
      ['WHATSAPP', 'SENT', 'AGENTE_IA'],
      ['CHAT_WEB_INTERNO', 'LOCAL_ONLY', 'AGENTE_IA'],
    ]);
    const entradaWeb = prisma.db.mensaje.find((m: any) => m.eventoEntradaId === 'cli-1');
    expect(entradaWeb).toMatchObject({ actor: 'ADMIN_TEST', actorUsuarioId: 'u-admin', canal: 'CHAT_WEB_INTERNO', oportunidadId: 'op-lead-1' });
  });

  it('contrato del mensaje: entrada y respuesta enlazadas, con oportunidad, canal, actor, estados y consentimiento', async () => {
    const { orq, prisma } = montar();
    await orq.recibir({ ...wa('b1', 'Hola', 's:m1'), providerMessageId: 'm1' });
    const [entrada, salida] = prisma.db.mensaje;
    expect(entrada).toMatchObject({
      direccion: 'INCOMING',
      actor: 'BUYER',
      canal: 'WHATSAPP',
      oportunidadId: 'op-lead-1',
      eventoEntradaId: 's:m1',
      providerMessageId: 'm1',
      estadoProcesamiento: 'PROCESADO',
    });
    expect(salida).toMatchObject({
      direccion: 'OUTGOING',
      respuestaA: entrada.id,
      estadoEntrega: 'SENT',
      providerMessageId: 'wa-1',
      consentimientoAplicado: 'VIGENTE',
    });
  });

  it('webhook repetido (secuencial): una sola respuesta y un evento MENSAJE_DUPLICADO', async () => {
    const { orq, ai, openWA, prisma } = montar();
    await orq.recibir(wa('b1', 'Hola', 's:m1'));
    const r = await orq.recibir(wa('b1', 'Hola', 's:m1'));
    expect(r.estado).toBe('DUPLICADO');
    expect(ai.procesarRespuestaIA).toHaveBeenCalledTimes(1);
    expect(openWA.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(tiposEvento(prisma)).toContain('MENSAJE_DUPLICADO');
  });

  it('webhook repetido (simultáneo): una sola respuesta', async () => {
    const { orq, ai, openWA } = montar({ iaDelayMs: 20 });
    const res = await Promise.all([orq.recibir(wa('b1', 'Hola', 's:m1')), orq.recibir(wa('b1', 'Hola', 's:m1'))]);
    expect(res.map((r) => r.estado).sort()).toEqual(['DUPLICADO', 'RESPONDIDO']);
    expect(ai.procesarRespuestaIA).toHaveBeenCalledTimes(1);
    expect(openWA.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it('reinicio seguro: una entrada registrada sin respuesta (caída) se retoma UNA vez con el reintento', async () => {
    const { orq, prisma, ai, openWA } = montar();
    // Estado que deja una caída entre "entrada registrada" y "respuesta"
    prisma.db.conversacion.push({ id: 'conv-x', buyerId: 'b1', leadId: 'lead-1', oportunidadId: 'op-lead-1', fechaInicio: new Date() });
    prisma.db.mensaje.push({ id: 'msg-caido', conversacionId: 'conv-x', direccion: 'INCOMING', actor: 'BUYER', canal: 'WHATSAPP', eventoEntradaId: 's:m9', contenido: 'Hola', estadoProcesamiento: 'RECIBIDO' });

    const r1 = await orq.recibir(wa('b1', 'Hola', 's:m9'));
    const r2 = await orq.recibir(wa('b1', 'Hola', 's:m9'));

    expect(r1).toMatchObject({ estado: 'RESPONDIDO', mensajeEntradaId: 'msg-caido' });
    expect(r2.estado).toBe('DUPLICADO');
    expect(ai.procesarRespuestaIA).toHaveBeenCalledTimes(1);
    expect(openWA.sendTextMessage).toHaveBeenCalledTimes(1);
    expect(tiposEvento(prisma)).toContain('PROCESAMIENTO_REANUDADO');
    expect(prisma.db.mensaje.filter((m: any) => m.direccion === 'INCOMING')).toHaveLength(1); // sin duplicar la entrada
  });

  it('error de IA: no se responde, queda ERROR y el reintento del mismo evento lo atiende', async () => {
    const { orq, prisma, ai, openWA } = montar();
    ai.procesarRespuestaIA.mockRejectedValueOnce(new Error('timeout del proveedor'));
    const r1 = await orq.recibir(wa('b1', 'Hola', 's:m1'));
    expect(r1.estado).toBe('ERROR_IA');
    expect(openWA.sendTextMessage).not.toHaveBeenCalled();
    expect(prisma.db.mensaje.find((m: any) => m.eventoEntradaId === 's:m1').estadoProcesamiento).toBe('ERROR');

    const r2 = await orq.recibir(wa('b1', 'Hola', 's:m1'));
    expect(r2.estado).toBe('RESPONDIDO');
    expect(openWA.sendTextMessage).toHaveBeenCalledTimes(1);
  });

  it('una respuesta ya registrada por otra instancia impide un segundo envío (índice UX_MENSAJE_RESPUESTA_IA)', async () => {
    const { orq, prisma, openWA } = montar();
    prisma.db.conversacion.push({ id: 'conv-x', buyerId: 'b1', leadId: 'lead-1', oportunidadId: 'op-lead-1', fechaInicio: new Date() });
    prisma.db.mensaje.push({ id: 'msg-e', conversacionId: 'conv-x', direccion: 'INCOMING', actor: 'BUYER', canal: 'WHATSAPP', eventoEntradaId: 's:m1', contenido: 'Hola', estadoProcesamiento: 'RECIBIDO' });
    // Otra instancia reservó la respuesta pero aún no marcó la entrada como procesada
    const crear = prisma.mensaje.count;
    prisma.mensaje.count = async () => 0;
    prisma.db.mensaje.push({ id: 'msg-r', conversacionId: 'conv-x', direccion: 'OUTGOING', actor: 'AGENTE_IA', respuestaA: 'msg-e', estadoEntrega: 'PENDIENTE' });
    const r = await orq.recibir(wa('b1', 'Hola', 's:m1'));
    prisma.mensaje.count = crear;
    expect(r.estado).toBe('DUPLICADO');
    expect(openWA.sendTextMessage).not.toHaveBeenCalled();
  });

  it('concurrencia: mensajes del MISMO estudiante se atienden en serie y en orden; distintos estudiantes en paralelo', async () => {
    const { orq, prisma, concurrencia } = montar({ iaDelayMs: 15 });
    await Promise.all([
      orq.recibir(wa('b1', 'primero', 's:a1')),
      orq.recibir(wa('b1', 'segundo', 's:a2')),
      orq.recibir(wa('b2', 'otro estudiante', 's:b1')),
    ]);
    expect(concurrencia.maxPorBuyer.b1).toBe(1);
    expect(concurrencia.maxGlobal).toBe(2);
    const contenidoB1 = prisma.db.mensaje
      .filter((m: any) => m.direccion === 'OUTGOING' && m.contenido.startsWith('R: ') && !m.contenido.includes('otro'))
      .map((m: any) => m.contenido);
    expect(contenidoB1).toEqual(['R: primero', 'R: segundo']);
  });

  it('continuidad: se reutiliza la conversación de la oportunidad abierta; si se cerró y hay un ciclo nuevo, se abre otra conversación', async () => {
    const { orq, oportunidades } = montar();
    const r1 = await orq.recibir(wa('b1', 'Hola', 's:1'));
    const r2 = await orq.recibir(wa('b1', 'Sigo aquí', 's:2'));
    expect(r2.conversacionId).toBe(r1.conversacionId);

    oportunidades.abrirParaLead.mockResolvedValue({ oportunidad: { id: 'op-nuevo-ciclo' }, creada: true });
    const r3 = await orq.recibir(wa('b1', 'Vuelvo meses después', 's:3'));
    expect(r3.oportunidadId).toBe('op-nuevo-ciclo');
    expect(r3.conversacionId).not.toBe(r1.conversacionId);
  });

  it('sin consentimiento: la respuesta queda LOCAL_ONLY y no se envía por WhatsApp', async () => {
    const { orq, prisma, openWA } = montar();
    await orq.recibir(wa('b-sin', 'Hola', 's:1'));
    expect(openWA.sendTextMessage).not.toHaveBeenCalled();
    expect(prisma.db.mensaje.find((m: any) => m.direccion === 'OUTGOING')).toMatchObject({
      estadoEntrega: 'LOCAL_ONLY',
      consentimientoAplicado: 'SIN_CONSENTIMIENTO',
    });
  });

  it('mensajes muy largos se recortan y se registra el recorte', async () => {
    const { orq, prisma, ai } = montar();
    await orq.recibir(wa('b1', 'x'.repeat(MAX_CARACTERES_ENTRADA + 500), 's:1'));
    expect(ai.procesarRespuestaIA.mock.calls[0][0].ultimoMensajeCliente).toHaveLength(MAX_CARACTERES_ENTRADA);
    expect(JSON.parse(prisma.db.mensaje[0].metadata).recortado).toBe(true);
  });

  it('respuesta de contingencia sin modelo → evento IA_NO_DISPONIBLE visible en la línea de tiempo', async () => {
    const { orq, prisma, ai } = montar();
    ai.procesarRespuestaIA.mockResolvedValueOnce({ respuestaTexto: 'Gracias, te respondemos pronto', origen: 'HEURISTICA_LOCAL' } as any);
    await orq.recibir(wa('b1', 'Hola', 's:1'));
    expect(tiposEvento(prisma)).toContain('IA_NO_DISPONIBLE');
  });

  it('la bitácora no guarda teléfonos ni correos', async () => {
    const { orq, prisma } = montar();
    await orq.recibir({ ...wa('b1', 'Hola', 's:1'), waChatId: '51900000001@c.us' });
    const bitacora = JSON.stringify(prisma.db.evento);
    expect(bitacora).not.toContain('51900000001');
    expect(bitacora).not.toContain('b1@gmail.com');
  });
});
