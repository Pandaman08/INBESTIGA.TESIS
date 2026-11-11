'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  Bot,
  User,
  Send,
  Sparkles,
  CreditCard,
  ShieldAlert,
  ArrowRight,
  Phone,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';

function LiveChatContent() {
  const searchParams = useSearchParams();
  const conversacionIdParam = searchParams.get('conversacionId');

  const [conversaciones, setConversaciones] = useState<any[]>([]);
  const [activeConversacionId, setActiveConversacionId] = useState<string | null>(conversacionIdParam);
  const [conversacionData, setConversacionData] = useState<any>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearSuccessBanner, setClearSuccessBanner] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cargarConversaciones = async () => {
    try {
      const buyers = await api.getBuyers();
      const conConv = buyers.filter((b: any) => b.conversaciones && b.conversaciones.length > 0);
      setConversaciones(conConv);

      if (!activeConversacionId && conConv.length > 0) {
        setActiveConversacionId(conConv[0].conversaciones[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cargarConversacionActiva = async (id: string) => {
    try {
      const data = await api.getConversacion(id);
      setConversacionData(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    cargarConversaciones();
  }, []);

  useEffect(() => {
    if (activeConversacionId) {
      cargarConversacionActiva(activeConversacionId);
    }
  }, [activeConversacionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversacionData]);

  const handleSelectConversacion = (id: string) => {
    setActiveConversacionId(id);
    setShowMobileList(false);
  };

  const handleEnviarMensajeEstudiante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !conversacionData?.id) return;

    setSending(true);
    const textToSend = inputMessage;
    setInputMessage('');

    try {
      // Modo prueba interna: el admin escribe como estudiante; nada sale por WhatsApp.
      await api.enviarMensajePrueba(conversacionData.id, textToSend);
      await cargarConversacionActiva(conversacionData.id);
    } catch (err: any) {
      alert(`Error al enviar mensaje: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleLimpiarChat = async () => {
    if (!activeConversacionId) return;
    setClearing(true);
    try {
      await api.limpiarConversacion(activeConversacionId);
      await cargarConversacionActiva(activeConversacionId);
      await cargarConversaciones();
      setShowClearConfirm(false);
      setClearSuccessBanner(true);
      setTimeout(() => setClearSuccessBanner(false), 5000);
    } catch (err: any) {
      alert(`Error al reiniciar chat: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  const templates = [
    {
      label: '1. Diagnóstico',
      text: 'Hola, tengo el tema pero no sé cómo plantear la hipótesis ni qué prueba estadística usar.',
    },
    {
      label: '2. Objeción Precio',
      text: 'Me parece un poco alto el precio para mi presupuesto de estudiante. ¿Tienen facilidades de pago o cuotas?',
    },
    {
      label: '3. Aceptación y Pago',
      text: 'Perfecto, acepto la propuesta de 2 cuotas. Por favor envíame el enlace o cuentas para realizar el pago ahora mismo.',
    },
    {
      label: '4. Aviso de pago (LEADS no lo confirma)',
      text: 'Listo, ya te transferí el monto acordado por Yape. Mi código de operación es 582910. ¿Me confirmas la activación?',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-sky-400 shadow-sm">
                <MessageSquare className="w-5 h-5" />
              </span>
              <span>Monitoreo en Vivo de Negociación IA</span>
            </h1>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-500/30 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WhatsApp Bidireccional</span>
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 break-words">
            Visualiza en tiempo real el diálogo entre el estudiante y el Agente Autónomo de Tesis de INBESTIGA.
          </p>
        </div>

        <button
          onClick={() => activeConversacionId && cargarConversacionActiva(activeConversacionId)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 self-start shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar Chat</span>
        </button>
      </div>

      {/* Main Chat Interface Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 min-h-[680px] lg:h-[720px]">
        {/* Sidebar: Active Conversations List */}
        <div
          className={`glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col space-y-3 overflow-hidden shadow-sm ${
            !showMobileList ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Conversaciones Activas
            </h2>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
              {conversaciones.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {conversaciones.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                Sin conversaciones activas aún.
              </p>
            ) : (
              conversaciones.map((b) => {
                const conv = b.conversaciones[0];
                const isSelected = conv?.id === activeConversacionId;

                return (
                  <button
                    key={b.id}
                    onClick={() => handleSelectConversacion(conv?.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer min-w-0 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500/60 shadow-xs'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{b.nombres} {b.apellidos}</span>
                      <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 shrink-0 font-mono">{b.leadScore} pts</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {b.universidad?.siglas || 'UNT'} • {b.carrera?.nombre || 'Tesis'}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase truncate">
                        {conv?.estadoEtapa || 'DISCOVERY'}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 shrink-0">{conv?._count?.mensajes || 0} msgs</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center/Right: Chat Message History & Simulator */}
        <div
          className={`lg:col-span-3 glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-lg ${
            showMobileList ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {conversacionData ? (
            <>
              {/* Chat Top Banner */}
              <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back to list button on mobile */}
                  <button
                    onClick={() => setShowMobileList(true)}
                    className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0"
                    title="Volver a la lista"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-sky-500 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs">
                    {conversacionData.buyer?.nombres?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                      <span className="truncate">{conversacionData.buyer?.nombres} {conversacionData.buyer?.apellidos}</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full font-mono shrink-0">
                        {conversacionData.buyer?.whatsapp}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {conversacionData.buyer?.carrera?.nombre} • {conversacionData.buyer?.universidad?.siglas || 'Universidad'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:inline">Etapa:</span>
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-black tracking-wider uppercase bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30">
                      {conversacionData.estadoEtapa}
                    </span>
                  </div>

                  {/* Botón Limpiar Chat */}
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    disabled={clearing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-900/40 transition-all shadow-xs cursor-pointer active:scale-95"
                    title="Reinicia esta conversación y borra los mensajes para empezar una nueva prueba desde cero"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
                    <span>Limpiar Chat</span>
                  </button>
                </div>
              </div>

              {/* Banner de Confirmación / Éxito al Reiniciar */}
              {clearSuccessBanner && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/50 p-2.5 px-4 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span><strong>Chat reiniciado exitosamente.</strong> La etapa volvió a DISCOVERY y puedes iniciar una nueva prueba.</span>
                  </div>
                  <button onClick={() => setClearSuccessBanner(false)} className="text-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-100 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Message Timeline */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
                {conversacionData.mensajes?.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 text-center py-12">
                    Aún no hay mensajes en esta conversación. Pulsa [INICIAR NEGOCIACIÓN] en Buyers.
                  </div>
                ) : (
                  conversacionData.mensajes?.map((m: any) => {
                    const isClient = m.direccion === 'INCOMING';
                    const isPaymentLink = m.tipoMensaje === 'PAYMENT_LINK' || m.contenido.includes('/checkout/');

                    return (
                      <div
                        key={m.id}
                        className={`flex gap-2.5 sm:gap-3 max-w-[90%] sm:max-w-[78%] ${
                          isClient ? 'mr-auto' : 'ml-auto flex-row-reverse'
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-xs ${
                            isClient
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {isClient ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>

                        {/* Bubble */}
                        <div
                          className={`p-3.5 rounded-2xl text-xs space-y-1.5 shadow-sm min-w-0 ${
                            isClient
                              ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-xs'
                              : 'bg-gradient-to-br from-blue-700 to-indigo-700 text-white rounded-tr-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-75 font-semibold gap-2">
                            <span className="truncate">{etiquetaRemitente(m)}</span>
                            <span className="shrink-0">{new Date(m.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <p className="leading-relaxed whitespace-pre-wrap break-words">{m.contenido}</p>
                          {!isClient && m.estadoEntrega && (
                            <span
                              className={`inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                m.estadoEntrega === 'FAILED' ? 'bg-red-500/90 text-white' : 'bg-white/20 text-white'
                              }`}
                              title={ESTADO_ENTREGA_DESC[m.estadoEntrega] || m.estadoEntrega}
                            >
                              {ESTADO_ENTREGA_LABEL[m.estadoEntrega] || m.estadoEntrega}
                            </span>
                          )}

                          {/* Quick Checkout Action Card if Payment Link */}
                          {isPaymentLink && (
                            <div className="mt-2 p-2.5 rounded-xl bg-slate-900/80 dark:bg-black/40 border border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                                <span className="font-bold text-[11px] text-white truncate">Orden de Pago Oficial</span>
                              </div>
                              <Link
                                href={m.contenido.match(/https?:\/\/[^\s]+/)?.[0] || '/checkout'}
                                className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-lg text-[10px] shadow transition-colors flex items-center gap-1 shrink-0"
                              >
                                <span>Abrir Pasarela</span> <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Interactive Student Simulator Box (Demo Tool) */}
              <div className="p-3 sm:p-4 bg-white dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                    <Sparkles className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    <span>Respuestas Demo:</span>
                  </span>
                  {templates.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setInputMessage(tpl.text)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] border border-slate-200 dark:border-slate-700 font-medium transition-colors cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleEnviarMensajeEstudiante} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Prueba interna: escribe como estudiante (no se envía por WhatsApp)..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputMessage.trim()}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shrink-0"
                  >
                    {sending ? (
                      <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Enviar</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 p-8 text-center">
              Selecciona una conversación a la izquierda para ver el Live Chat.
            </div>
          )}
        </div>
      </div>

      {/* Modal Confirmación Limpiar Chat */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-heading font-black text-lg text-slate-900 dark:text-white">¿Limpiar y Reiniciar Chat?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ideal para hacer nuevas pruebas con el bot.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              Se eliminarán todos los mensajes de este chat con <strong>{conversacionData?.buyer?.nombres} ({conversacionData?.buyer?.whatsapp})</strong>. La conversación volverá a la etapa inicial <strong>DISCOVERY</strong> y el prospecto a <strong>LEAD</strong>.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLimpiarChat}
                disabled={clearing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                {clearing ? (
                  <>
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    <span>Limpiando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, Limpiar Chat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ESTADO_ENTREGA_LABEL: Record<string, string> = {
  SENT: 'Enviado por WhatsApp',
  QUEUED: 'En cola de WhatsApp',
  FAILED: 'No enviado (error)',
  LOCAL_ONLY: 'Solo registrado (no enviado)',
};

const ESTADO_ENTREGA_DESC: Record<string, string> = {
  SENT: 'El gateway OpenWA aceptó el mensaje. No confirma que el estudiante lo haya leído.',
  QUEUED: 'OpenWA encoló el mensaje; aún no se confirma su salida.',
  FAILED: 'El envío por WhatsApp falló. El mensaje no salió y no se reintenta automáticamente.',
  LOCAL_ONLY: 'Guardado solo en el sistema: chat de prueba interno, sin consentimiento o número no autorizado.',
};

function etiquetaRemitente(m: any): string {
  if (m.direccion === 'INCOMING') {
    return m.remitente === 'ADMIN_TEST' ? 'Prueba interna (admin como estudiante)' : 'Estudiante (WhatsApp)';
  }
  if (m.remitente === 'ASESOR_HUMANO') return 'Asesor';
  return 'Agente IA Negociador';
}

export default function LiveChatPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-slate-500 dark:text-slate-400">
          <span className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 dark:border-sky-400 border-t-transparent" />
          <p className="mt-2 text-xs font-semibold">Cargando monitor de negociación en vivo...</p>
        </div>
      }
    >
      <LiveChatContent />
    </Suspense>
  );
}
