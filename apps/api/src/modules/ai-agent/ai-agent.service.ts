import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GeminiProvider } from './providers/gemini.provider';
import { GrokProvider } from './providers/grok.provider';
import { AiToolsService } from './tools/ai-tools.service';
import { ChatMessage, AIProvider, ToolDefinition, AIProviderResponse } from './ai-provider.interface';

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiProvider: GeminiProvider,
    private readonly grokProvider: GrokProvider,
    private readonly toolsService: AiToolsService,
  ) {}

  /**
   * Obtiene el proveedor de IA configurado en SQL Server o variables de entorno.
   */
  private async getProvider(): Promise<{
    provider: AIProvider;
    promptSistema: string;
    modelo: string;
    proveedorNombre: string;
  }> {
    const config = await this.prisma.configuracionAgente.findFirst({
      where: { activo: true },
      orderBy: { id: 'desc' },
    });

    const proveedorNombre = (config?.proveedorIA || process.env.AI_PROVIDER || 'GEMINI').toUpperCase();
    const promptSistema =
      config?.promptSistema ||
      'Eres el Negociador Comercial de INBESTIGA.TESIS. Brinda asesoría empática, técnica y orientada a la titulación universitaria. Negocia precios dentro de los límites del sistema y concreta pagos.';
    const modelo = config?.modelo || process.env.GEMINI_MODEL || 'gemini-3.6-flash';

    const provider: AIProvider = ['GROK', 'GROQ', 'OPENROUTER'].includes(proveedorNombre)
      ? this.grokProvider
      : this.geminiProvider;

    return { provider, promptSistema, modelo, proveedorNombre };
  }

  /**
   * Ejecuta la inferencia con conmutación por error (Failover automático).
   * Si el proveedor principal (por ej. Gemini con cuota 429 o Groq con fallo de red) no responde,
   * automáticamente consulta al proveedor secundario disponible antes de caer en heurísticas locales.
   */
  async ejecutarInferenciaConFailover(
    mensajes: ChatMessage[],
    herramientas: ToolDefinition[],
    temperatura = 0.7,
    modeloDeseado?: string,
    proveedorDeseado?: string,
  ): Promise<AIProviderResponse> {
    const { provider: primaryProvider, modelo, proveedorNombre } = await this.getProvider();
    const activeProvider = (proveedorDeseado || proveedorNombre).toUpperCase();
    const activeModel = modeloDeseado || modelo;

    // 1. Intento primario
    try {
      const resPrimaria = await primaryProvider.generarRespuesta(
        mensajes,
        herramientas,
        temperatura,
        activeModel,
        activeProvider,
      );
      if (resPrimaria && (resPrimaria.toolCalls?.length || (resPrimaria.content && resPrimaria.content.trim().length > 0))) {
        return resPrimaria;
      }
    } catch (error: any) {
      this.logger.warn(`[Failover IA] Proveedor primario ${activeProvider} falló (${error.message}). Conmutando al respaldo.`);
    }

    // 2. Intento secundario (Failover automático)
    const backupProvider = ['GROK', 'GROQ', 'OPENROUTER'].includes(activeProvider)
      ? this.geminiProvider
      : this.grokProvider;
    const backupName = ['GROK', 'GROQ', 'OPENROUTER'].includes(activeProvider)
      ? 'GEMINI'
      : (process.env.GROQ_API_KEY ? 'GROQ' : 'OPENROUTER');
    const backupModel = backupName === 'GEMINI'
      ? (process.env.GEMINI_MODEL || 'gemini-3.6-flash')
      : (process.env.GROQ_MODEL || 'openai/gpt-oss-120b');

    try {
      this.logger.log(`[Failover IA] Ejecutando respaldo: ${backupName} (${backupModel})`);
      const resSecundaria = await backupProvider.generarRespuesta(
        mensajes,
        herramientas,
        temperatura,
        backupModel,
        backupName,
      );
      if (resSecundaria && (resSecundaria.toolCalls?.length || (resSecundaria.content && resSecundaria.content.trim().length > 0))) {
        return resSecundaria;
      }
    } catch (errBackup: any) {
      this.logger.warn(`[Failover IA] Proveedor de respaldo ${backupName} falló (${errBackup.message}).`);
    }

    // 3. Fallback contextual local inteligente (nunca bucle)
    return this.geminiProvider.generarRespuestaLocal(mensajes);
  }

  /**
   * Genera dinámicamente el PRIMER MENSAJE personalizado basado en la información que el estudiante dejó en el formulario.
   */
  async generarMensajeInicial(buyerId: string): Promise<string> {
    const buyer = await this.prisma.buyer.findUnique({
      where: { id: buyerId },
      include: { universidad: true, carrera: true },
    });

    if (!buyer) {
      throw new Error(`Buyer no encontrado para generar mensaje inicial: ${buyerId}`);
    }

    const { promptSistema, modelo, proveedorNombre } = await this.getProvider();

    const promptContexto = `
DATOS DEL ESTUDIANTE REGISTRADO EN EL FORMULARIO:
- Nombre: ${buyer.nombres}
- Universidad: ${buyer.universidad?.nombre || 'su universidad'}
- Carrera: ${buyer.carrera?.nombre || 'su carrera'}
- Ciclo: ${buyer.ciclo || 'Universitario'}
- Tipo de Investigación: ${buyer.tipoInvestigacion || 'Tesis'}
- Dolor o Dificultad Principal: ${buyer.dolorPrincipal || 'No especificado'}
- Situación Laboral: ${buyer.situacionLaboral || 'No especificada'}

INSTRUCCIONES PARA EL MENSAJE INICIAL:
1. Saluda por su nombre de manera cálida y empática.
2. Menciona que viste su registro para asesoría en ${buyer.carrera?.nombre || 'su carrera'} en la ${buyer.universidad?.siglas || 'universidad'}.
3. Si mencionó un dolor (como ${buyer.dolorPrincipal}), empatiza brevemente con él.
4. Haz una pregunta abierta para conocer el estado actual de su proyecto de tesis y orientarlo con una propuesta adecuada.
5. NO uses un tono robótico ni corporativo frío. Mantén una extensión de 3 a 4 oraciones.`;

    const mensajes: ChatMessage[] = [
      { role: 'system', content: promptSistema },
      { role: 'user', content: promptContexto },
    ];

    try {
      const respuesta = await this.ejecutarInferenciaConFailover(mensajes, [], 0.7, modelo, proveedorNombre);
      if (respuesta.content && respuesta.content.trim().length > 20) {
        return respuesta.content.trim();
      }
    } catch (e: any) {
      this.logger.warn(`Fallback en generación de primer mensaje: ${e.message}`);
    }

    // Generador dinámico en caso de fallo de red
    const dolorTexto = buyer.dolorPrincipal
      ? ` Comprendemos lo desafiante que es cuando surge: "${buyer.dolorPrincipal}".`
      : '';

    return `Hola ${buyer.nombres}, te saluda el equipo especialista de INBESTIGA.TESIS. Estuvimos revisando la información que nos dejaste sobre tu ${buyer.tipoInvestigacion || 'investigación'} en ${buyer.carrera?.nombre || 'tu carrera'} de la ${buyer.universidad?.siglas || 'universidad'}.${dolorTexto} Quisiéramos conocer un poco más: ¿en qué etapa te encuentras actualmente y qué capítulo necesitas desarrollar para orientarte con la propuesta adecuada?`;
  }

  /**
   * Procesa la conversación entrante, ejecuta herramientas backend y retorna la respuesta para WhatsApp.
   */
  async procesarRespuestaIA(params: {
    conversacionId: string;
    buyerId: string;
    ultimoMensajeCliente: string;
  }): Promise<{ respuestaTexto: string; etapaNueva?: string; actionMetadata?: any }> {
    const { conversacionId, buyerId, ultimoMensajeCliente } = params;

    const { provider, promptSistema, modelo, proveedorNombre } = await this.getProvider();
    const herramientas = this.toolsService.getToolDefinitions();

    // Obtener los últimos 6 mensajes para mantener memoria conversacional compacta y eficiente
    const mensajesHistorial = await this.prisma.mensaje.findMany({
      where: { conversacionId },
      orderBy: { fechaHora: 'desc' },
      take: 6,
    });

    const conversacion = await this.prisma.conversacion.findUnique({
      where: { id: conversacionId },
      include: { buyer: { include: { universidad: true, carrera: true } } },
    });

    const contextBuyer = conversacion?.buyer;
    const etapaActual = conversacion?.estadoEtapa || 'DISCOVERY';

    const systemPromptWithContext = `${promptSistema}

ESTÁS INTERACTUANDO CON UN ESTUDIANTE UNIVERSITARIO REAL EN WHATSAPP:
- Estudiante: ${contextBuyer?.nombres} ${contextBuyer?.apellidos}
- Universidad: ${contextBuyer?.universidad?.nombre || contextBuyer?.universidad?.siglas || 'Universidad'}
- Carrera: ${contextBuyer?.carrera?.nombre || 'Carrera'}
- Ciclo: ${contextBuyer?.ciclo || 'Universitario'}
- Dolor o dificultad registrada: ${contextBuyer?.dolorPrincipal || 'Asesoría y desarrollo metodológico'}
- Tema / Tipo: ${contextBuyer?.tipoInvestigacion || 'Tesis'}
- Etapa actual del embudo: ${etapaActual}

DIRECTRICES COMERCIALES Y DE NEGOCIACIÓN DE INBESTIGA.TESIS:
1. POBLACIÓN OBJETIVO EXCLUSIVA:
   - Atiendes a universitarios orientados a obtener su grado de BACHILLER (Plan de Tesis / Trabajo de Investigación) o TÍTULO PROFESIONAL (Tesis Integral).
   - Son predominantemente alumnos de 9no y 10mo ciclo (y egresados recientes).
   - Para Tesis Integral (Título Profesional): Precio estándar S/ 2,200 (mínimo permitido con descuento: S/ 1,870).
   - Para Plan de Tesis / Trabajo de Investigación (Bachiller): Precio estándar S/ 1,600 (mínimo permitido con descuento: S/ 1,360).

2. Comunícate de manera empática, profesional, cálida y natural por WhatsApp (párrafos breves, lenguaje cercano, uso moderado de emojis).
3. Tienes total libertad para guiar la conversación y avanzar las fases según lo que exprese el estudiante:
   - FASE DISCOVERY / DIAGNOSTIC: Indaga qué capítulo le falta, si tiene observaciones de su asesor/jurado o problemas con normas APA/SPSS. Puedes llamar a "update_stage" con etapa "DIAGNOSTIC".
   - AGENDAR SESIÓN / VIDEOCALL: Si el estudiante acepta una sesión de diagnóstico, reunión informativa o videollamada (ej. "el viernes a las 3pm", "mañana a las 4"), invoca OBLIGATORIAMENTE la herramienta "schedule_meeting" con fecha, hora, tema y modalidad. ¡NO inventes enlaces manuales! La herramienta genera la sala real de Google Meet y la registra en el sistema.
   - FASE PROPOSAL: Presenta la propuesta de valor de INBESTIGA (asesores con grado de Doctor/Magíster, garantía de aprobación, reuniones virtuales 1 a 1). Consulta el catálogo con "get_available_services" o plantea la cotización (S/ 2,200 para Tesis Integral, S/ 1,600 para Plan de Tesis). Si ofreces un descuento o facilidad, explícaselo de forma transparente antes de cobrar.
   - FASE NEGOTIATION / OBJECTIONS: Si tiene dudas de precio, tiempo o pide rebaja o cuotas, usa "calculate_offer" o "record_objection".
   - FASE PAYMENT_PENDING / MEDIOS DE PAGO:
     * Si el estudiante pregunta por los medios o métodos de pago, cómo abonar, o si acepta la propuesta y pide el link para pagar: invoca OBLIGATORIAMENTE la herramienta "create_payment_request" con el monto y servicio acordado.
     * En tu mensaje, da ÚNICAMENTE la opción de la pasarela oficial de CULQI (https://express.culqi.com/pago/1E696A426C).
     * Explícale al estudiante que básicamente Culqi cuenta con una pasarela de pago integral y segura que acepta diferentes tipos de pago en un solo lugar: Yape directo, tarjetas de débito o crédito (Visa, Mastercard, AMEX) y PagoEfectivo.
     * Queda estrictamente PROHIBIDO mencionar o proporcionar cuentas bancarias (BCP, BBVA, Interbank) o números telefónicos personales para transferencias directas. Culqi es el único medio y pasarela oficial de pago de INBESTIGA.
   - PAGOS: Tú NO confirmas pagos. Si el estudiante dice que ya pagó, agradece y explica que el área de pagos lo confirmará cuando la pasarela valide la transacción. Nunca digas que un pago fue validado.
4. NUNCA respondas con formatos de código JSON crudo ni digas "he ejecutado la herramienta". Habla siempre como un asesor humano senior de INBESTIGA.
5. NUNCA dupliques el mismo saludo, párrafo o enlace en un solo mensaje. Redacta un único mensaje coherente, fluido y directo.`;

    const chatMessages: ChatMessage[] = [{ role: 'system', content: systemPromptWithContext }];

    // Reordenar historial cronológicamente
    mensajesHistorial.reverse().forEach((m) => {
      chatMessages.push({
        role: m.direccion === 'INCOMING' ? 'user' : 'assistant',
        content: m.contenido,
      });
    });

    // Agregar el mensaje actual del cliente
    chatMessages.push({ role: 'user', content: ultimoMensajeCliente });

    // Primera invocación al modelo con failover automático
    const respuestaIA = await this.ejecutarInferenciaConFailover(chatMessages, herramientas, 0.7, modelo, proveedorNombre);

    let respuestaFinal = respuestaIA.content;
    let actionMetadata: any = null;
    let etapaNueva = etapaActual;

    // Si la IA invocó una herramienta backend
    if (respuestaIA.toolCalls && respuestaIA.toolCalls.length > 0) {
      const toolCall = respuestaIA.toolCalls[0];
      this.logger.log(`Ejecutando tool: ${toolCall.name} con args:`, toolCall.arguments);

      const toolResult: any = await this.toolsService.executeTool(toolCall.name, toolCall.arguments, {
        conversacionId,
        buyerId,
      });

      actionMetadata = { tool: toolCall.name, arguments: toolCall.arguments, result: toolResult };

      // Asignar nueva etapa si la herramienta la define
      if (toolResult?.nuevaEtapa) {
        etapaNueva = toolResult.nuevaEtapa;
      } else if (toolCall.name === 'calculate_offer') {
        etapaNueva = 'NEGOTIATION';
      } else if (toolCall.name === 'create_payment_request') {
        etapaNueva = 'PAYMENT_PENDING';
      } else if (toolCall.name === 'record_objection') {
        etapaNueva = 'OBJECTION_HANDLING';
      } else if (toolCall.name === 'escalate_to_human') {
        etapaNueva = 'HUMAN_ESCALATION';
      }

      // Turno 2: Permitir que la IA redacte su respuesta con libertad utilizando los datos generados
      const followUpMessages: ChatMessage[] = [
        ...chatMessages,
        {
          role: 'user',
          content: `DATOS ACTUALIZADOS DEL SISTEMA tras consultar ${toolCall.name}:
${JSON.stringify(toolResult, null, 2)}

INSTRUCCIÓN COMERCIAL:
Como Asesor Especialista de INBESTIGA.TESIS, redacta tu respuesta directa para WhatsApp al estudiante:
- Redacta UN SOLO mensaje para WhatsApp, sin duplicar párrafos ni repetir dos veces la misma confirmación.
- Sé empático, cercano y convincente.
- MEDIOS DE PAGO (SOLO PASARELA CULQI): Dale al estudiante EXCLUSIVAMENTE la opción de la pasarela oficial de Culqi: https://express.culqi.com/pago/1E696A426C. Explícale que básicamente Culqi cuenta con una pasarela de pago que acepta diferentes tipos de pago (Yape directo, tarjetas de crédito/débito y PagoEfectivo), todo en un solo enlace seguro. Queda terminantemente PROHIBIDO mencionar o dar números de cuentas bancarias (BCP, BBVA, etc.) o números de teléfono para transferencias personales.
- Termina invitándolo a dar el siguiente paso.
- NO uses corchetes como "[Herramienta ejecutada]" ni código JSON en tu respuesta.`,
        },
      ];

      try {
        if (toolResult?.bloqueado) {
          // Herramienta bloqueada por reglas de negocio: usar el texto seguro del backend.
          respuestaFinal = toolResult.mensajeSugerido;
        } else {
          const segundaRespuesta = await this.ejecutarInferenciaConFailover(followUpMessages, [], 0.7, modelo, proveedorNombre);
          if (
            segundaRespuesta.content &&
            segundaRespuesta.content.trim().length > 25 &&
            !segundaRespuesta.content.includes('[Herramienta') &&
            !segundaRespuesta.content.includes('Estimado estudiante, en INBESTIGA estamos listos') &&
            !segundaRespuesta.content.includes('Comprendo perfectamente lo que necesitas')
          ) {
            respuestaFinal = segundaRespuesta.content.trim();
          } else {
            respuestaFinal = toolResult?.mensajeSugerido || toolResult?.mensaje || '';
          }
        }
      } catch (err: any) {
        this.logger.warn(`Fallback en segundo turno IA: ${err.message}`);
        respuestaFinal = toolResult?.mensajeSugerido || toolResult?.mensaje || '';
      }

      // Si se agendó reunión con Google Meet, garantizar que el enlace esté presente
      if (toolCall.name === 'schedule_meeting' && toolResult?.meetLink) {
        if (!respuestaFinal.includes(toolResult.meetLink)) {
          respuestaFinal = `${respuestaFinal}\n\nEnlace de Google Meet: ${toolResult.meetLink}`;
        }
      }

      // Si se generó un link de pago, garantizar que esté incluido en el mensaje para el estudiante
      if (toolCall.name === 'create_payment_request' && toolResult?.checkoutUrl) {
        if (!respuestaFinal.includes(toolResult.checkoutUrl)) {
          respuestaFinal = toolResult.mensajeSugerido || `${respuestaFinal}\n\nPuedes formalizar tu pago seguro en este enlace: ${toolResult.checkoutUrl}`;
        }
      }

      // Si la respuesta quedó vacía tras la ejecución, usar mensaje sugerido de la herramienta
      if (!respuestaFinal || respuestaFinal.trim().length === 0) {
        respuestaFinal =
          toolResult?.mensajeSugerido ||
          toolResult?.mensaje ||
          (toolCall.name === 'schedule_meeting'
            ? `¡Coordinación confirmada! Tu sesión de diagnóstico quedó programada para el ${toolCall.arguments?.fecha || 'próximo turno'} a las ${toolCall.arguments?.hora || 'hora acordada'}. Nos conectaremos mediante: ${toolResult.meetLink}`
            : toolCall.name === 'create_payment_request'
            ? `¡Excelente! Hemos formalizado tu cotización oficial por S/ ${toolResult.total || 2200}. Puedes realizar tu pago seguro aquí: ${toolResult.checkoutUrl}`
            : 'En INBESTIGA contamos con especialistas para acompañarte en tu investigación. ¿En qué aspecto deseas que profundicemos?');
      }
    }

    // Limpieza y desduplicación inteligente de la respuesta para evitar párrafos o links repetidos
    respuestaFinal = this.limpiarTextoDuplicado(respuestaFinal);

    // Actualizar estado de etapa en la conversación
    await this.prisma.conversacion.update({
      where: { id: conversacionId },
      data: { estadoEtapa: etapaNueva, fechaUltimaActividad: new Date() },
    });

    return { respuestaTexto: respuestaFinal, etapaNueva, actionMetadata };
  }

  /**
   * Elimina párrafos repetidos o enlaces idénticos que la IA pudiera duplicar accidentalmente.
   */
  private limpiarTextoDuplicado(texto: string): string {
    if (!texto) return '';

    const parrafos = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    const parrafosUnicos: string[] = [];

    for (const p of parrafos) {
      const normP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      const yaExiste = parrafosUnicos.some((existente) => {
        const normExistente = existente.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normExistente === normP) return true;
        // Si hay un solapamiento muy alto (> 35 caracteres al inicio idénticos)
        if (normExistente.length > 35 && normP.length > 35) {
          if (normP.startsWith(normExistente.slice(0, 35)) || normExistente.startsWith(normP.slice(0, 35))) {
            return true;
          }
        }
        return false;
      });

      if (!yaExiste) {
        parrafosUnicos.push(p);
      }
    }

    let resultado = parrafosUnicos.join('\n\n');

    // Desduplicar enlaces idénticos si aparecen más de una vez
    const urls = resultado.match(/https?:\/\/[^\s]+/g);
    if (urls && urls.length > 1) {
      const vistos = new Set<string>();
      for (const url of urls) {
        if (vistos.has(url)) {
          const primero = resultado.indexOf(url);
          const ultimo = resultado.lastIndexOf(url);
          if (ultimo !== primero) {
            resultado = resultado.substring(0, ultimo) + resultado.substring(ultimo + url.length);
          }
        } else {
          vistos.add(url);
        }
      }
    }

    return resultado.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
}
