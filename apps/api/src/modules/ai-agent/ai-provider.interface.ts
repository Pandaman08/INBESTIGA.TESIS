export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AIProviderResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
  }>;
  /** De dónde salió la respuesta: un modelo de IA o la heurística local de contingencia. */
  origen?: 'MODELO' | 'HEURISTICA_LOCAL';
}

export interface AIProvider {
  generarRespuesta(
    mensajes: ChatMessage[],
    herramientas: ToolDefinition[],
    temperatura?: number,
    modelo?: string,
    proveedor?: string,
  ): Promise<AIProviderResponse>;
}
