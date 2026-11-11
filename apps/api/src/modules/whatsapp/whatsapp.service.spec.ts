import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService.enviarMensaje (persistencia del estado real)', () => {
  const prisma = {
    mensaje: { create: jest.fn() },
    conversacion: { update: jest.fn() },
  };
  const openWA = { sendTextMessage: jest.fn() };
  const svc = new WhatsAppService(openWA as any, prisma as any);
  const base = { conversacionId: 'c1', telefono: '51987654321', contenido: 'Hola' };

  beforeEach(() => jest.clearAllMocks());

  const estadoGuardado = () => prisma.mensaje.create.mock.calls[0][0].data.estadoEntrega;

  it('OpenWA caído → el mensaje se guarda FAILED, nunca SENT', async () => {
    openWA.sendTextMessage.mockResolvedValue({ estado: 'FAILED', exito: false, error: 'OpenWA no disponible' });
    const r = await svc.enviarMensaje(base);
    expect(r.exito).toBe(false);
    expect(estadoGuardado()).toBe('FAILED');
    expect(JSON.parse(prisma.mensaje.create.mock.calls[0][0].data.metadata).errorEntrega).toBe('OpenWA no disponible');
  });

  it('envío aceptado → SENT', async () => {
    openWA.sendTextMessage.mockResolvedValue({ estado: 'SENT', exito: true, messageId: 'wa1' });
    await svc.enviarMensaje(base);
    expect(estadoGuardado()).toBe('SENT');
  });

  it('canal CHAT_WEB_INTERNO → LOCAL_ONLY y no toca OpenWA', async () => {
    const r = await svc.enviarMensaje({ ...base, canal: 'CHAT_WEB_INTERNO' });
    expect(openWA.sendTextMessage).not.toHaveBeenCalled();
    expect(r.estado).toBe('LOCAL_ONLY');
    expect(estadoGuardado()).toBe('LOCAL_ONLY');
  });

  it('motivoLocal (sin consentimiento) → LOCAL_ONLY con el motivo y sin envío', async () => {
    await svc.enviarMensaje({ ...base, motivoLocal: 'SIN_CONSENTIMIENTO' });
    expect(openWA.sendTextMessage).not.toHaveBeenCalled();
    expect(estadoGuardado()).toBe('LOCAL_ONLY');
    expect(JSON.parse(prisma.mensaje.create.mock.calls[0][0].data.metadata).motivoLocal).toBe('SIN_CONSENTIMIENTO');
  });
});
