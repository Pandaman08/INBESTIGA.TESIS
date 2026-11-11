import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';

const SECRET = 'secreto-de-prueba';
const flush = () => new Promise((r) => setImmediate(r));

function firmar(payload: object) {
  const raw = Buffer.from(JSON.stringify(payload));
  return { raw, sig: 'sha256=' + createHmac('sha256', SECRET).update(raw).digest('hex') };
}

function mensaje(over: Record<string, any> = {}, idempotencyKey = 'msg_s_1') {
  return {
    event: 'message.received',
    sessionId: 's',
    idempotencyKey,
    data: { id: 'm1', from: '51987654321@c.us', body: 'Hola', type: 'text', fromMe: false, isGroup: false, kind: 'individual', ...over },
  };
}

describe('WhatsAppController.handleWebhook', () => {
  const negotiation = { procesarMensajeEstudiante: jest.fn().mockResolvedValue({}) };
  let ctrl: WhatsAppController;

  beforeEach(() => {
    process.env.OPENWA_WEBHOOK_SECRET = SECRET;
    jest.clearAllMocks();
    ctrl = new WhatsAppController({} as any, negotiation as any);
  });

  afterAll(() => delete process.env.OPENWA_WEBHOOK_SECRET);

  const enviar = (payload: any, sig?: string) => {
    const f = firmar(payload);
    return ctrl.handleWebhook({ rawBody: f.raw } as any, payload, sig ?? f.sig, payload.idempotencyKey);
  };

  it('webhook repetido (misma idempotency key) → se procesa una sola vez', async () => {
    const p = mensaje();
    expect(enviar(p)).toEqual({ status: 'accepted' });
    expect(enviar(p)).toEqual({ status: 'duplicate' });
    await flush();
    expect(negotiation.procesarMensajeEstudiante).toHaveBeenCalledTimes(1);
  });

  it('firma inválida o ausente → 401 y no se procesa', async () => {
    expect(() => enviar(mensaje(), 'sha256=00')).toThrow(UnauthorizedException);
    expect(() => enviar(mensaje({}, 'k2'), '')).toThrow(UnauthorizedException);
    await flush();
    expect(negotiation.procesarMensajeEstudiante).not.toHaveBeenCalled();
  });

  it('ignora grupos, mensajes propios y no-texto', async () => {
    expect(enviar(mensaje({ from: '1@g.us', isGroup: true, kind: 'group' }, 'g'))).toEqual({ status: 'ignored' });
    expect(enviar(mensaje({ fromMe: true }, 'f'))).toEqual({ status: 'ignored' });
    expect(enviar(mensaje({ type: 'image', body: '' }, 'i'))).toEqual({ status: 'ignored' });
    await flush();
    expect(negotiation.procesarMensajeEstudiante).not.toHaveBeenCalled();
  });

  it('remitente @lid: usa senderPhone si OpenWA lo resolvió y conserva el chatId', async () => {
    enviar(mensaje({ from: '78366141100181@lid', senderPhone: '51911222333' }, 'l1'));
    await flush();
    expect(negotiation.procesarMensajeEstudiante).toHaveBeenCalledWith('51911222333', 'Hola', {
      waChatId: '78366141100181@lid',
      eventoEntradaId: 's:m1',
      providerMessageId: 'm1',
    });
  });
});
