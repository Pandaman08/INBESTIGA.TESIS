'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Briefcase,
  DollarSign,
  FileCode,
  ArrowRight,
  ShieldCheck,
  Check,
  Users,
  Download,
  Share2,
  Building2,
  MapPin,
  UserCheck,
  Layers,
  Flame,
  MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';

const DEPARTAMENTOS_PERU: Record<string, string[]> = {
  'La Libertad': ['Trujillo', 'Víctor Larco Herrera', 'Huanchaco', 'Florencia de Mora', 'El Porvenir', 'Moche', 'Laredo', 'Chepén', 'Pacasmayo'],
  'Lima': ['Lima Cercado', 'Miraflores', 'San Isidro', 'San Borja', 'Los Olivos', 'San Martín de Porres', 'Santiago de Surco', 'Ate', 'Magdalena'],
  'Arequipa': ['Arequipa', 'Yanahuara', 'Cayma', 'Cerro Colorado', 'Bustamante y Rivero', 'Paucarpata'],
  'Lambayeque': ['Chiclayo', 'Lambayeque', 'Ferreñafe', 'La Victoria', 'Pimentel'],
  'Piura': ['Piura', 'Castilla', 'Catacaos', 'Sullana', 'Talara'],
  'Ancash': ['Huaraz', 'Chimbote', 'Nuevo Chimbote', 'Independencia'],
  'Cajamarca': ['Cajamarca', 'Jaén', 'Chota', 'Baños del Inca'],
  'Cusco': ['Cusco', 'Wanchaq', 'San Sebastián', 'Santiago'],
  'Junín': ['Huancayo', 'El Tambo', 'Chilca'],
  'San Martín': ['Tarapoto', 'Moyobamba', 'Morales'],
};

export default function FormularioPage() {
  const [loading, setLoading] = useState(false);
  const [catalogos, setCatalogos] = useState<any>({
    universidades: [],
    catalogoServicios: [],
    estudiantesFinanciables: [],
    tiposPerfil: [],
    canales: [],
  });
  const [resultado, setResultado] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // 1. Tipo de Perfil y Relación de Financiamiento (BUYER Diagram)
    tipoPerfil: 'ESTUDIANTE',
    financiaAIdBuyer: '',
    nombre: '',
    nombres: '',
    apellidos: '',
    edad: 23,
    whatsapp: '',
    email: '',
    correo: '',

    // 2. Ubicación Geográfica
    departamento: 'La Libertad',
    distrito: 'Trujillo',
    sede: 'Sede Central',

    // 3. Institución y Carrera Académica
    tipoUniversidad: 'PUBLICA',
    universidad: 'Universidad Nacional de Trujillo',
    universidadId: '',
    facultad: 'Facultad de Ingeniería',
    carrera: 'Ingeniería de Sistemas',
    carreraId: '',
    ciclo: '10mo ciclo',
    tipoInvestigacion: 'TRABAJO_INVESTIGACION_BACHILLER',

    // 4. Catálogo de Servicios y Descarga de Contenido (CATALOGO_SERVICIOS / DESCARGA_CONTENIDO)
    servicioIdAsociado: '',
    descargoLeadMagnet: true,

    // 5. Origen y Red Social (INTERACCION_RED_SOCIAL)
    canalCaptacion: 'META_ADS',
    redSocial: 'INSTAGRAM',
    tipoInteraccion: 'CLIC_ANUNCIO',
    temaDetectado: 'Asesoría en Matriz de Consistencia y Antiplagio',

    // 6. Diagnóstico Complementario de Necesidades
    situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
    plazoDefinidoDias: 60,
    presupuestoAprox: 2200,
    dolorPrincipal: 'Falta de tiempo laboral y asesor universitario no brinda retroalimentación',
    softwareRequerido: 'PYTHON',
    consentimientoWhatsapp: true,
  });

  useEffect(() => {
    api
      .getCatalogos()
      .then((data) => {
        if (data) {
          setCatalogos({
            universidades: data.universidades || [],
            catalogoServicios: data.catalogoServicios || [],
            estudiantesFinanciables: data.estudiantesFinanciables || [],
            tiposPerfil: data.tiposPerfil || [],
            canales: data.canales || [],
          });
          // Preseleccionar el primer paquete de servicios por defecto
          if (data.catalogoServicios && data.catalogoServicios.length > 0) {
            setFormData((prev) => ({
              ...prev,
              servicioIdAsociado: data.catalogoServicios[0].servicioId,
            }));
          }
        }
      })
      .catch((err) => console.error('Error al cargar catálogos:', err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (name === 'departamento') {
      const distritos = DEPARTAMENTOS_PERU[value] || ['Trujillo'];
      setFormData((prev) => ({
        ...prev,
        departamento: value,
        distrito: distritos[0],
      }));
    } else if (name === 'ciclo') {
      let sugerenciaTipo = formData.tipoInvestigacion;
      if (value === '9no ciclo' || value === '10mo ciclo') {
        sugerenciaTipo = 'TRABAJO_INVESTIGACION_BACHILLER';
      } else if (value === 'BACHILLER' || value === 'EGRESADO') {
        sugerenciaTipo = 'TESIS';
      }
      setFormData((prev) => ({
        ...prev,
        ciclo: value,
        tipoInvestigacion: sugerenciaTipo,
      }));
    } else if (name === 'nombres' || name === 'apellidos') {
      setFormData((prev) => {
        const nextNombres = name === 'nombres' ? value : prev.nombres;
        const nextApellidos = name === 'apellidos' ? value : prev.apellidos;
        return {
          ...prev,
          [name]: value,
          nombre: `${nextNombres} ${nextApellidos}`.trim(),
        };
      });
    } else if (name === 'email') {
      setFormData((prev) => ({
        ...prev,
        email: value,
        correo: value,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectPackage = (servicioId: string) => {
    setFormData((prev) => ({
      ...prev,
      servicioIdAsociado: servicioId,
      descargoLeadMagnet: true,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        ...formData,
        edad: Number(formData.edad) || 23,
        plazoDefinidoDias: Number(formData.plazoDefinidoDias) || 60,
        presupuestoAprox: Number(formData.presupuestoAprox) || 2200,
        financiaAIdBuyer:
          formData.tipoPerfil === 'PADRE_FAMILIA' || formData.tipoPerfil === 'APODERADO'
            ? formData.financiaAIdBuyer || undefined
            : undefined,
      };

      const res = await api.submitFormulario(payload);
      setResultado(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error al enviar el formulario.');
    } finally {
      setLoading(false);
    }
  };

  const distritosDisponibles = DEPARTAMENTOS_PERU[formData.departamento] || ['Trujillo'];

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 animate-fade-in space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-sky-400 text-xs font-bold border border-blue-200 dark:border-blue-500/20 shadow-xs">
          <GraduationCap className="w-4 h-4" />
          <span>Fase 1: BUYER • Captación & Diagnóstico Académico</span>
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white">
          Formulario Oficial de Diagnóstico de Tesis
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
          Diseñado bajo el modelo E-R del Funnel: identifica tu perfil, descarga recursos de nuestro catálogo oficial de servicios y obtén tu <strong className="text-slate-900 dark:text-white font-bold">Lead Score</strong> para atención prioritaria vía WhatsApp e IA.
        </p>
      </div>

      {resultado ? (
        /* Result & Scoring Breakdown Card */
        <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-emerald-300 dark:border-emerald-500/40 shadow-xl space-y-6 animate-fade-in bg-white dark:bg-slate-900">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/40 shrink-0">
              <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                ¡Registro BUYER Procesado en SQL Server!
              </span>
              <h2 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                {resultado.nombre || `${resultado.nombres} ${resultado.apellidos}`}
              </h2>
            </div>
          </div>

          {/* Score Badge */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Lead Score Calculado</p>
                <p className="font-heading text-3xl font-black text-slate-900 dark:text-white">
                  {resultado.leadScore} <span className="text-sm font-bold text-slate-400 dark:text-slate-500">/ 100</span>
                </p>
              </div>
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border ${
                  resultado.esLead
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border-blue-300 dark:border-blue-500/40'
                }`}
              >
                {resultado.estadoFunnel}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Estado del Funnel IMPULSE</p>
              <p className="font-heading text-sm font-bold text-sky-700 dark:text-sky-400 mt-1">
                {resultado.esLead ? '✓ Calificado como LEAD (Negociación IA Activa)' : 'Prospecto en Fase de Descubrimiento (BUYER)'}
              </p>
            </div>
          </div>

          {/* Breakdown List */}
          <div className="space-y-3 pt-2">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Criterios Ponderados del Lead Score:
            </h3>
            <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              {resultado.explicacionScore?.map((exp: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="break-words">{exp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Steps Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-4">
            <Link
              href="/admin/buyers"
              className="flex-1 text-center py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <span>Ver en Panel CRM de BUYERS</span> <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/admin/live-chat"
              className="py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Abrir Live Chat</span>
            </Link>

            <button
              onClick={() => setResultado(null)}
              className="py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Registrar Otro
            </button>
          </div>
        </div>
      ) : (
        /* Form Content */
        <form onSubmit={handleSubmit} className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-8 shadow-md bg-white dark:bg-slate-900/60">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="break-words">{errorMsg}</span>
            </div>
          )}

          {/* SECCIÓN 1: TIPO DE PERFIL & RELACIÓN FAMILIAR */}
          <div className="space-y-4">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Users className="w-4 h-4" />
              <span>1. Tipo de Perfil & Filiación Familiar (BUYER)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { value: 'ESTUDIANTE', label: 'Estudiante', sub: 'Pregrado / Posgrado' },
                { value: 'EGRESADO', label: 'Egresado', sub: 'Por titularse' },
                { value: 'PADRE_FAMILIA', label: 'Padre de Familia', sub: 'Financiador' },
                { value: 'APODERADO', label: 'Apoderado', sub: 'Tutor legal' },
              ].map((p) => {
                const isSelected = formData.tipoPerfil === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, tipoPerfil: p.value }))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 dark:border-sky-500 text-blue-900 dark:text-sky-200 shadow-xs ring-1 ring-blue-500'
                        : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">{p.label}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.sub}</div>
                  </button>
                );
              })}
            </div>

            {/* Selector condicional: financia_a_id_buyer */}
            {(formData.tipoPerfil === 'PADRE_FAMILIA' || formData.tipoPerfil === 'APODERADO') && (
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-700/40 space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>¿A qué estudiante financias o patrocinas? (financia_a_id_buyer)</span>
                </div>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-400/80 leading-relaxed">
                  Permite vincular este registro al estudiante para coordinar el avance de la tesis y las facilidades de financiamiento.
                </p>
                <select
                  name="financiaAIdBuyer"
                  value={formData.financiaAIdBuyer}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Seleccionar estudiante registrado --</option>
                  {catalogos.estudiantesFinanciables?.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre} ({e.detalle})
                    </option>
                  ))}
                  <option value="">Nuevo estudiante (a registrar posteriormente)</option>
                </select>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: DATOS PERSONALES */}
          <div className="space-y-4">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Sparkles className="w-4 h-4" />
              <span>2. Datos de Contacto y Personales</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nombres *</label>
                <input
                  type="text"
                  name="nombres"
                  required
                  placeholder="Ej. Ana Lucía"
                  value={formData.nombres}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Apellidos *</label>
                <input
                  type="text"
                  name="apellidos"
                  required
                  placeholder="Ej. Pérez Mendoza"
                  value={formData.apellidos}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Edad *</label>
                <input
                  type="number"
                  name="edad"
                  required
                  min={18}
                  max={75}
                  value={formData.edad}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">WhatsApp (con código de país) *</label>
                <input
                  type="text"
                  name="whatsapp"
                  required
                  placeholder="Ej. 51949123456"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Canal directo para el envío del diagnóstico y propuesta IA</p>
              </div>

              <div className="space-y-1.5 sm:col-span-4">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Correo Electrónico *</label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="ana.perez@unt.edu.pe"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: UBICACIÓN GEOGRÁFICA Y SEDE */}
          <div className="space-y-4">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <MapPin className="w-4 h-4" />
              <span>3. Ubicación Geográfica & Sede</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Departamento *</label>
                <select
                  name="departamento"
                  value={formData.departamento}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(DEPARTAMENTOS_PERU).map((dep) => (
                    <option key={dep} value={dep}>
                      {dep}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Distrito *</label>
                <select
                  name="distrito"
                  value={formData.distrito}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {distritosDisponibles.map((dis) => (
                    <option key={dis} value={dis}>
                      {dis}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sede Universitaria *</label>
                <input
                  type="text"
                  name="sede"
                  required
                  placeholder="Sede Central / Filial"
                  value={formData.sede}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: INSTITUCIÓN UNIVERSITARIA & CARRERA */}
          <div className="space-y-4">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Building2 className="w-4 h-4" />
              <span>4. Institución Universitaria & Carrera</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo de Universidad *</label>
                <div className="flex gap-2">
                  {['PUBLICA', 'PRIVADA'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, tipoUniversidad: t }))}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        formData.tipoUniversidad === t
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {t === 'PUBLICA' ? '🏛️ Pública (Nacional)' : '🏢 Privada (Particular)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Universidad *</label>
                <select
                  name="universidad"
                  value={formData.universidad}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Universidad Nacional de Trujillo">Universidad Nacional de Trujillo (UNT)</option>
                  <option value="Universidad César Vallejo">Universidad César Vallejo (UCV)</option>
                  <option value="Universidad Privada Antenor Orrego">Universidad Privada Antenor Orrego (UPAO)</option>
                  <option value="Universidad Nacional Mayor de San Marcos">UNMSM (Lima)</option>
                  <option value="Pontificia Universidad Católica del Perú">PUCP (Lima)</option>
                  <option value="Universidad Tecnológica del Perú">UTP</option>
                  <option value="Universidad Privada del Norte">UPN</option>
                  <option value="Otra Universidad">Otra Universidad</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Facultad *</label>
                <input
                  type="text"
                  name="facultad"
                  required
                  placeholder="Ej. Facultad de Ingeniería"
                  value={formData.facultad}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Carrera Profesional *</label>
                <input
                  type="text"
                  name="carrera"
                  required
                  placeholder="Ej. Ingeniería de Sistemas"
                  value={formData.carrera}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Ciclo Académico *</label>
                <select
                  name="ciclo"
                  value={formData.ciclo}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="9no ciclo">9no ciclo</option>
                  <option value="10mo ciclo">10mo ciclo (Próximo a egresar)</option>
                  <option value="EGRESADO">Egresado (Pendiente de Bachiller o Título)</option>
                  <option value="BACHILLER">Bachiller (Postulando a Título Profesional)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo de Grado Requerido *</label>
                <select
                  name="tipoInvestigacion"
                  value={formData.tipoInvestigacion}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TRABAJO_INVESTIGACION_BACHILLER">Trabajo de Investigación (Para Grado de Bachiller)</option>
                  <option value="PLAN_DE_TESIS">Plan / Proyecto de Tesis (Para Título Profesional)</option>
                  <option value="TESIS">Tesis de Grado Completa (Para Título Profesional)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 5: CATÁLOGO DE SERVICIOS & DESCARGA DE CONTENIDO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2">
                <Download className="w-4 h-4" />
                <span>5. Catálogo de Servicios & Material de Descarga (DESCARGA_CONTENIDO)</span>
              </h3>
              <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20">
                +15 pts Lead Score por descarga
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Selecciona el paquete de tu interés. Recibirás de inmediato la guía y estructura descargable correspondiente (registrado en <code className="font-mono text-blue-600 dark:text-sky-400">DESCARGA_CONTENIDO</code>):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {catalogos.catalogoServicios?.map((s: any) => {
                const isSelected = formData.servicioIdAsociado === s.servicioId;
                return (
                  <div
                    key={s.servicioId}
                    onClick={() => handleSelectPackage(s.servicioId)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 dark:border-sky-500 shadow-md ring-2 ring-blue-500/30'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-heading font-black text-xs text-slate-900 dark:text-white">
                          {s.nombrePaquete}
                        </span>
                        {isSelected && (
                          <span className="p-1 rounded-full bg-blue-600 text-white">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {s.incluye}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 italic">
                        Dirigido a: {s.dirigidoA}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Precio Base</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400 font-heading">
                          S/ {Number(s.precioBase).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Recargo Urgencia</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 text-[11px]">
                          +{s.recargoUrgenciaPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 6: CANAL DE CAPTACIÓN & REDES SOCIALES */}
          <div className="space-y-4">
            <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <Share2 className="w-4 h-4" />
              <span>6. Canal de Captación & Red Social (INTERACCION_RED_SOCIAL)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Canal de Procedencia *</label>
                <select
                  name="canalCaptacion"
                  value={formData.canalCaptacion}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TIKTOK">TikTok</option>
                  <option value="META_ADS">Meta Ads (Instagram / FB)</option>
                  <option value="GOOGLE">Google Search</option>
                  <option value="ORGANICO">Página Web / Orgánico</option>
                  <option value="RECOMENDACION">Recomendación de Amigo</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Red Social Específica *</label>
                <select
                  name="redSocial"
                  value={formData.redSocial}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TIKTOK">TikTok</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="LINKEDIN">LinkedIn</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipo de Interacción *</label>
                <select
                  name="tipoInteraccion"
                  value={formData.tipoInteraccion}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CLIC_ANUNCIO">Clic en Anuncio Patrocinado</option>
                  <option value="COMENTARIO_POST">Comentario en Publicación</option>
                  <option value="MENSAJE_DIRECTO">Mensaje Directo (DM)</option>
                  <option value="LIKE_REEL">Like en Reel Informativo</option>
                  <option value="REGISTRO_FORMULARIO">Registro Directo en Formulario</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tema Detectado</label>
                <input
                  type="text"
                  name="temaDetectado"
                  placeholder="Ej. Matriz de consistencia"
                  value={formData.temaDetectado}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 7: DIAGNÓSTICO ADICIONAL */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                <span>7. Diagnóstico de Necesidades (Suma Lead Score)</span>
              </h3>
              <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20">
                +45 pts posibles
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" /> <span>Situación Laboral</span>
                </label>
                <select
                  name="situacionLaboral"
                  value={formData.situacionLaboral}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TRABAJA_TIEMPO_COMPLETO">Trabaja tiempo completo</option>
                  <option value="MEDIO_TIEMPO">Trabaja medio tiempo</option>
                  <option value="SOLO_ESTUDIA">Dedicación exclusiva al estudio</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> <span>Plazo Deseado (días)</span>
                </label>
                <input
                  type="number"
                  name="plazoDefinidoDias"
                  value={formData.plazoDefinidoDias}
                  onChange={handleChange}
                  placeholder="60"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" /> <span>Presupuesto (S/)</span>
                </label>
                <input
                  type="number"
                  name="presupuestoAprox"
                  value={formData.presupuestoAprox}
                  onChange={handleChange}
                  placeholder="2200"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5 text-slate-400" /> <span>Software Requerido</span>
                </label>
                <select
                  name="softwareRequerido"
                  value={formData.softwareRequerido}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SPSS">SPSS (Estadística Social/Salud)</option>
                  <option value="PYTHON">Python / R (Data Science)</option>
                  <option value="ATLAS_TI">Atlas.ti (Cualitativa)</option>
                  <option value="STATA">Stata (Econometría)</option>
                  <option value="EXCEL">Excel Avanzado</option>
                  <option value="NINGUNO">Ninguno / Por definir</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Principal Dolor o Dificultad en tu Tesis
                </label>
                <textarea
                  name="dolorPrincipal"
                  rows={2}
                  value={formData.dolorPrincipal}
                  onChange={handleChange}
                  placeholder="Ej. El asesor no responde correos, no entiendo la estadística inferencial..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Consentimientos */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="consentimientoWhatsapp"
                checked={formData.consentimientoWhatsapp}
                onChange={handleChange}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                Acepto recibir orientaciones metodológicas y propuestas personalizadas por WhatsApp por parte de INBESTIGA.TESIS (+15 pts Lead Score).
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="descargoLeadMagnet"
                checked={formData.descargoLeadMagnet}
                onChange={handleChange}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Deseo descargar de forma gratuita la ficha técnica del servicio seleccionado y la guía de matriz de consistencia (+15 pts Lead Score).
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Registrar BUYER en Base de Datos & Calcular Score</span>
          </button>
        </form>
      )}
    </div>
  );
}
