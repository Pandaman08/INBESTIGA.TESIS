import { ConflictException, ForbiddenException } from '@nestjs/common';
import { NegotiationService, NOTIF_CUARENTENA_WHATSAPP } from './negotiation.service';

const buyerReal = {
  id: 'b-real',
  nombres: 'Ana',
  apellidos: 'Prueba',
  email: 'ana@gmail.com',
  whatsapp: '51987654321',
  consentimientoWhatsapp: true,
};
const buyerFicticio = { ...buyerReal, id: 'b-demo', email: 'ana@demo.inbestiga.test' };

function crearPrisma() {
  return {
    buyer: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    lead: { findUnique: jest.fn().mockResolvedValue({ id: 'lead-1' }) },
    conversacion: {
      findFirst: jest.fn().mockResolvedValue({ id: 'conv-1', buyerId: 'b-real' }),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockReturnValue('op-update'),
    },
    mensaje: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockReturnValue('op-msg') },
    notificacion: { create: jest.fn(), findMany: jest.fn() },
    objecion: { deleteMany: jest.fn().mockReturnValue('op-obj') },
    diagnostico: { deleteMany: jest.fn().mockReturnValue('op-diag') },
    seguimiento: { deleteMany: jest.fn().mockReturnValue('op-seg') },
    propuesta: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockReturnValue('op-prop') },
    payer: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() },
    pago: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() },
    cotizacion: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() },
    customer: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

describe('NegotiationService', () => {
  let prisma: ReturnType<typeof crearPrisma>;
  const ai = {
    procesarRespuestaIA: jest.fn().mockResolvedValue({ respuestaTexto: 'Respuesta IA', etapaNueva: 'DIAGNOSTIC', actionMetadata: null }),
    generarMensajeInicial: jest.fn().mockResolvedValue('Hola'),
  };
  const whatsapp = { enviarMensaje: jest.fn().mockResolvedValue({ estado: 'SENT', exito: true }) };
  let svc: NegotiationService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = crearPrisma();
    svc = new NegotiationService(prisma as any, ai as any, whatsapp as any);
  });

  describe('remitentes de WhatsApp', () => {
    it('LID desconocido → cuarentena; no se asocia a otro estudiante ni se responde', async () => {
      const r = await svc.procesarMensajeEstudiante('78366141100181', 'Hola, info', { waChatId: '78366141100181@lid' });

      expect(r).toMatchObject({ exito: false, estado: 'CUARENTENA', motivo: 'NO_REGISTRADO' });
      expect(prisma.notificacion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: NOTIF_CUARENTENA_WHATSAPP }) }));
      // Nunca se consulta "la conversación más reciente" ni se escribe en conversaciones de otros
      expect(prisma.conversacion.findFirst).not.toHaveBeenCalled();
      expect(prisma.mensaje.create).not.toHaveBeenCalled();
      expect(ai.procesarRespuestaIA).not.toHaveBeenCalled();
      expect(whatsapp.enviarMensaje).not.toHaveBeenCalled();
    });

    it('número compartido por dos BUYER → cuarentena por ambigüedad', async () => {
      prisma.buyer.findMany.mockResolvedValue([buyerReal, { ...buyerReal, id: 'b-2' }]);
      const r = await svc.procesarMensajeEstudiante('51987654321', 'Hola');
      expect(r).toMatchObject({ estado: 'CUARENTENA', motivo: 'AMBIGUO' });
      expect(ai.procesarRespuestaIA).not.toHaveBeenCalled();
    });

    it('LID vinculado previamente a un único estudiante → se atiende a ese estudiante', async () => {
      prisma.mensaje.findMany.mockResolvedValue([{ conversacion: { buyerId: 'b-real' } }]);
      prisma.buyer.findUnique.mockResolvedValue(buyerReal);
      const r = await svc.procesarMensajeEstudiante('78366141100181', 'Hola', { waChatId: '78366141100181@lid' });
      expect(r).toMatchObject({ exito: true, canal: 'WHATSAPP' });
    });

    it('estudiante sin consentimiento → la respuesta queda LOCAL_ONLY (no se envía)', async () => {
      prisma.buyer.findMany.mockResolvedValue([{ ...buyerReal, consentimientoWhatsapp: false }]);
      await svc.procesarMensajeEstudiante('51987654321', 'Hola');
      expect(whatsapp.enviarMensaje).toHaveBeenCalledWith(expect.objectContaining({ motivoLocal: 'SIN_CONSENTIMIENTO' }));
    });

    it('estudiante ficticio con número no autorizado → LOCAL_ONLY', async () => {
      delete process.env.WHATSAPP_TEST_ALLOWLIST;
      prisma.buyer.findMany.mockResolvedValue([buyerFicticio]);
      await svc.procesarMensajeEstudiante('51987654321', 'Hola');
      expect(whatsapp.enviarMensaje).toHaveBeenCalledWith(expect.objectContaining({ motivoLocal: 'BUYER_FICTICIO_NO_AUTORIZADO' }));
    });
  });

  describe('chat de prueba interno', () => {
    it('registra la entrada como ADMIN_TEST con el usuario real y responde por CHAT_WEB_INTERNO', async () => {
      prisma.conversacion.findUnique.mockResolvedValue({ id: 'conv-1', buyer: buyerReal });
      await svc.procesarMensajePrueba({ conversacionId: 'conv-1', contenido: 'Hola', actorUsuarioId: 'u-admin' });

      const entrada = prisma.mensaje.create.mock.calls[0][0].data;
      expect(entrada).toMatchObject({ direccion: 'INCOMING', remitente: 'ADMIN_TEST', estadoEntrega: 'LOCAL_ONLY' });
      expect(JSON.parse(entrada.metadata)).toMatchObject({ canal: 'CHAT_WEB_INTERNO', actorUsuarioId: 'u-admin' });
      expect(whatsapp.enviarMensaje).toHaveBeenCalledWith(expect.objectContaining({ canal: 'CHAT_WEB_INTERNO' }));
    });
  });

  describe('reinicio de conversaciones', () => {
    const ningunBorradoDePayers = () => {
      for (const t of ['payer', 'pago', 'cotizacion', 'customer'] as const) {
        expect(prisma[t].deleteMany).not.toHaveBeenCalled();
      }
    };

    it('intento de reset sobre un estudiante REAL → 403 y no borra nada', async () => {
      prisma.conversacion.findUnique.mockResolvedValue({ id: 'conv-1', buyer: buyerReal });
      await expect(svc.limpiarConversacion('conv-1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.mensaje.deleteMany).not.toHaveBeenCalled();
      ningunBorradoDePayers();
    });

    it('estudiante ficticio que ya tiene PAYER/pago → 409 y no borra nada', async () => {
      prisma.conversacion.findUnique.mockResolvedValue({ id: 'conv-1', buyer: buyerFicticio });
      prisma.pago.count.mockResolvedValue(1);
      await expect(svc.limpiarConversacion('conv-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      ningunBorradoDePayers();
    });

    it('reset deshabilitado por configuración → 403', async () => {
      process.env.LEADS_SANDBOX_RESET_ENABLED = 'false';
      prisma.conversacion.findUnique.mockResolvedValue({ id: 'conv-1', buyer: buyerFicticio });
      await expect(svc.limpiarConversacion('conv-1')).rejects.toBeInstanceOf(ForbiddenException);
      delete process.env.LEADS_SANDBOX_RESET_ENABLED;
    });

    it('estudiante ficticio sin PAYERS → borra SOLO datos de LEADS en una transacción', async () => {
      prisma.conversacion.findUnique.mockResolvedValue({ id: 'conv-1', buyer: buyerFicticio, mensajes: [] });
      const r = await svc.limpiarConversacion('conv-1');
      expect(r.exito).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledWith(['op-msg', 'op-obj', 'op-diag', 'op-seg', 'op-prop', 'op-update']);
      ningunBorradoDePayers();
    });
  });
});
