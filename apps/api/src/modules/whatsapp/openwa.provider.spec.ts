import axios from 'axios';
import { OpenWAProvider } from './openwa.provider';

jest.mock('axios');

describe('OpenWAProvider.sendTextMessage', () => {
  const client = { get: jest.fn(), post: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
    (axios.create as jest.Mock).mockReturnValue(client);
    // Sesión existente con el nombre configurado
    client.get.mockResolvedValue({ data: [{ id: 'sess-1', name: 'inbestiga-bot', status: 'ready' }] });
  });

  it('OpenWA caído → FAILED, exito=false y sin messageId (nunca un éxito simulado)', async () => {
    client.get.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:2785'), { code: 'ECONNREFUSED' }));
    const provider = new OpenWAProvider();

    const r = await provider.sendTextMessage({ chatId: '987654321', text: 'hola' });

    expect(r.estado).toBe('FAILED');
    expect(r.exito).toBe(false);
    expect(r.messageId).toBeUndefined();
    expect(r.error).toMatch(/OpenWA no disponible/);
  });

  it('rechazo del gateway (409 motor no listo) → FAILED con el código HTTP', async () => {
    client.post.mockRejectedValue({ response: { status: 409, data: { message: 'Engine not ready' } }, message: 'x' });
    const r = await new OpenWAProvider().sendTextMessage({ chatId: '987654321', text: 'hola' });
    expect(r).toMatchObject({ estado: 'FAILED', exito: false });
    expect(r.error).toContain('HTTP 409');
  });

  it('429 de ritmo de envío → FAILED informando retryAfterSeconds, sin reintentar', async () => {
    client.post.mockRejectedValue({
      response: { status: 429, data: { message: 'paced', code: 'SEND_PACING_LIMITED', retryAfterSeconds: 120 } },
      message: 'x',
    });
    const r = await new OpenWAProvider().sendTextMessage({ chatId: '987654321', text: 'hola' });
    expect(r).toMatchObject({ estado: 'FAILED', retryAfterSeconds: 120 });
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('201 del gateway → SENT con el messageId real; normaliza el número peruano a chatId', async () => {
    client.post.mockResolvedValue({ status: 201, data: { messageId: 'true_51987654321@c.us_ABC' } });
    const r = await new OpenWAProvider().sendTextMessage({ chatId: '987654321', text: 'hola' });
    expect(r).toMatchObject({ estado: 'SENT', exito: true, messageId: 'true_51987654321@c.us_ABC' });
    expect(client.post).toHaveBeenCalledWith('/sessions/sess-1/messages/send-text', { chatId: '51987654321@c.us', text: 'hola' });
  });

  it('202 del gateway → QUEUED', async () => {
    client.post.mockResolvedValue({ status: 202, data: { messageId: 'm1' } });
    const r = await new OpenWAProvider().sendTextMessage({ chatId: '51987654321@c.us', text: 'hola' });
    expect(r.estado).toBe('QUEUED');
  });

  it('no envía desde otra sesión del gateway que no sea OPENWA_SESSION_NAME', async () => {
    client.get.mockResolvedValue({ data: [{ id: 'otra', name: 'otro-numero', status: 'ready' }] });
    client.post.mockImplementation(async (url: string) =>
      url === '/sessions' ? { data: { id: 'nueva', name: 'inbestiga-bot' } } : { status: 201, data: { messageId: 'm' } },
    );
    await new OpenWAProvider().sendTextMessage({ chatId: '987654321', text: 'hola' });
    expect(client.post).toHaveBeenCalledWith('/sessions', { name: 'inbestiga-bot' });
    expect(client.post).toHaveBeenCalledWith('/sessions/nueva/messages/send-text', expect.anything());
  });
});
