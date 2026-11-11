import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService.enviarMensaje (reserva → envío → estado real)', () => {
  const prisma = {
    mensaje: { create: jest.fn(), update: jest.fn() },
    conversacion: { update: jest.fn() },
  };
  const openWA = { sendTextMessage: jest.fn() };
  const svc = new WhatsAppService(openWA as any, prisma as any);
  const base = { conversacionId: 'c1', telefono: '51987654321', contenido: 'Hola' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mensaje.create.mockResolvedValue({ id: 'm1' });
  });

  const reservado = () => prisma.mensaje.create.mock.calls[0][0].data;
  const final = () => prisma.mensaje.update.mock.calls[0][0].data;

  it('reserva la fila como PENDIENTE ANTES de enviar', async () => {
    const orden: string[] = [];
    prisma.mensaje.create.mockImplementation(async () => (orden.push('reserva'), { id: 'm1' }));
    openWA.sendTextMessage.mockImplementation(async () => (orden.push('envio'), { estado: 'SENT', exito: true }));
    await svc.enviarMensaje(base);
    expect(orden).toEqual(['reserva', 'envio']);
    expect(reservado().estadoEntrega).toBe('PENDIENTE');
  });

  it('OpenWA caído → FAILED, nunca SENT', async () => {
    openWA.sendTextMessage.mockResolvedValue({ estado: 'FAILED', exito: false, error: 'OpenWA no disponible' });
    const r = await svc.enviarMensaje(base);
    expect(r.exito).toBe(false);
    expect(final().estadoEntrega).toBe('FAILED');
    expect(JSON.parse(final().metadata).errorEntrega).toBe('OpenWA no disponible');
  });

  it('envío aceptado → SENT con el id del proveedor', async () => {
    openWA.sendTextMessage.mockResolvedValue({ estado: 'SENT', exito: true, messageId: 'wa1' });
    const r = await svc.enviarMensaje(base);
    expect(final()).toMatchObject({ estadoEntrega: 'SENT', providerMessageId: 'wa1' });
    expect(r.mensajeId).toBe('m1');
  });

  it('canal CHAT_WEB_INTERNO → LOCAL_ONLY y no toca OpenWA', async () => {
    const r = await svc.enviarMensaje({ ...base, canal: 'CHAT_WEB_INTERNO' });
    expect(openWA.sendTextMessage).not.toHaveBeenCalled();
    expect(r.estado).toBe('LOCAL_ONLY');
    expect(final().estadoEntrega).toBe('LOCAL_ONLY');
  });

  it('motivoLocal (sin consentimiento) → LOCAL_ONLY con el motivo y sin envío', async () => {
    await svc.enviarMensaje({ ...base, motivoLocal: 'SIN_CONSENTIMIENTO' });
    expect(openWA.sendTextMessage).not.toHaveBeenCalled();
    expect(final().estadoEntrega).toBe('LOCAL_ONLY');
    expect(JSON.parse(final().metadata).motivoLocal).toBe('SIN_CONSENTIMIENTO');
  });

  it('si la respuesta a ese mensaje ya existe (índice único), no se envía nada', async () => {
    prisma.mensaje.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));
    const r = await svc.enviarMensaje({ ...base, respuestaA: 'entrada-1', actor: 'AGENTE_IA' });
    expect(r.duplicado).toBe(true);
    expect(openWA.sendTextMessage).not.toHaveBeenCalled();
    expect(prisma.mensaje.update).not.toHaveBeenCalled();
  });

  it('la metadata ya no guarda el teléfono del destinatario', async () => {
    openWA.sendTextMessage.mockResolvedValue({ estado: 'SENT', exito: true, messageId: 'wa1' });
    await svc.enviarMensaje(base);
    expect(JSON.stringify([reservado(), final()])).not.toContain('51987654321');
  });
});
