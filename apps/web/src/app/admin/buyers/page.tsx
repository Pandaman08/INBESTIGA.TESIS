'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Filter,
  Bot,
  MessageSquare,
  Sparkles,
  ArrowUpDown,
  GraduationCap,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Eye,
  X,
  Send,
  AlertCircle,
  Building2,
  BookOpen,
  RotateCcw,
  DollarSign,
  UserCheck,
  Video,
  Calendar,
  ShieldCheck,
  CreditCard,
  Award,
  ExternalLink,
  MapPin,
  Download,
  Share2,
  Tag,
  Layers,
  HeartHandshake,
} from 'lucide-react';
import { api } from '@/lib/api';

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Estado de acción [INICIAR NEGOCIACIÓN]
  const [negotiatingId, setNegotiatingId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [negotiationResult, setNegotiationResult] = useState<any>(null);

  const fetchBuyers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { orderBy: 'leadScore', orderDir: 'desc' };
      if (search) params.search = search;
      if (filtroEstado) params.estadoFunnel = filtroEstado;

      const data = await api.getBuyers(params);
      let list = data || [];
      if (filtroPerfil) {
        list = list.filter((b: any) => b.tipoPerfil === filtroPerfil);
      }
      setBuyers(list);
    } catch (err) {
      console.error('Error fetching buyers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuyers();
  }, [filtroEstado, filtroPerfil]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBuyers();
  };

  const handleIniciarNegociacion = async (buyer: any) => {
    setNegotiatingId(buyer.id);
    setNegotiationResult(null);

    try {
      const res = await api.iniciarNegociacion(buyer.id);
      setNegotiationResult(res);
      fetchBuyers();
    } catch (err: any) {
      alert(`Error al iniciar negociación: ${err.message}`);
    } finally {
      setNegotiatingId(null);
    }
  };

  const handleLimpiarChat = async (buyer: any) => {
    const nombre = buyer.nombre || `${buyer.nombres || ''} ${buyer.apellidos || ''}`.trim();
    if (!confirm(`¿Reiniciar chat con ${nombre}? Se borrarán los mensajes para iniciar una nueva prueba desde cero.`)) return;
    setClearingId(buyer.id);
    try {
      await api.limpiarConversacionPorBuyer(buyer.id);
      await fetchBuyers();
      alert(`Chat con ${nombre} reiniciado exitosamente. Puedes volver a pulsar [INICIAR NEGOCIACIÓN].`);
    } catch (err: any) {
      alert(`Error al reiniciar chat: ${err.message}`);
    } finally {
      setClearingId(null);
    }
  };

  const verDetalle = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const full = await api.getBuyer(id);
      setSelectedBuyer(full);
    } catch (e: any) {
      alert(e.message);
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Conteos por estado para los tabs rápidos
  const totalCount = buyers.length;
  const buyersCount = buyers.filter((b) => b.estadoFunnel === 'BUYER').length;
  const leadsCount = buyers.filter((b) => b.estadoFunnel === 'LEAD').length;
  const payersCount = buyers.filter((b) => b.estadoFunnel === 'PAYER').length;
  const customersCount = buyers.filter((b) => b.estadoFunnel === 'CUSTOMER').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-sky-400 shadow-sm">
                <Users className="w-5 h-5" />
              </span>
              <span>Gestión Integral de BUYERS & Funnel</span>
            </h1>
            <span className="text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/50">
              Modelo E-R: BUYER • CATALOGO • DESCARGAS • RED SOCIAL
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 break-words">
            Seguimiento de prospectos desde el primer contacto en redes y descargas de catálogo hasta su conversión a <strong className="text-slate-900 dark:text-slate-200 font-bold">LEAD ➔ PAYER ➔ CUSTOMER</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <Link
            href="/formulario"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
            <span>+ Registrar BUYER</span>
          </Link>
          <Link
            href="/admin/live-chat"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Live Chat</span>
          </Link>
        </div>
      </div>

      {/* Alerta de Éxito al Disparar Negociación */}
      {negotiationResult && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-emerald-950 dark:text-emerald-100">
                ¡Negociación con IA activada para {negotiationResult.buyer?.nombres || 'el prospecto'}!
              </p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-0.5">
                Mensaje de diagnóstico y enganche enviado a WhatsApp. Puedes visualizar y responder en tiempo real en el Live Chat.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/admin/live-chat?cId=${negotiationResult.conversacion?.id || ''}`}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Abrir en Live Chat</span>
            </Link>
            <button
              onClick={() => setNegotiationResult(null)}
              className="p-2 rounded-xl text-emerald-700 hover:bg-emerald-200/50 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tabs Rápidos de Filtrado por Estado del Funnel */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setFiltroEstado('')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filtroEstado === ''
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <span>Todos</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15 dark:bg-white/15">{totalCount}</span>
        </button>

        <button
          onClick={() => setFiltroEstado('BUYER')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filtroEstado === 'BUYER'
              ? 'bg-slate-700 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <span>1. BUYERS</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">{buyersCount}</span>
        </button>

        <button
          onClick={() => setFiltroEstado('LEAD')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filtroEstado === 'LEAD'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <span>2. LEADS (Calificados)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">{leadsCount}</span>
        </button>

        <button
          onClick={() => setFiltroEstado('PAYER')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filtroEstado === 'PAYER'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <span>3. PAYERS (Pagos)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">{payersCount}</span>
        </button>

        <button
          onClick={() => setFiltroEstado('CUSTOMER')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            filtroEstado === 'CUSTOMER'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <span>4. CUSTOMERS (En Asesoría)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">{customersCount}</span>
        </button>
      </div>

      {/* Filters Bar & Search */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo, WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </form>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
          {/* Filtro por Tipo de Perfil */}
          <select
            value={filtroPerfil}
            onChange={(e) => setFiltroPerfil(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los Perfiles (E-R)</option>
            <option value="ESTUDIANTE">Estudiantes</option>
            <option value="EGRESADO">Egresados</option>
            <option value="PADRE_FAMILIA">Padres de Familia</option>
            <option value="APODERADO">Apoderados</option>
          </select>

          {/* Filtro por Estado Funnel */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los Estados (IMPULSE)</option>
            <option value="BUYER">BUYER (En descubrimiento)</option>
            <option value="LEAD">LEAD (Calificado Score &ge; 50)</option>
            <option value="PAYER">PAYER (Pago confirmado)</option>
            <option value="CUSTOMER">CUSTOMER (En asesoría activa)</option>
          </select>
        </div>
      </div>

      {/* Buyers Table */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-md">
        <div className="table-responsive-wrapper">
          <table className="w-full text-left text-xs border-collapse min-w-[1040px]">
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">BUYER / Filiación</th>
                <th className="py-3.5 px-4">Ubicación & Sede</th>
                <th className="py-3.5 px-4">Universidad & Carrera</th>
                <th className="py-3.5 px-4">Catálogo / Red Social</th>
                <th className="py-3.5 px-4 text-center">
                  <span className="inline-flex items-center justify-center gap-1">
                    Score & Prioridad <ArrowUpDown className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                  </span>
                </th>
                <th className="py-3.5 px-4 text-center">Estado Funnel</th>
                <th className="py-3.5 px-4 text-center">Acción IA</th>
                <th className="py-3.5 px-4 text-right">Ficha E-R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-blue-600 dark:border-sky-400 border-t-transparent mr-2 align-middle" />
                    Cargando registros BUYER de SQL Server...
                  </td>
                </tr>
              ) : buyers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    No se encontraron registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                buyers.map((b) => {
                  const isLead = b.estadoFunnel === 'LEAD' || b.leadScore >= 50;
                  const isCustomer = b.estadoFunnel === 'CUSTOMER';
                  const isPayer = b.estadoFunnel === 'PAYER';
                  const prioridad = b.lead?.prioridad || (b.leadScore >= 75 ? 'ALTA' : b.leadScore >= 50 ? 'MEDIA' : 'BAJA');
                  const nombreCompleto = b.nombre || `${b.nombres || ''} ${b.apellidos || ''}`.trim() || 'Prospecto';

                  // Descargas del catálogo
                  const descarga = b.descargasContenido?.[0];
                  const paqueteDescargado = descarga?.servicio?.nombrePaquete;

                  // Interacción de red social
                  const redSocial = b.interaccionesRedSocial?.[0]?.redSocial || b.canalCaptacion;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* BUYER / Filiación */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                            {nombreCompleto}
                          </span>
                          {b.edad && (
                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                              ({b.edad}a)
                            </span>
                          )}
                        </div>

                        {/* Badge de Tipo de Perfil */}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                              b.tipoPerfil === 'PADRE_FAMILIA'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                                : b.tipoPerfil === 'EGRESADO'
                                ? 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300 border border-teal-300 dark:border-teal-500/30'
                                : b.tipoPerfil === 'APODERADO'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-sky-300 border border-blue-200 dark:border-blue-500/30'
                            }`}
                          >
                            {b.tipoPerfil === 'PADRE_FAMILIA' ? '👨‍👩‍👦 Padre / Financiador' : b.tipoPerfil || 'Estudiante'}
                          </span>

                          {/* Relación de financiamiento */}
                          {b.financiadoPor && (
                            <span className="text-[9px] text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/40 px-1 py-0.2 rounded border border-purple-200 dark:border-purple-800/40 truncate">
                              Patrocinado por: {b.financiadoPor.nombres || b.financiadoPor.nombre}
                            </span>
                          )}
                          {b.compradoresFinanciados && b.compradoresFinanciados.length > 0 && (
                            <span className="text-[9px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/40 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-800/40 truncate">
                              Financia a: {b.compradoresFinanciados[0].nombres || b.compradoresFinanciados[0].nombre}
                            </span>
                          )}
                        </div>

                        {/* WhatsApp & Email */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          <a
                            href={`https://wa.me/${b.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-0.5"
                          >
                            <Phone className="w-2.5 h-2.5 text-emerald-500" />
                            <span>{b.whatsapp}</span>
                          </a>
                        </div>
                      </td>

                      {/* Ubicación & Sede */}
                      <td className="py-3.5 px-4 max-w-[160px]">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                          <span>{b.departamento || 'La Libertad'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {b.distrito || 'Trujillo'} • <span className="italic">{b.sede || 'Central'}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">
                          {b.tipoUniversidad === 'PRIVADA' ? '🏢 Privada' : '🏛️ Pública'}
                        </div>
                      </td>

                      {/* Universidad & Carrera */}
                      <td className="py-3.5 px-4 max-w-[180px]">
                        <div className="text-slate-800 dark:text-slate-200 font-bold truncate">
                          {b.universidadNombre || b.universidad?.siglas || b.universidad?.nombre || 'UNT'}
                        </div>
                        <div className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                          {b.carreraNombre || b.carrera?.nombre || 'Ing. Sistemas'}
                        </div>
                        <div className="text-[9px] text-sky-600 dark:text-sky-400 font-medium truncate mt-0.5">
                          {b.ciclo || '10mo'} • {b.tipoInvestigacion === 'TRABAJO_INVESTIGACION_BACHILLER' ? 'Bachiller' : 'Tesis'}
                        </div>
                      </td>

                      {/* Catálogo & Red Social */}
                      <td className="py-3.5 px-4 max-w-[170px]">
                        {paqueteDescargado ? (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-semibold truncate max-w-full">
                            <Download className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="truncate">{paqueteDescargado}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin descarga</span>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          <Share2 className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                          <span>{redSocial || 'META_ADS'}</span>
                        </div>
                      </td>

                      {/* Score y Prioridad */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-heading font-black text-xs text-sky-700 dark:text-sky-400">
                            {b.leadScore} <span className="text-[10px] font-normal text-slate-400">/ 100</span>
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[9px] font-black tracking-wider ${
                              prioridad === 'ALTA'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                                : prioridad === 'MEDIA'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                            }`}
                          >
                            {prioridad}
                          </span>
                        </div>
                      </td>

                      {/* Estado Funnel */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isCustomer
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30'
                              : isPayer
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                              : isLead
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {b.estadoFunnel}
                        </span>
                      </td>

                      {/* Acción Central [ INICIAR NEGOCIACIÓN ] */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleIniciarNegociacion(b)}
                          disabled={negotiatingId === b.id}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer mx-auto ${
                            isCustomer
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                              : 'bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-blue-500/20'
                          }`}
                        >
                          {negotiatingId === b.id ? (
                            <>
                              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                              <span>IA Activa...</span>
                            </>
                          ) : (
                            <>
                              <Bot className="w-3.5 h-3.5 text-sky-200" />
                              <span>Negociar IA</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Ver Ficha E-R */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => verDetalle(b.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                          title="Ver Ficha E-R Completa"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALLE DE BUYER CON ENTIDADES RELACIONALES COMPLETAS */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="glass-panel w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-2xl space-y-6 my-auto max-h-[92vh] overflow-y-auto">
            {loadingDetail || !selectedBuyer ? (
              <div className="py-16 text-center text-slate-500">
                <span className="animate-spin inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mb-3" />
                <p className="text-xs">Cargando relaciones de base de datos...</p>
              </div>
            ) : (
              <>
                {/* Cabecera del Perfil */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-500 text-white font-black text-base flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                      {(selectedBuyer.nombre || selectedBuyer.nombres || 'B')[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          {selectedBuyer.tipoPerfil || 'BUYER'} • Diagrama E-R
                        </span>
                        <span
                          className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            selectedBuyer.estadoFunnel === 'CUSTOMER'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                              : selectedBuyer.estadoFunnel === 'PAYER'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                          }`}
                        >
                          {selectedBuyer.estadoFunnel}
                        </span>
                      </div>
                      <h2 className="font-heading text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">
                        {selectedBuyer.nombre || `${selectedBuyer.nombres || ''} ${selectedBuyer.apellidos || ''}`.trim()}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailModalOpen(false)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Score & Resumen Rápido */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Lead Score Calculado</p>
                    <p className="font-heading text-xl font-black text-sky-700 dark:text-sky-400">{selectedBuyer.leadScore} / 100</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Edad & Perfil</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedBuyer.edad || 23} años • {selectedBuyer.tipoPerfil || 'ESTUDIANTE'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Canal Captación</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {selectedBuyer.canalCaptacion || 'META_ADS'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Prioridad Comercial</p>
                    <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                      {selectedBuyer.lead?.prioridad || (selectedBuyer.leadScore >= 75 ? 'ALTA' : 'MEDIA')}
                    </p>
                  </div>
                </div>

                {/* SECCIÓN 1: RELACIÓN DE FINANCIAMIENTO (financia_a_id_buyer) */}
                {(selectedBuyer.financiadoPor || (selectedBuyer.compradoresFinanciados && selectedBuyer.compradoresFinanciados.length > 0)) && (
                  <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700/40 space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                      <HeartHandshake className="w-4 h-4 text-amber-600" />
                      <span>Filiación y Financiamiento Relacional (BUYER.financia_a_id_buyer)</span>
                    </div>
                    {selectedBuyer.financiadoPor && (
                      <p className="text-xs text-amber-950 dark:text-amber-200">
                        👨‍👩‍👦 <strong>Financiado por:</strong> {selectedBuyer.financiadoPor.nombre || `${selectedBuyer.financiadoPor.nombres} ${selectedBuyer.financiadoPor.apellidos}`} ({selectedBuyer.financiadoPor.tipoPerfil}) - WhatsApp: <span className="font-mono">{selectedBuyer.financiadoPor.whatsapp}</span>
                      </p>
                    )}
                    {selectedBuyer.compradoresFinanciados && selectedBuyer.compradoresFinanciados.length > 0 && (
                      <div className="text-xs text-amber-950 dark:text-amber-200 space-y-1">
                        <p className="font-semibold">🎓 <strong>Estudiantes Patrocinados por este BUYER:</strong></p>
                        {selectedBuyer.compradoresFinanciados.map((est: any) => (
                          <div key={est.id} className="pl-3 border-l-2 border-amber-400">
                            {est.nombre || `${est.nombres} ${est.apellidos}`} (WhatsApp: {est.whatsapp})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SECCIÓN 2: UBICACIÓN E INSTITUCIÓN */}
                <div className="space-y-3 text-xs">
                  <h3 className="font-heading font-bold uppercase tracking-wider text-[11px] text-sky-700 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Ubicación, Sede e Institución Universitaria</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-700 dark:text-slate-300">
                    <div><strong className="text-slate-900 dark:text-slate-200">Departamento / Distrito:</strong> {selectedBuyer.departamento || 'La Libertad'} - {selectedBuyer.distrito || 'Trujillo'}</div>
                    <div><strong className="text-slate-900 dark:text-slate-200">Sede Universitaria:</strong> {selectedBuyer.sede || 'Sede Central'}</div>
                    <div><strong className="text-slate-900 dark:text-slate-200">Tipo de Universidad:</strong> {selectedBuyer.tipoUniversidad || 'PUBLICA'}</div>
                    <div><strong className="text-slate-900 dark:text-slate-200">Universidad:</strong> {selectedBuyer.universidadNombre || selectedBuyer.universidad?.nombre || 'Universidad Nacional de Trujillo'}</div>
                    <div><strong className="text-slate-900 dark:text-slate-200">Facultad:</strong> {selectedBuyer.facultad || 'Facultad de Ingeniería'}</div>
                    <div><strong className="text-slate-900 dark:text-slate-200">Carrera Profesional:</strong> {selectedBuyer.carreraNombre || selectedBuyer.carrera?.nombre || 'Ingeniería de Sistemas'}</div>
                    <div><strong className="text-slate-900 dark:text-slate-200">Ciclo Académico:</strong> {selectedBuyer.ciclo || '10mo ciclo'}</div>
                    <div><strong className="text-slate-900 dark:text-slate-200">WhatsApp:</strong> <span className="font-mono text-emerald-600">{selectedBuyer.whatsapp}</span></div>
                    <div><strong className="text-slate-900 dark:text-slate-200">Correo Electrónico:</strong> {selectedBuyer.correo || selectedBuyer.email}</div>
                  </div>
                </div>

                {/* SECCIÓN 3: DESCARGAS DE CONTENIDO (DESCARGA_CONTENIDO / CATALOGO_SERVICIOS) */}
                <div className="space-y-3 text-xs">
                  <h3 className="font-heading font-bold uppercase tracking-wider text-[11px] text-sky-700 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargas de Catálogo Oficial (DESCARGA_CONTENIDO)</span>
                  </h3>
                  {selectedBuyer.descargasContenido && selectedBuyer.descargasContenido.length > 0 ? (
                    <div className="space-y-2">
                      {selectedBuyer.descargasContenido.map((d: any) => (
                        <div key={d.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {d.servicio?.nombrePaquete || 'Material de Tesis'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Dirigido a: {d.servicio?.dirigidoA || 'Estudiantes universitarios'} • Fecha: {new Date(d.fechaDescarga).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-heading font-black text-emerald-600 dark:text-emerald-400">
                              S/ {Number(d.servicio?.precioBase || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-amber-600 block">
                              +{d.servicio?.recargoUrgenciaPct}% urgencia
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No ha realizado descargas de catálogo aún.</p>
                  )}
                </div>

                {/* SECCIÓN 4: INTERACCIONES EN REDES SOCIALES (INTERACCION_RED_SOCIAL) */}
                <div className="space-y-3 text-xs">
                  <h3 className="font-heading font-bold uppercase tracking-wider text-[11px] text-sky-700 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Interacciones en Redes Sociales (INTERACCION_RED_SOCIAL)</span>
                  </h3>
                  {selectedBuyer.interaccionesRedSocial && selectedBuyer.interaccionesRedSocial.length > 0 ? (
                    <div className="space-y-2">
                      {selectedBuyer.interaccionesRedSocial.map((i: any) => (
                        <div key={i.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                          <div>
                            <span className="font-bold text-blue-600 dark:text-sky-400 uppercase text-[10px]">
                              {i.redSocial} • {i.tipoInteraccion}
                            </span>
                            <p className="text-slate-800 dark:text-slate-200 font-medium text-xs mt-0.5">
                              {i.temaDetectado || 'Interés general en titulación'}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(i.fecha).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">No registra interacciones en redes sociales.</p>
                  )}
                </div>

                {/* SECCIÓN 5: SI YA ES PAYER O CUSTOMER */}
                {(selectedBuyer.estadoFunnel === 'PAYER' || selectedBuyer.estadoFunnel === 'CUSTOMER' || selectedBuyer.pagos?.length > 0 || selectedBuyer.customer) && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-purple-50/50 to-blue-50/50 dark:from-emerald-950/20 dark:via-purple-950/20 dark:to-blue-950/20 border border-emerald-300 dark:border-emerald-500/30 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/40 pb-2">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-heading font-black text-xs uppercase tracking-wider">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Adquisición & Asesoría Académica Activa</span>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                        {selectedBuyer.estadoFunnel}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Monto Abonado</span>
                        <p className="font-heading text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                          S/ {Number(selectedBuyer.payer?.montoTotalPagado || selectedBuyer.pagos?.[0]?.monto || 2200).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      <div className="bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 block">Asesor Metodológico</span>
                        <p className="font-heading text-xs font-black text-purple-700 dark:text-purple-300 mt-1 truncate">
                          {selectedBuyer.customer?.asesor
                            ? `${selectedBuyer.customer.asesor.gradoAcademico || 'Dr.'} ${selectedBuyer.customer.asesor.nombres} ${selectedBuyer.customer.asesor.apellidos}`
                            : 'Dr. Fernando Mendoza Morales'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Acciones al pie del Modal */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-wrap">
                  <button
                    onClick={() => setDetailModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>

                  <Link
                    href={`/admin/live-chat`}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ver en Live Chat</span>
                  </Link>

                  {selectedBuyer.estadoFunnel !== 'CUSTOMER' && (
                    <button
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleIniciarNegociacion(selectedBuyer);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                    >
                      <Bot className="w-4 h-4" />
                      <span>Iniciar Negociación con IA</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
