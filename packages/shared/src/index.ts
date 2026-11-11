// =============================================================================
// INBESTIGA.TESIS - Tipos y Constantes Compartidas (IMPULSE Methodology)
// =============================================================================

// -----------------------------------------------------------------------------
// Funnel Principal IMPULSE
// -----------------------------------------------------------------------------
export enum FunnelStage {
  UNIVERSO = 'UNIVERSO',
  BUYER = 'BUYER',
  LEAD = 'LEAD',
  PAYER = 'PAYER',
  CUSTOMER = 'CUSTOMER',
}

// -----------------------------------------------------------------------------
// Estados Internos de la Máquina de Negociación IA
// -----------------------------------------------------------------------------
export enum NegotiationStage {
  DISCOVERY = 'DISCOVERY',
  DIAGNOSTIC = 'DIAGNOSTIC',
  PROPOSAL = 'PROPOSAL',
  OBJECTION_HANDLING = 'OBJECTION_HANDLING',
  NEGOTIATION = 'NEGOTIATION',
  CLOSING = 'CLOSING',
  PAYMENT = 'PAYMENT',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  CONVERTED = 'CONVERTED',
  HUMAN_ESCALATION = 'HUMAN_ESCALATION',
  ABANDONED = 'ABANDONED',
}

// -----------------------------------------------------------------------------
// Mensajería y Canales
// -----------------------------------------------------------------------------
export enum MessageDirection {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
}

export enum MessageType {
  TEXT = 'TEXT',
  PAYMENT_LINK = 'PAYMENT_LINK',
  QUOTE = 'QUOTE',
  DOCUMENT = 'DOCUMENT',
}

export enum DeliveryStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

// -----------------------------------------------------------------------------
// Pagos y Pasarelas
// -----------------------------------------------------------------------------
export enum PaymentMethod {
  CARD = 'CARD',
  YAPE = 'YAPE',
  TRANSFER = 'TRANSFER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentProviderType {
  STRIPE = 'STRIPE',
  MERCADOPAGO = 'MERCADOPAGO',
  CULQI = 'CULQI',
}

// -----------------------------------------------------------------------------
// Objeciones
// -----------------------------------------------------------------------------
export enum ObjectionType {
  PRECIO = 'PRECIO',
  TIEMPO = 'TIEMPO',
  CONFIANZA = 'CONFIANZA',
  COMPARACION = 'COMPARACION',
  METODO_PAGO = 'METODO_PAGO',
  OTRO = 'OTRO',
}

// -----------------------------------------------------------------------------
// Servicios y Asesoría
// -----------------------------------------------------------------------------
export enum CustomerServiceStatus {
  ACTIVO = 'ACTIVO',
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
  PAUSADO = 'PAUSADO',
}

export enum SessionStatus {
  PROGRAMADA = 'PROGRAMADA',
  REALIZADA = 'REALIZADA',
  REPROGRAMADA = 'REPROGRAMADA',
  CANCELADA = 'CANCELADA',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  ASESOR = 'ASESOR',
}

// -----------------------------------------------------------------------------
// Reglas y Ponderación del Lead Scoring (0 a 100)
// -----------------------------------------------------------------------------
export const LEAD_SCORE_THRESHOLD = 70;

export const SCORING_CRITERIA_WEIGHTS = {
  PERFIL_ACADEMICO_COMPLETO: 20, // Universidad + Carrera + Ciclo
  TIPO_INVESTIGACION_DEFINIDO: 15, // Tesis, Tesina, Proyecto, etc.
  PLAZO_DEFINIDO: 15, // Fecha límite o urgencia definida
  SITUACION_LABORAL_PRESUPUESTO: 10, // Trabajo / presupuesto estimado
  DOLOR_SOFTWARE_ESPECIFICO: 10, // Dificultad clara o software (SPSS, R, etc.)
  CONSENTIMIENTO_WHATSAPP: 15, // Aceptó ser contactado por WhatsApp
  INTERACCION_LEAD_MAGNET: 15, // Descargó guía o recurso
} as const;

// -----------------------------------------------------------------------------
// Enums y Tipos de la Fase BUYER (Diagrama E-R)
// -----------------------------------------------------------------------------
export enum TipoPerfilBuyer {
  ESTUDIANTE = 'ESTUDIANTE',
  EGRESADO = 'EGRESADO',
  PADRE_FAMILIA = 'PADRE_FAMILIA',
  APODERADO = 'APODERADO',
  OTRO = 'OTRO',
}

export enum TipoUniversidad {
  PUBLICA = 'PUBLICA',
  PRIVADA = 'PRIVADA',
}

export enum RedSocial {
  TIKTOK = 'TIKTOK',
  META_ADS = 'META_ADS',
  FACEBOOK = 'FACEBOOK',
  INSTAGRAM = 'INSTAGRAM',
  LINKEDIN = 'LINKEDIN',
  GOOGLE = 'GOOGLE',
  OTRO = 'OTRO',
}

export enum TipoInteraccionRedSocial {
  COMENTARIO = 'COMENTARIO',
  MENSAJE_DIRECTO = 'MENSAJE_DIRECTO',
  CLIC_ANUNCIO = 'CLIC_ANUNCIO',
  COMPARTIDO = 'COMPARTIDO',
  SEGUIDOR = 'SEGUIDOR',
  DESCARGA = 'DESCARGA',
}

export interface CatalogoServicioItem {
  servicioId: string;
  nombrePaquete: string;
  incluye: string;
  dirigidoA: string;
  precioBase: number;
  recargoUrgenciaPct: number;
}

export interface DescargaContenidoItem {
  idDescarga: string;
  idBuyer: string;
  servicioIdAsociado: string;
  fechaDescarga: string | Date;
}

export interface InteraccionRedSocialItem {
  idInteraccion: string;
  idBuyer: string;
  redSocial: string;
  tipoInteraccion: string;
  temaDetectado?: string;
  fecha: string | Date;
}

// -----------------------------------------------------------------------------
// Interfaces para Herramientas (AI Function Calling)
// -----------------------------------------------------------------------------
export interface BuyerProfile {
  id: string;
  tipoPerfil?: string;
  nombre?: string;
  nombres: string;
  apellidos: string;
  whatsapp: string;
  email: string;
  correo?: string;
  departamento?: string;
  distrito?: string;
  tipoUniversidad?: string;
  sede?: string;
  universidad: string;
  facultad?: string;
  carrera: string;
  ciclo: string;
  edad?: number;
  financiaAIdBuyer?: string;
  canalCaptacion?: string;
  tipoInvestigacion: string;
  situacionLaboral?: string;
  dolorPrincipal?: string;
  softwareRequerido?: string;
  presupuestoAprox?: number;
  leadScore: number;
  estadoFunnel: FunnelStage;
  fechaRegistro?: string | Date;
}

export interface CalculateOfferInput {
  buyerId: string;
  servicioId: string;
  descuentoPropuestoPct: number;
  numeroCuotas: number;
}

export interface CalculateOfferResult {
  valido: boolean;
  servicioNombre: string;
  precioBase: number;
  descuentoAplicadoPct: number;
  precioFinal: number;
  numeroCuotas: number;
  montoPorCuota: number;
  descuentoMaximoPermitidoPct: number;
  plazoSemanas: number;
  mensajeRechazo?: string;
}

export interface CreatePaymentRequestInput {
  buyerId: string;
  servicioId: string;
  monto: number;
  cuotas: number;
  metodoPreferido?: PaymentMethod;
}

export interface CreatePaymentRequestResult {
  cotizacionId: string;
  pagoId: string;
  checkoutUrl: string;
  monto: number;
  moneda: string;
  metodosDisponibles: PaymentMethod[];
  expiraEnMinutos: number;
}

export interface RecordObjectionInput {
  conversacionId: string;
  leadId: string;
  tipo: ObjectionType;
  descripcion: string;
  respuestaPropuesta: string;
}
