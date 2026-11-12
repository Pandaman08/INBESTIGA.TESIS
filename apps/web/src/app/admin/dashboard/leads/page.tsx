'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Database, RefreshCw, Play, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

const measures = [
  ['M1', 'diagnostico_solicitud_madura'], ['M2', 'diagnostico_oportuno'],
  ['M3', 'oportunidad_apta_madura'], ['M4', 'cotizacion_oportuna'],
  ['M5', 'cotizacion_madura'], ['M6', 'aceptacion_30d'],
  ['M7', 'cohorte_madura'], ['M8', 'conversion_60d'],
  ['M9', 'objecion_principal_madura'], ['M10', 'objecion_recuperada_30d'],
];

const kpis = [
  ['K1', 'Diagnósticos oportunos', 'M2 / M1', 'EstadoK1'],
  ['K2', 'Cotizaciones oportunas', 'M4 / M3', 'EstadoK2'],
  ['K3', 'Aceptación de propuestas', 'M6 / M5', 'EstadoK3'],
  ['K4', 'Recuperación de objeciones', 'M10 / M9', 'EstadoK4'],
  ['K5', 'Conversión a PAYERS', 'M8 / M7', 'EstadoK5'],
] as const;

export default function LeadsDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [reports, setReports] = useState<Record<string, any[]>>({});
  const [corte, setCorte] = useState('2026-04-30');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [dashboard, r1, r2, r3, r4] = await Promise.all([
        api.getLeadsDashboard(), api.getLeadsReport('r1'), api.getLeadsReport('r2'),
        api.getLeadsReport('r3'), api.getLeadsReport('r4'),
      ]);
      setData(dashboard); setReports({ r1, r2, r3, r4 });
    } catch (e: any) { setError(e.message || 'No fue posible consultar el DataMart'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const execute = async () => {
    setRunning(true); setError(null);
    try { await api.runLeadsEtl(corte); await load(); }
    catch (e: any) { setError(e.message || 'El ETL no pudo ejecutarse'); }
    finally { setRunning(false); }
  };

  const row = Array.isArray(data?.datos) ? data.datos[0] : data?.datos;
  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">IMPULSE · LEADS</p><h1 className="text-2xl font-bold">Hoja de gestión oficial</h1><p className="text-sm text-slate-500">Los KPI se leen del DataMart; R4 se verifica en el OLTP.</p></div>
        <div className="flex items-center gap-2"><input type="date" value={corte} onChange={e => setCorte(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" /><button onClick={execute} disabled={running} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={15} />{running ? 'Ejecutando…' : 'Ejecutar ETL'}</button><button onClick={load} className="rounded-lg border p-2" title="Actualizar"><RefreshCw size={16} /></button></div>
      </div>
      {error && <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} /><div><b>Datos no disponibles.</b> {error}<p className="mt-1 text-xs">No se muestran valores de sustitución ni KPI ficticios.</p></div></div>}
      {loading && <p className="text-sm text-slate-500">Consultando SQL Server…</p>}
      {row && <>
        <div className="grid gap-4 md:grid-cols-5">{kpis.map(([id, label, formula, status]) => <div key={id} className="rounded-xl border bg-white p-4 shadow-sm"><div className="flex justify-between"><span className="text-xs font-bold text-indigo-600">{id}</span><span className="text-xs font-semibold">{row[status]}</span></div><p className="mt-2 text-sm font-semibold">{label}</p><p className="mt-1 text-3xl font-bold">{row[id] == null ? 'No aplicable' : `${row[id]} %`}</p><p className="text-xs text-slate-400">100 × {formula}</p></div>)}</div>
        <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 flex items-center gap-2 font-bold"><Database size={17} />Medidas físicas</h2><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{measures.map(([id, name]) => <div key={id} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{id}</p><p className="text-xs">{name}</p><p className="text-xl font-bold">{row[id] ?? 0}</p></div>)}</div></section>
        <p className="text-xs text-slate-500"><CheckCircle2 className="mr-1 inline text-emerald-600" size={14} />Fuente: {data.fuente}. Última ejecución: {data.ultimaEjecucionEtl?.[0]?.fecha_fin ?? 'sin ejecución registrada'}.</p>
        {(['r1', 'r2', 'r3', 'r4'] as const).map(r => <section key={r} className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-bold">Reporte {r.toUpperCase()}</h2><div className="overflow-auto"><table className="min-w-full text-left text-sm"><tbody>{(reports[r] || []).slice(0, 20).map((item, i) => <tr key={i} className="border-t">{Object.entries(item).map(([key, value]) => <td key={key} className="px-3 py-2"><span className="mr-1 text-xs text-slate-400">{key}:</span>{String(value ?? '—')}</td>)}</tr>)}</tbody></table></div></section>)}
      </>}
    </main>
  );
}
