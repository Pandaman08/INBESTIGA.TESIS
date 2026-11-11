import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

/**
 * Cliente HTTP para el gateway OpenWA (https://github.com/Pandaman08/OpenWA).
 *
 * Endpoints usados (ver OpenWA/docs/06-api-specification.md):
 *  - GET    /api/sessions                          → listar sesiones
 *  - POST   /api/sessions            { name }      → crear sesión
 *  - POST   /api/sessions/:id/start                → iniciar motor (genera QR)
 *  - GET    /api/sessions/:id                      → estado de la sesión
 *  - GET    /api/sessions/:id/qr                   → { qrCode: dataURL, status }
 *  - POST   /api/sessions/:id/messages/send-text   { chatId, text } → { messageId }
 *  - GET    /api/sessions/:id/webhooks             → listar webhooks
 *  - POST   /api/sessions/:id/webhooks             { url, events, secret }
 * Autenticación: cabecera X-API-Key.
 */

export interface SendMessageOptions {
  chatId: string;
  text: string;
}

/**
 * Estado de entrega de un mensaje saliente (columna MENSAJE.estadoEntrega).
 *  - SENT:       el gateway aceptó el mensaje (201). No confirma la recepción en el teléfono.
 *  - QUEUED:     el gateway lo encoló (202); se confirmará o fallará después.
 *  - FAILED:     el transporte falló o lo rechazó. El mensaje NO salió.
 *  - LOCAL_ONLY: registrado solo en la BD (chat interno, sin consentimiento o número no autorizado).
 * Nunca se reintenta automáticamente un mensaje FAILED o LOCAL_ONLY.
 */
export type EstadoEntrega = 'SENT' | 'QUEUED' | 'FAILED' | 'LOCAL_ONLY';

export interface SendMessageResult {
  estado: EstadoEntrega;
  /** true solo si el gateway aceptó el mensaje (SENT o QUEUED). */
  exito: boolean;
  messageId?: string;
  error?: string;
  /** Segundos sugeridos por OpenWA antes de volver a intentar (429). Informativo: no se reintenta solo. */
  retryAfterSeconds?: number;
  detalles?: any;
}

export type OpenWASessionStatus =
  | 'created'
  | 'initializing'
  | 'qr_ready'
  | 'authenticating'
  | 'ready'
  | 'disconnected'
  | 'action_required'
  | 'failed';

export interface OpenWASession {
  id: string;
  name: string;
  status: OpenWASessionStatus;
  phone?: string | null;
  pushName?: string | null;
  engineLoaded?: boolean;
  lastError?: string | null;
}

export const OPENWA_WEBHOOK_EVENTS = ['message.received', 'session.status'];

@Injectable()
export class OpenWAProvider {
  private readonly logger = new Logger(OpenWAProvider.name);
  private readonly client: AxiosInstance;
  private readonly sessionName: string;
  private readonly defaultCountryCode: string;
  private sessionIdCache: string | null = null;

  constructor() {
    const baseUrl = (process.env.OPENWA_BASE_URL || 'http://localhost:2785').replace(/\/+$/, '');
    this.sessionName = process.env.OPENWA_SESSION_NAME || 'inbestiga-bot';
    this.defaultCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '51';

    this.client = axios.create({
      baseURL: `${baseUrl}/api`,
      headers: {
        'X-API-Key': process.env.OPENWA_API_KEY || '',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  get configuredSessionName(): string {
    return this.sessionName;
  }

  /** Convierte un teléfono o JID a un chatId válido de WhatsApp. Respeta @lid / @g.us tal cual. */
  toChatId(raw: string): string {
    const value = String(raw).trim();
    if (value.includes('@')) return value;
    let digits = value.replace(/\D/g, '');
    if (digits.length === 9) digits = this.defaultCountryCode + digits; // celular peruano sin código
    return `${digits}@c.us`;
  }

  private async findSessionByName(): Promise<OpenWASession | undefined> {
    const { data } = await this.client.get<OpenWASession[]>('/sessions');
    return Array.isArray(data) ? data.find((s) => s.name === this.sessionName) : undefined;
  }

  /**
   * Devuelve el ID (UUID) de la sesión configurada, creándola si no existe.
   * Solo se usa la sesión cuyo nombre coincide con OPENWA_SESSION_NAME, para no
   * enviar mensajes desde otro número que comparta el mismo gateway.
   */
  async getOrCreateSession(): Promise<string> {
    if (this.sessionIdCache) return this.sessionIdCache;

    const existing = await this.findSessionByName();
    if (existing) {
      this.sessionIdCache = existing.id;
      return existing.id;
    }

    this.logger.log(`Creando sesión OpenWA "${this.sessionName}"...`);
    const { data } = await this.client.post<OpenWASession>('/sessions', { name: this.sessionName });
    this.sessionIdCache = data.id;
    return data.id;
  }

  /** Inicia el motor de la sesión si aún no está cargado (necesario para obtener el QR). */
  async startSession(): Promise<OpenWASession> {
    const sessionId = await this.getOrCreateSession();
    const { data: session } = await this.client.get<OpenWASession>(`/sessions/${sessionId}`);
    if (!session.engineLoaded) {
      this.logger.log(`Iniciando motor de la sesión OpenWA ${sessionId}...`);
      const { data } = await this.client.post<OpenWASession>(`/sessions/${sessionId}/start`);
      return data;
    }
    return session;
  }

  /**
   * Registra (una sola vez) el webhook de INBESTIGA en la sesión de OpenWA.
   * Si ya existe uno con la misma URL no se duplica.
   */
  async ensureWebhook(url: string, secret?: string): Promise<'created' | 'exists'> {
    const sessionId = await this.getOrCreateSession();
    const { data: hooks } = await this.client.get<Array<{ id: string; url: string }>>(`/sessions/${sessionId}/webhooks`);
    if (Array.isArray(hooks) && hooks.some((h) => h.url === url)) return 'exists';

    await this.client.post(`/sessions/${sessionId}/webhooks`, {
      url,
      events: OPENWA_WEBHOOK_EVENTS,
      ...(secret ? { secret } : {}),
    });
    return 'created';
  }

  /**
   * Envía un mensaje de texto por WhatsApp y devuelve el resultado REAL del transporte.
   * Si OpenWA no responde o rechaza el envío, el estado es FAILED (nunca un éxito simulado).
   */
  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const chatId = this.toChatId(options.chatId);
    this.logger.log(`[OpenWA] Enviando a ${this.mask(chatId)}`);

    try {
      const sessionId = await this.getOrCreateSession();
      const res = await this.client.post(`/sessions/${sessionId}/messages/send-text`, {
        chatId,
        text: options.text,
      });
      const estado: EstadoEntrega = res.status === 202 ? 'QUEUED' : 'SENT';
      this.logger.log(`✓ [OpenWA] ${estado}. ID: ${res.data?.messageId}`);
      return { estado, exito: true, messageId: res.data?.messageId, detalles: res.data };
    } catch (error: any) {
      const status: number | undefined = error.response?.status;
      const errMsg: string = error.response?.data?.message || error.message;
      // 404 = la sesión cacheada ya no existe → olvidarla para recrearla en el próximo intento
      if (status === 404) this.sessionIdCache = null;
      this.logger.error(`[OpenWA] FAILED a ${this.mask(chatId)}: ${status ?? 'sin respuesta'} ${errMsg}`);
      return {
        estado: 'FAILED',
        exito: false,
        error: status ? `HTTP ${status}: ${errMsg}` : `OpenWA no disponible: ${errMsg}`,
        retryAfterSeconds: error.response?.data?.retryAfterSeconds,
      };
    }
  }

  /** Enmascara el número en logs: 51987654321@c.us → 519*****321@c.us */
  private mask(chatId: string): string {
    const [id, dom] = chatId.split('@');
    return id.length > 6 ? `${id.slice(0, 3)}*****${id.slice(-3)}@${dom}` : chatId;
  }

  /** Estado de la sesión y, si corresponde, el QR (data URL) para vincular el número. */
  async getSessionStatus(): Promise<{
    conectado: boolean;
    status: string;
    sessionId?: string;
    qr?: string;
    phone?: string | null;
    pushName?: string | null;
    error?: string | null;
  }> {
    try {
      const sessionId = await this.getOrCreateSession();
      const { data: session } = await this.client.get<OpenWASession>(`/sessions/${sessionId}`);

      let qr: string | undefined;
      if (session.status === 'qr_ready') {
        const qrRes = await this.client.get(`/sessions/${sessionId}/qr`).catch(() => null);
        qr = qrRes?.data?.qrCode;
      }

      return {
        conectado: session.status === 'ready',
        status: session.status,
        sessionId,
        qr,
        phone: session.phone,
        pushName: session.pushName,
        error: session.lastError,
      };
    } catch (e: any) {
      if (e.response?.status === 404) this.sessionIdCache = null;
      return { conectado: false, status: 'OPENWA_UNREACHABLE', error: e.response?.data?.message || e.message };
    }
  }
}
