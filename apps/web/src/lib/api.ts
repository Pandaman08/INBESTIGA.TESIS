const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(data?.message || `Error en la petición: ${res.status} ${res.statusText}`);
    }

    return data;
  } catch (error: any) {
    console.error(`[API Error] ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Buyers & Formulario
  getBuyers: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/buyers${query ? `?${query}` : ''}`);
  },
  getBuyer: (id: string) => fetchApi(`/buyers/${id}`),
  getCatalogos: () => fetchApi('/buyers/catalogos'),
  submitFormulario: (data: any) =>
    fetchApi('/buyers/formulario', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Negociación
  iniciarNegociacion: (buyerId: string) =>
    fetchApi(`/negotiation/iniciar/${buyerId}`, {
      method: 'POST',
    }),
  getConversacion: (id: string) => fetchApi(`/negotiation/conversacion/${id}`),
  enviarMensajeNegociacion: (telefono: string, contenido: string) =>
    fetchApi('/negotiation/enviar-mensaje', {
      method: 'POST',
      body: JSON.stringify({ telefono, contenido }),
    }),
  limpiarConversacion: (id: string) =>
    fetchApi(`/negotiation/conversacion/${id}/limpiar`, {
      method: 'POST',
    }),
  limpiarConversacionPorBuyer: (buyerId: string) =>
    fetchApi(`/negotiation/buyer/${buyerId}/limpiar`, {
      method: 'POST',
    }),

  // Dashboard & ETL
  getDashboardOverview: () => fetchApi('/dashboard/overview'),
  getExecutiveReports: () => fetchApi('/dashboard/reportes-ejecutivos'),
  runEtl: () => fetchApi('/etl/run', { method: 'POST' }),
  getEtlOverview: () => fetchApi('/etl/overview'),

  // Configuración del Agente IA
  getAgentConfig: () => fetchApi('/agent/config'),
  updateAgentConfig: (data: any) =>
    fetchApi('/agent/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Servicios y Reglas
  getServices: () => fetchApi('/services'),
  getCommercialRules: () => fetchApi('/services/rules'),
  updateCommercialRule: (id: string, data: any) =>
    fetchApi(`/services/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Clientes, Bitácora y Trazabilidad de Tesis
  getCustomers: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/customers${query ? `?${query}` : ''}`);
  },
  getCustomer: (id: string) => fetchApi(`/customers/${id}`),
  getCustomerTrazabilidad: (id: string) => fetchApi(`/customers/${id}/trazabilidad`),
  crearEntradaBitacora: (id: string, data: any) =>
    fetchApi(`/customers/${id}/bitacora`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  actualizarEstadoCustomer: (id: string, data: any) =>
    fetchApi(`/customers/${id}/estado`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getAdvisors: () => fetchApi('/advisors'),

  // Pagos, Checkout y Comprobantes Oficiales
  getCotizacionCheckout: (cotizacionId: string) => fetchApi(`/payments/cotizacion/${cotizacionId}`),
  procesarCheckout: (data: any) =>
    fetchApi('/payments/checkout/procesar', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getComprobantes: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi(`/payments${query ? `?${query}` : ''}`);
  },
  getComprobanteById: (pagoId: string) => fetchApi(`/payments/comprobante/${pagoId}`),
  confirmarPago: (pagoId: string, data: any = {}) =>
    fetchApi(`/payments/${pagoId}/confirmar`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sincronizarPagosCulqi: () =>
    fetchApi('/payments/sincronizar-culqi', {
      method: 'POST',
    }),

  // WhatsApp Status
  getWhatsAppStatus: () => fetchApi('/whatsapp/status'),
};
