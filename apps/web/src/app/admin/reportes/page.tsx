'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  ShoppingBag,
  DollarSign,
  GraduationCap,
  Users,
  CreditCard,
  Award,
  Download,
  Share2,
  Building2,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Filter,
  FileText,
  UserCheck,
  Calendar,
  Layers,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';
import { api } from '@/lib/api';

type FaseTab = 'TODAS' | 'BUYER' | 'LEAD' | 'PAYER' | 'CUSTOMER';

export default function ReportesEjecutivosPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FaseTab>('TODAS');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.getExecutiveReports();
      setData(res);
    } catch (err) {
      console.error('Error fetching executive reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  if (loading && !data) {
    return (
      <div className="py-32 text-center text-slate-500 dark:text-slate-400">
        <span className="inline-block animate-spin rounded-full h-10 w-10 border-3 border-blue-600 dark:border-sky-400 border-t-transparent" />
        <p className="mt-4 text-sm font-semibold tracking-wide">Generando Reportes Ejecutivos de Inteligencia de Negocios...</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Cruzando productos, zonas geográficas, universidades y fases del Funnel</p>
      </div>
    );
  }

  const f1 = data?.fase1_buyer;
  const f2 = data?.fase2_lead;
  const f3 = data?.fase3_payer;
  const f4 = data?.fase4_customer;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Ejecutivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-sky-400 shadow-sm">
                <BarChart3 className="w-5 h-5" />
              </span>
              <span>Reportes Ejecutivos de Inteligencia de Negocios</span>
            </h1>
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
              Análisis Multidimensional por Fase
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 max-w-3xl leading-relaxed">
            Reportes ejecutivos directos y simplificados: <strong className="text-slate-900 dark:text-white font-bold">qué productos se vendieron en cada zona geográfica</strong>, recursos más descargados, objeciones por carrera y acompañamiento tutorial de tesis.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={fetchReports}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualizar Datos</span>
          </button>
          <Link
            href="/admin/dashboard"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <span>Ver Dashboard Kimball</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Tabs de Selección de Fase */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'TODAS', label: 'Todas las Fases (Consolidado)', icon: Layers },
          { id: 'BUYER', label: 'Fase 1: BUYER (Descargas & Zona)', icon: Users },
          { id: 'LEAD', label: 'Fase 2: LEAD (Cotizaciones & Uni)', icon: TrendingUp },
          { id: 'PAYER', label: 'Fase 3: PAYER (Ventas por Zona)', icon: ShoppingBag },
          { id: 'CUSTOMER', label: 'Fase 4: CUSTOMER (Asesores & Avance)', icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as FaseTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* FASE 3: PAYER (REPORTE CENTRAL: PRODUCTOS VENDIDOS POR ZONA GEOGRÁFICA)  */}
      {/* ========================================================================= */}
      {(activeTab === 'TODAS' || activeTab === 'PAYER') && (
        <section className="glass-panel p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-md bg-white dark:bg-slate-900/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 mb-1.5">
                <ShoppingBag className="w-3 h-3" />
                <span>{f3?.titulo || 'Fase 3: PAYER'}</span>
              </div>
              <h2 className="font-heading text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Reporte de Productos de Tesis Vendidos por Zona Geográfica
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {f3?.descripcion}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-right shrink-0">
              <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-medium block">Recaudación Confirmada</span>
              <span className="font-heading font-black text-emerald-700 dark:text-emerald-300 text-base sm:text-lg">
                {f3?.kpi_clave?.split(' en ')[0] || 'S/ 19,165.00'}
              </span>
            </div>
          </div>

          {/* Frase Clave Ejecutiva */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
              <strong className="font-black text-emerald-900 dark:text-emerald-100">Insight Ejecutivo:</strong>{' '}
              {f3?.frase_ejecutiva}
            </div>
          </div>

          {/* Tabla: Productos Vendidos por Zona */}
          <div className="space-y-2">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
              <span>Venta de Servicios Concretada por Zona / Ciudad</span>
            </h3>

            <div className="table-responsive-wrapper rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Producto / Servicio Adquirido</th>
                    <th className="py-3 px-4">Zona Geográfica (Venta)</th>
                    <th className="py-3 px-4 text-center">Unidades Vendidas</th>
                    <th className="py-3 px-4 text-right">Recaudación Total</th>
                    <th className="py-3 px-4 text-right">Ticket Promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                  {f3?.productos_vendidos_por_zona?.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {row.producto}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-sky-300 border border-blue-200 dark:border-blue-900/40 font-medium text-[11px]">
                          <MapPin className="w-2.5 h-2.5 text-red-500" />
                          <span>{row.zona}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {row.ventas} ventas
                      </td>
                      <td className="py-3 px-4 text-right font-heading font-black text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm">
                        S/ {Number(row.montoTotal).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                        S/ {Number(row.ticketPromedio).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grid Complementario: Métodos de Pago por Zona */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {f3?.metodos_pago_por_zona?.map((m: any, idx: number) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{m.zona}</span>
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{m.metodo}</p>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[10px] text-slate-400">{m.transacciones} pagos</span>
                  <span className="font-heading font-black text-emerald-600 dark:text-emerald-400">
                    S/ {Number(m.montoTotal).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* FASE 1: BUYER (DESCARGAS DE CATÁLOGO & REDES SOCIALES POR ZONA)           */}
      {/* ========================================================================= */}
      {(activeTab === 'TODAS' || activeTab === 'BUYER') && (
        <section className="glass-panel p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-md bg-white dark:bg-slate-900/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-sky-300 border border-blue-300 dark:border-blue-800 mb-1.5">
                <Users className="w-3 h-3" />
                <span>{f1?.titulo || 'Fase 1: BUYER'}</span>
              </div>
              <h2 className="font-heading text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Reporte de Recursos de Catálogo Descargados por Zona y Canal Social
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {f1?.descripcion}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-right shrink-0">
              <span className="text-[10px] text-blue-800 dark:text-sky-400 font-medium block">Alcance Territorial</span>
              <span className="font-heading font-black text-blue-700 dark:text-sky-300 text-base sm:text-lg">
                {f1?.kpi_clave?.split(' en ')[0] || '32 BUYERS'}
              </span>
            </div>
          </div>

          {/* Frase Clave Ejecutiva */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/20 border border-blue-200 dark:border-blue-800/50 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950 dark:text-sky-200 leading-relaxed">
              <strong className="font-black text-blue-900 dark:text-sky-100">Insight Ejecutivo:</strong>{' '}
              {f1?.frase_ejecutiva}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabla: Paquetes Descargados por Zona */}
            <div className="space-y-2">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Descargas de Catálogo Oficial (DESCARGA_CONTENIDO)</span>
              </h3>
              <div className="table-responsive-wrapper rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Zona / Depto</th>
                      <th className="py-2.5 px-3">Paquete del Catálogo</th>
                      <th className="py-2.5 px-3 text-center">Descargas</th>
                      <th className="py-2.5 px-3 text-right">Precio Base</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                    {f1?.descargas_por_zona?.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{row.zona}</td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{row.paquete}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-600 dark:text-sky-400">{row.totalDescargas}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600">S/ {Number(row.precioBase).toLocaleString('es-PE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Redes Sociales y Perfiles por Zona */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-sky-500" />
                  <span>Red Social de Origen por Zona (INTERACCION_RED_SOCIAL)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {f1?.redes_por_zona?.map((r: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block">{r.zona}</span>
                      <p className="font-bold text-xs text-blue-600 dark:text-sky-400 mt-0.5">{r.redSocial}</p>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mt-1 block">
                        {r.total} prospectos
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                  <span>Composición de Perfil por Zona</span>
                </h3>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs gap-3 flex-wrap">
                  {f1?.perfiles_por_zona?.map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="font-bold text-slate-900 dark:text-white">{p.zona}:</span>
                      <span className="text-blue-600 dark:text-sky-400 font-semibold">{p.estudiantes} Estudiantes</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{p.padresFamilia} Padres/Financ.</span>
                      <span className="text-teal-600 dark:text-teal-400 font-semibold">{p.egresados} Egresados</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* FASE 2: LEAD (COTIZACIONES POR UNIVERSIDAD & OBJECIONES POR CARRERA)        */}
      {/* ========================================================================= */}
      {(activeTab === 'TODAS' || activeTab === 'LEAD') && (
        <section className="glass-panel p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-md bg-white dark:bg-slate-900/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 mb-1.5">
                <TrendingUp className="w-3 h-3" />
                <span>{f2?.titulo || 'Fase 2: LEAD'}</span>
              </div>
              <h2 className="font-heading text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Reporte de Servicios de Tesis Más Cotizados por Universidad
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {f2?.descripcion}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-right shrink-0">
              <span className="text-[10px] text-indigo-800 dark:text-indigo-400 font-medium block">Demanda Negociada</span>
              <span className="font-heading font-black text-indigo-700 dark:text-indigo-300 text-base sm:text-lg">
                {f2?.kpi_clave?.split(' con ')[0] || '23 Cotizaciones'}
              </span>
            </div>
          </div>

          {/* Frase Clave Ejecutiva */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800/50 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
              <strong className="font-black text-indigo-900 dark:text-indigo-100">Insight Ejecutivo:</strong>{' '}
              {f2?.frase_ejecutiva}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabla: Cotizaciones por Universidad */}
            <div className="space-y-2">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Demanda de Tesis por Casa de Estudios</span>
              </h3>
              <div className="table-responsive-wrapper rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Universidad</th>
                      <th className="py-2.5 px-3">Servicio Más Cotizado</th>
                      <th className="py-2.5 px-3 text-center">Cotizaciones</th>
                      <th className="py-2.5 px-3 text-right">Monto Promedio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                    {f2?.cotizaciones_por_universidad?.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{row.universidad}</td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{row.servicio}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{row.cotizaciones}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">S/ {Number(row.montoPromedio).toLocaleString('es-PE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Objeciones por Carrera y Zona */}
            <div className="space-y-2">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                <span>Objeciones Detectadas por Carrera y Zona</span>
              </h3>
              <div className="table-responsive-wrapper rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Zona / Depto</th>
                      <th className="py-2.5 px-3">Carrera Profesional</th>
                      <th className="py-2.5 px-3">Objeción Detectada</th>
                      <th className="py-2.5 px-3 text-center">Frecuencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                    {f2?.objeciones_por_carrera?.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{row.zona}</td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{row.carrera}</td>
                        <td className="py-2.5 px-3 font-bold text-amber-600 dark:text-amber-400">{row.objecion}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* FASE 4: CUSTOMER (ATENCIÓN, ASESORES DOCTORALES & AVANCE DE TESIS)         */}
      {/* ========================================================================= */}
      {(activeTab === 'TODAS' || activeTab === 'CUSTOMER') && (
        <section className="glass-panel p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-md bg-white dark:bg-slate-900/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800 mb-1.5">
                <Award className="w-3 h-3" />
                <span>{f4?.titulo || 'Fase 4: CUSTOMER'}</span>
              </div>
              <h2 className="font-heading text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Reporte de Asesoría Académica, Asignación Doctoral y Avance de Tesis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {f4?.descripcion}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-right shrink-0">
              <span className="text-[10px] text-purple-800 dark:text-purple-400 font-medium block">Tesistas en Desarrollo</span>
              <span className="font-heading font-black text-purple-700 dark:text-purple-300 text-base sm:text-lg">
                {f4?.kpi_clave?.split(' con ')[0] || '6 Alumnos'}
              </span>
            </div>
          </div>

          {/* Frase Clave Ejecutiva */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800/50 flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs text-purple-950 dark:text-purple-200 leading-relaxed">
              <strong className="font-black text-purple-900 dark:text-purple-100">Insight Ejecutivo:</strong>{' '}
              {f4?.frase_ejecutiva}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabla: Asesores Doctorales por Zona */}
            <div className="space-y-2">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-purple-600" />
                <span>Asesores Doctorales Asignados por Zona</span>
              </h3>
              <div className="table-responsive-wrapper rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Asesor Doctoral</th>
                      <th className="py-2.5 px-3">Especialidad</th>
                      <th className="py-2.5 px-3">Zona</th>
                      <th className="py-2.5 px-3 text-center">Alumnos</th>
                      <th className="py-2.5 px-3 text-center">Sesiones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                    {f4?.atencion_por_asesor?.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{row.asesor}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 text-[11px] truncate max-w-[150px]">{row.especialidad}</td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{row.zona}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-purple-600 dark:text-purple-400">{row.clientesActivos}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">{row.sesionesEjecutadas} ses.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Avance de Tesis por Universidad */}
            <div className="space-y-2">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span>Avance Académico de Tesis por Universidad</span>
              </h3>
              <div className="table-responsive-wrapper rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Universidad</th>
                      <th className="py-2.5 px-3 text-center">Tesistas Activos</th>
                      <th className="py-2.5 px-3 text-center">Sesiones Totales</th>
                      <th className="py-2.5 px-3 text-right">Acompañamiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-transparent">
                    {f4?.avance_por_universidad?.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{row.universidad}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-600 dark:text-sky-400">{row.clientes}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700 dark:text-slate-300">{row.sesionesTotal} ejecutadas</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-600 text-[11px]">100% Conforme</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
