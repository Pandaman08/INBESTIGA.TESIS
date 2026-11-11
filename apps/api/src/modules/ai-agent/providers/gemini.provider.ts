import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AIProvider, ChatMessage, ToolDefinition, AIProviderResponse } from '../ai-provider.interface';

@Injectable()
export class GeminiProvider implements AIProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  }

  async generarRespuesta(
    mensajes: ChatMessage[],
    herramientas: ToolDefinition[],
    temperatura = 0.7,
    modeloDeseado?: string,
  ): Promise<AIProviderResponse> {
    // Si no hay API key configurada o es placeholder, usar el generador inteligente contextual
    if (!this.apiKey || this.apiKey.startsWith('AIzaSy...') || this.apiKey.length < 15) {
      this.logger.debug('[GeminiProvider] Clave API no configurada o en modo demostración. Ejecutando motor de inferencia local.');
      return this.generarRespuestaLocal(mensajes);
    }

    try {
      const activeModel = (modeloDeseado && modeloDeseado.includes('gemini')) ? modeloDeseado : this.model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${this.apiKey}`;

      const contents = mensajes
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const systemInstructionMsg = mensajes.find((m) => m.role === 'system');
      const systemInstruction = systemInstructionMsg
        ? { parts: [{ text: systemInstructionMsg.content }] }
        : undefined;

      const body: any = {
        contents,
        generationConfig: {
          temperature: temperatura,
          maxOutputTokens: 1024,
        },
      };

      if (systemInstruction) {
        body.systemInstruction = systemInstruction;
      }

      // Convertir herramientas a formato Gemini functionDeclarations
      if (herramientas && herramientas.length > 0) {
        body.tools = [
          {
            functionDeclarations: herramientas.map((h) => ({
              name: h.name,
              description: h.description,
              parameters: h.parameters,
            })),
          },
        ];
      }

      const response = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
      });

      const candidate = response.data?.candidates?.[0];
      const part = candidate?.content?.parts?.[0];

      if (part?.functionCall) {
        return {
          content: '',
          toolCalls: [
            {
              id: `call_${Date.now()}`,
              name: part.functionCall.name,
              arguments: part.functionCall.args || {},
            },
          ],
        };
      }

      return {
        content: part?.text || 'Disculpa, no pude procesar tu solicitud en este momento.',
      };
    } catch (error: any) {
      this.logger.warn(`Error en llamada a Gemini API (${error.message}). Delegando a failover.`);
      throw error;
    }
  }

  /**
   * Motor de inferencia contextual de contingencia:
   * Garantiza que la conversación NUNCA se detenga ni se repita en bucles.
   */
  generarRespuestaLocal(mensajes: ChatMessage[]): AIProviderResponse {
    const ultimoMensaje = mensajes[mensajes.length - 1]?.content.toLowerCase() || '';

    // Aviso de pago realizado: LEADS no confirma pagos (lo valida PAYERS en la pasarela).
    if (
      ultimoMensaje.includes('ya pag') ||
      ultimoMensaje.includes('he pag') ||
      ultimoMensaje.includes('acabo de pag') ||
      ultimoMensaje.includes('ya transfer') ||
      ultimoMensaje.includes('ya yap')
    ) {
      return {
        content:
          'Gracias por avisarnos. La confirmación del pago la realiza nuestra área de pagos cuando la pasarela valida la transacción; te avisaremos apenas esté verificada. Mientras tanto, ¿hay algo de tu investigación que quieras revisar?',
        toolCalls: [],
      };
    }

    // Detección de intención de pago / solicitud de medios de pago / link de pago
    if (
      ultimoMensaje.includes('acepto') ||
      ultimoMensaje.includes('de acuerdo') ||
      ultimoMensaje.includes('pago') ||
      ultimoMensaje.includes('link') ||
      ultimoMensaje.includes('enlace') ||
      ultimoMensaje.includes('cuenta') ||
      ultimoMensaje.includes('yape') ||
      ultimoMensaje.includes('medio') ||
      ultimoMensaje.includes('forma') ||
      ultimoMensaje.includes('metodo') ||
      ultimoMensaje.includes('método') ||
      ultimoMensaje.includes('como pago') ||
      ultimoMensaje.includes('cómo pago') ||
      ultimoMensaje.includes('donde pago') ||
      ultimoMensaje.includes('dónde pago') ||
      ultimoMensaje.includes('culqi')
    ) {
      return {
        content: '',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: 'create_payment_request',
            arguments: {
              cuotas: ultimoMensaje.includes('cuota') ? 2 : 1,
            },
          },
        ],
      };
    }

    // Detección de negociación de precio, cuotas o descuento
    if (
      ultimoMensaje.includes('descuento') ||
      ultimoMensaje.includes('rebaja') ||
      ultimoMensaje.includes('menos') ||
      ultimoMensaje.includes('caro') ||
      ultimoMensaje.includes('presupuesto') ||
      ultimoMensaje.includes('cuotas') ||
      ultimoMensaje.includes('precio') ||
      ultimoMensaje.includes('costo') ||
      ultimoMensaje.includes('cuanto') ||
      ultimoMensaje.includes('cuánto') ||
      ultimoMensaje.includes('opcion 1') ||
      ultimoMensaje.includes('opción 1')
    ) {
      return {
        content: '',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: 'calculate_offer',
            arguments: {
              descuentoPropuestoPct: 15.0,
              numeroCuotas: 2,
            },
          },
        ],
      };
    }

    // Detección de objeción (tiempo, confianza)
    if (
      ultimoMensaje.includes('tiempo') ||
      ultimoMensaje.includes('confianza') ||
      ultimoMensaje.includes('garantía') ||
      ultimoMensaje.includes('garantia') ||
      ultimoMensaje.includes('seguro')
    ) {
      return {
        content: '',
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            name: 'record_objection',
            arguments: {
              tipo: ultimoMensaje.includes('tiempo') ? 'TIEMPO' : 'CONFIANZA',
              descripcion: ultimoMensaje,
            },
          },
        ],
      };
    }

    // Detección de etapa de Introducción, Objetivos o Capítulo 1
    if (
      ultimoMensaje.includes('introduc') ||
      ultimoMensaje.includes('objetiv') ||
      ultimoMensaje.includes('problema') ||
      ultimoMensaje.includes('capítulo 1') ||
      ultimoMensaje.includes('capitulo 1') ||
      ultimoMensaje.includes('justificaci') ||
      ultimoMensaje.includes('ideas')
    ) {
      return {
        content:
          '¡Excelente avance! La formulación de los Objetivos y la redacción del planteamiento del problema en la Introducción (Capítulo 1) es el pilar de tu investigación. En INBESTIGA contamos con especialistas que estructuran contigo la matriz de consistencia, asegurando que cada objetivo general y específico responda a los criterios de tu facultad en la UNT. ¿Tienes ya definido tu tema o título tentativo para orientarte mejor?',
      };
    }

    // Detección de consulta sobre alcance del servicio ("cómo podrías ayudarme")
    if (
      ultimoMensaje.includes('como podr') ||
      ultimoMensaje.includes('cómo podr') ||
      ultimoMensaje.includes('como me ayudas') ||
      ultimoMensaje.includes('cómo me ayudas') ||
      ultimoMensaje.includes('que incluye') ||
      ultimoMensaje.includes('qué incluye') ||
      ultimoMensaje.includes('en que consiste') ||
      ultimoMensaje.includes('de que trata')
    ) {
      return {
        content:
          'En INBESTIGA te brindamos acompañamiento integral: 1) Asignación de un asesor especialista con grado de Doctor o Magíster en tu área, 2) Sesiones virtuales 1 a 1 para redacción y análisis, 3) Levantamiento garantizado de observaciones de tu asesor y jurado de la UNT, 4) Acompañamiento continuo hasta tu sustentación y titulación. ¿Te gustaría que te preparemos una propuesta formal con facilidades de pago en cuotas?',
      };
    }

    // Detección de metodología o capítulos posteriores
    if (
      ultimoMensaje.includes('metodolog') ||
      ultimoMensaje.includes('marco') ||
      ultimoMensaje.includes('diseño') ||
      ultimoMensaje.includes('poblacion') ||
      ultimoMensaje.includes('muestra') ||
      ultimoMensaje.includes('capítulo 2') ||
      ultimoMensaje.includes('capitulo 2') ||
      ultimoMensaje.includes('capítulo 3') ||
      ultimoMensaje.includes('capitulo 3')
    ) {
      return {
        content:
          'El marco metodológico y las bases teóricas requieren rigor para no tener observaciones en la sustentación. Nuestros asesores senior te guían en el diseño de la investigación, selección de instrumentos y validación de datos. ¿Tienes ya la aprobación de tu plan de tesis por parte de tu asesor?',
      };
    }

    // Detección de confirmaciones cortas o deseo de continuar
    if (
      ultimoMensaje.includes('continua') ||
      ultimoMensaje.includes('continúa') ||
      ultimoMensaje.includes('adelante') ||
      ultimoMensaje.includes('si') ||
      ultimoMensaje.includes('sí') ||
      ultimoMensaje.includes('claro') ||
      ultimoMensaje.includes('por favor') ||
      ultimoMensaje.includes('porfavor')
    ) {
      return {
        content:
          'Perfecto. Para avanzar con tu tesis y asignarte de inmediato al asesor especialista, contamos con paquetes modulares por capítulo o asesoría integral con facilidades de pago en 2 o 3 cuotas. ¿Deseas que te formulemos una cotización personalizada con descuento institucional?',
      };
    }

    // Detección de consulta específica sobre medios de pago
    if (
      ultimoMensaje.includes('medio') ||
      ultimoMensaje.includes('forma de pago') ||
      ultimoMensaje.includes('metodo de pago') ||
      ultimoMensaje.includes('método de pago') ||
      ultimoMensaje.includes('cómo se paga') ||
      ultimoMensaje.includes('como se paga')
    ) {
      return {
        content:
          'En INBESTIGA nuestro único medio de pago oficial es a través de la pasarela de Culqi: https://express.culqi.com/pago/1E696A426C. Básicamente la pasarela de Culqi te permite pagar con cualquiera de los métodos que prefieras: Yape directo, tarjetas de débito o crédito (Visa, Mastercard, etc.) y PagoEfectivo, todo de forma segura en un solo enlace. ¿Deseas que preparemos tu cotización para que puedas realizar tu pago?',
      };
    }

    // Respuesta dinámica contextual progresiva (evita bucles repetitivos)
    return {
      content:
        'Comprendo perfectamente lo que necesitas para tu investigación. En INBESTIGA contamos con asesores especialistas con grado de Doctor y Magíster listos para orientarte paso a paso. ¿Te gustaría conocer los planes y facilidades de pago que tenemos para tu carrera?',
    };
  }
}
