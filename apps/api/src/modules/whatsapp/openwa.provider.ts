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

export interface SendMessageResult {
  exito: boolean;
  messageId: string;
  /** true cuando OpenWA no estaba disponible y el mensaje solo se registró localmente. */
  simulado?: boolean;
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
  private readonly allowSimulation: boolean;
  private sessionIdCache: string | null = null;

  constructor() {
    const baseUrl = (process.env.OPENWA_BASE_URL || 'http://localhost:2785').replace(/\/+$/, '');
    this.sessionName = process.env.OPENWA_SESSION_NAME || 'inbestiga-bot';
    this.defaultCountryCode = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '51';
    // En desarrollo, si OpenWA no responde, se simula el envío para no bloquear demos.
    // En producción debe estar desactivado para no marcar como "enviado" algo que nunca salió.
    this.allowSimulation = (process.env.OPENWA_ALLOW_SIMULATION ?? (process.env.NODE_ENV !== 'production' ? 'true' : 'false')) === 'true';

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

  /** Envía un mensaje de texto por WhatsApp. */
  async sendTextMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const chatId = this.toChatId(options.chatId);
    this.logger.log(`[OpenWA] Enviando a ${chatId}: "${options.text.substring(0, 60)}..."`);

    try {
      const sessionId = await this.getOrCreateSession();
      const { data } = await this.client.post(`/sessions/${sessionId}/messages/send-text`, {
        chatId,
        text: options.text,
      });
      this.logger.log(`✓ [OpenWA] Mensaje aceptado por el gateway. ID: ${data?.messageId}`);
      return { exito: true, messageId: data?.messageId, detalles: data };
    } catch (error: any) {
      const status = error.response?.status;
      const errMsg = error.response?.data?.message || error.message;
      // 404 = la sesión cacheada ya no existe → olvidarla para recrearla en el próximo intento
      if (status === 404) this.sessionIdCache = null;

      if (this.allowSimulation) {
        this.logger.warn(`[OpenWA] Envío no completado (${status ?? 'sin respuesta'}: ${errMsg}). Modo simulación: se registra solo en BD.`);
        return {
          exito: true,
          simulado: true,
          messageId: `msg_wa_sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          detalles: { fallback: true, chatId, error: errMsg },
        };
      }

      this.logger.error(`[OpenWA] Falló el envío a ${chatId}: ${status ?? ''} ${errMsg}`);
      return { exito: false, messageId: '', detalles: { chatId, status, error: errMsg } };
    }
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
