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
    transferenciaPayer: { count: jest.fn().mockResolvedValue(0) },
    oportunidadComercial: { findUnique: jest.fn().mockResolvedValue({ id: 'op-1', fechaCierre: null }) },
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
  const oportunidades = {
    abrirParaLead: jest.fn().mockResolvedValue({ oportunidad: { id: 'op-1' }, creada: false }),
    transicionar: jest.fn().mockResolvedValue({}),
  };
  const orquestador = { recibir: jest.fn().mockResolvedValue({ estado: 'RESPONDIDO', canal: 'WHATSAPP' }) };
  const eventos = { registrar: jest.fn() };
  let svc: NegotiationService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = crearPrisma();
    svc = new NegotiationService(prisma as any, ai as any, whatsapp as any, oportunidades as any, orquestador as any, eventos as any);
  });

  describe('remitentes de WhatsApp', () => {
    it('LID desconocido → cuarentena; no se asocia a otro estudiante ni se responde', async () => {
      const r = await svc.procesarMensajeEstudiante('78366141100181', 'Hola, info', { waChatId: '78366141100181@lid' });

      expect(r).toMatchObject({ exito: false, estado: 'CUARENTENA', motivo: 'NO_REGISTRADO' });
      expect(prisma.notificacion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: NOTIF_CUARENTENA_WHATSAPP }) }));
      expect(eventos.registrar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'REMITENTE_EN_CUARENTENA' }));
      // Nunca se consulta "la conversación más reciente" ni se atiende el mensaje
      expect(prisma.conversacion.findFirst).not.toHaveBeenCalled();
      expect(orquestador.recibir).not.toHaveBeenCalled();
      expect(whatsapp.enviarMensaje).not.toHaveBeenCalled();
    });

    it('la bitácora de cuarentena no guarda el número ni el texto del remitente', async () => {
      await svc.procesarMensajeEstudiante('78366141100181', 'Mi DNI es 12345678', { waChatId: '78366141100181@lid' });
      const evento = JSON.stringify(eventos.registrar.mock.calls[0][0]);
      expect(evento).not.toContain('78366141100181');
      expect(evento).not.toContain('12345678');
    });

    it('número compartido por dos BUYER → cuarentena por ambigüedad', async () => {
      prisma.buyer.findMany.mockResolvedValue([buyerReal, { ...buyerReal, id: 'b-2' }]);
      const r = await svc.procesarMensajeEstudiante('51987654321', 'Hola');
      expect(r).toMatchObject({ estado: 'CUARENTENA', motivo: 'AMBIGUO' });
      expect(orquestador.recibir).not.toHaveBeenCalled();
    });

    it('remitente identificado → se delega al orquestador con el evento de entrada del webhook', async () => {
      prisma.buyer.findMany.mockResolvedValue([buyerReal]);
      await svc.procesarMensajeEstudiante('51987654321', 'Hola', { waChatId: '51987654321@c.us', eventoEntradaId: 's1:m1', providerMessageId: 'm1' });
      expect(orquestador.recibir).toHaveBeenCalledWith({
        canal: 'WHATSAPP',
        buyerId: 'b-real',
        contenido: 'Hola',
        actor: { tipo: 'BUYER' },
        eventoEntradaId: 's1:m1',
        providerMessageId: 'm1',
        waChatId: '51987654321@c.us',
      });
    });

    it('LID vinculado previamente a un único estudiante → se atiende a ese estudiante', async () => {
      prisma.mensaje.findMany.mockResolvedValue([{ conversacion: { buyerId: 'b-real' } }]);
      prisma.buyer.findUnique.mockResolvedValue(buyerReal);
      await svc.procesarMensajeEstudiante('78366141100181', 'Hola', { waChatId: '78366141100181@lid' });
      expect(orquestador.recibir).toHaveBeenCalledWith(expect.objectContaining({ buyerId: 'b-real' }));
    });
  });

  describe('chat de prueba interno', () => {
    it('usa el MISMO orquestador por CHAT_WEB_INTERNO con actor ADMIN_TEST y el usuario real', async () => {
      prisma.conversacion.findUnique.mockResolvedValue({ buyerId: 'b-real' });
      await svc.procesarMensajePrueba({ conversacionId: 'conv-1', contenido: ' Hola ', actorUsuarioId: 'u-admin', clientMessageId: 'cli-1' });
      expect(orquestador.recibir).toHaveBeenCalledWith({
        canal: 'CHAT_WEB_INTERNO',
        buyerId: 'b-real',
        contenido: 'Hola',
        actor: { tipo: 'ADMIN_TEST', usuarioId: 'u-admin' },
        eventoEntradaId: 'cli-1',
      });
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

    it('el reset no borra la oportunidad: la cierra como DESCARTADA con motivo', async () => {
      prisma.conversacion.findUnique.mockResolvedValue({ id: 'conv-1', buyer: buyerFicticio, oportunidadId: 'op-1', mensajes: [] });
      await svc.limpiarConversacion('conv-1');
      expect(oportunidades.transicionar).toHaveBeenCalledWith('op-1', 'DESCARTADA', { tipo: 'SISTEMA' }, expect.stringContaining('REINICIO_SANDBOX'));
    });

    it('estudiante ficticio con acuerdo transferido a PAYERS → 409', async () => {
      prisma.conversacion.findUnique.mockResolvedValue({ id: 'conv-1', buyer: buyerFicticio });
      prisma.transferenciaPayer.count.mockResolvedValue(1);
      await expect(svc.limpiarConversacion('conv-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
