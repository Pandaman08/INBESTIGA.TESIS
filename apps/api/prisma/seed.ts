import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // El seed VACÍA todas las tablas antes de cargar datos de demostración.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed borra toda la base de datos: no se ejecuta con NODE_ENV=production.');
  }
  // Credenciales iniciales desde el entorno: nunca contraseñas fijas en el repositorio.
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('Defina SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (mínimo 12 caracteres) antes de ejecutar el seed.');
  }
  console.log('================================================================');
  console.log('--- INBESTIGA.TESIS: Iniciando Seed Completo y Validado ---');
  console.log('================================================================');

  // 1. LIMPIEZA CONTROLADA EN ORDEN INVERSO DE DEPENDENCIAS (CASCADE-SAFE)
  console.log('1. Limpiando tablas de la base de datos OLTP...');
  await prisma.sesion.deleteMany({});
  await prisma.asignacionAsesor.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.payer.deleteMany({});
  await prisma.pago.deleteMany({});
  await prisma.cotizacion.deleteMany({});
  // LEADS (P02): tablas que referencian PROPUESTA, OPORTUNIDAD, LEAD o ASESOR
  await prisma.eventoLeads.deleteMany({});
  await prisma.respuestaPropuesta.deleteMany({});
  await prisma.propuestaEntregable.deleteMany({});
  await prisma.propuestaAjuste.deleteMany({});
  await prisma.transferenciaPayer.deleteMany({});
  await prisma.conversionPayerRef.deleteMany({});
  await prisma.citaHistorial.deleteMany({});
  await prisma.citaVirtual.deleteMany({});
  await prisma.escalamiento.deleteMany({});
  await prisma.responsablePago.deleteMany({});
  await prisma.objecion.deleteMany({});
  await prisma.seguimiento.deleteMany({});
  await prisma.propuesta.deleteMany({});
  await prisma.diagnostico.deleteMany({});
  await prisma.mensaje.deleteMany({});
  await prisma.conversacion.deleteMany({});
  await prisma.oportunidadHistorial.deleteMany({});
  await prisma.oportunidadComercial.deleteMany({});
  await prisma.entregable.deleteMany({});
  await prisma.perfilNegociacion.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.formulario.deleteMany({});
  await prisma.interaccion.deleteMany({});
  await prisma.buyer.deleteMany({});
  await prisma.reglaComercial.deleteMany({});
  await prisma.servicio.deleteMany({});
  await prisma.contenido.deleteMany({});
  await prisma.campana.deleteMany({});
  await prisma.canal.deleteMany({});
  await prisma.asesor.deleteMany({});
  await prisma.carrera.deleteMany({});
  await prisma.universidad.deleteMany({});
  await prisma.ubicacion.deleteMany({});
  await prisma.notificacion.deleteMany({});
  await prisma.configuracionAgente.deleteMany({});
  await prisma.usuario.deleteMany({});
  console.log('✓ Tablas limpiadas correctamente.');

  // 2. USUARIOS
  console.log('2. Registrando usuarios del sistema...');
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.usuario.create({
    data: {
      username: 'admin',
      email: adminEmail,
      passwordHash,
      rol: 'ADMIN',
      activo: true,
    },
  });

  const asesorUser = await prisma.usuario.create({
    data: {
      username: 'asesor_sistemas',
      email: 'asesor.sistemas@inbestiga.edu.pe',
      passwordHash,
      rol: 'ASESOR',
      activo: false, // cuenta de ejemplo deshabilitada (comparte la contraseña del admin)
    },
  });
  console.log(`✓ Usuarios creados: ${adminEmail} (ADMIN), asesor.sistemas@inbestiga.edu.pe (ASESOR, inactivo)`);

  // 3. UBICACIONES
  console.log('3. Registrando ubicaciones geográficas...');
  const ubiTrujillo = await prisma.ubicacion.create({
    data: { departamento: 'La Libertad', provincia: 'Trujillo', distrito: 'Trujillo' },
  });
  const ubiVictorLarco = await prisma.ubicacion.create({
    data: { departamento: 'La Libertad', provincia: 'Trujillo', distrito: 'Víctor Larco Herrera' },
  });
  const ubiHuanchaco = await prisma.ubicacion.create({
    data: { departamento: 'La Libertad', provincia: 'Trujillo', distrito: 'Huanchaco' },
  });
  const ubiLimaSanIsidro = await prisma.ubicacion.create({
    data: { departamento: 'Lima', provincia: 'Lima', distrito: 'San Isidro' },
  });
  const ubiLimaLosOlivos = await prisma.ubicacion.create({
    data: { departamento: 'Lima', provincia: 'Lima', distrito: 'Los Olivos' },
  });
  const ubiChiclayo = await prisma.ubicacion.create({
    data: { departamento: 'Lambayeque', provincia: 'Chiclayo', distrito: 'Chiclayo' },
  });
  const ubiArequipa = await prisma.ubicacion.create({
    data: { departamento: 'Arequipa', provincia: 'Arequipa', distrito: 'Arequipa' },
  });
  console.log('✓ 7 Ubicaciones registradas');

  // 4. UNIVERSIDADES
  console.log('4. Registrando universidades peruanas...');
  const unt = await prisma.universidad.create({
    data: { nombre: 'Universidad Nacional de Trujillo', siglas: 'UNT', ciudad: 'Trujillo', tipo: 'PUBLICA' },
  });
  const ucv = await prisma.universidad.create({
    data: { nombre: 'Universidad César Vallejo', siglas: 'UCV', ciudad: 'Trujillo', tipo: 'PRIVADA' },
  });
  const upao = await prisma.universidad.create({
    data: { nombre: 'Universidad Privada Antenor Orrego', siglas: 'UPAO', ciudad: 'Trujillo', tipo: 'PRIVADA' },
  });
  const unmsm = await prisma.universidad.create({
    data: { nombre: 'Universidad Nacional Mayor de San Marcos', siglas: 'UNMSM', ciudad: 'Lima', tipo: 'PUBLICA' },
  });
  const pucp = await prisma.universidad.create({
    data: { nombre: 'Pontificia Universidad Católica del Perú', siglas: 'PUCP', ciudad: 'Lima', tipo: 'PRIVADA' },
  });
  const uni = await prisma.universidad.create({
    data: { nombre: 'Universidad Nacional de Ingeniería', siglas: 'UNI', ciudad: 'Lima', tipo: 'PUBLICA' },
  });
  console.log('✓ 6 Universidades registradas');

  // 5. CARRERAS
  console.log('5. Registrando carreras por facultad y área...');
  const carSistemasUNT = await prisma.carrera.create({
    data: { universidadId: unt.id, nombre: 'Ingeniería de Sistemas', facultad: 'Facultad de Ingeniería', areaConocimiento: 'INGENIERIA' },
  });
  const carContabilidadUNT = await prisma.carrera.create({
    data: { universidadId: unt.id, nombre: 'Contabilidad y Finanzas', facultad: 'Ciencias Económicas', areaConocimiento: 'NEGOCIOS' },
  });
  const carEnfermeriaUNT = await prisma.carrera.create({
    data: { universidadId: unt.id, nombre: 'Enfermería', facultad: 'Enfermería', areaConocimiento: 'CIENCIAS_SALUD' },
  });

  const carIndustrialUCV = await prisma.carrera.create({
    data: { universidadId: ucv.id, nombre: 'Ingeniería Industrial', facultad: 'Facultad de Ingeniería', areaConocimiento: 'INGENIERIA' },
  });
  const carPsicologiaUCV = await prisma.carrera.create({
    data: { universidadId: ucv.id, nombre: 'Psicología', facultad: 'Ciencias Humanas', areaConocimiento: 'SOCIALES' },
  });
  const carCivilUCV = await prisma.carrera.create({
    data: { universidadId: ucv.id, nombre: 'Ingeniería Civil', facultad: 'Facultad de Ingeniería', areaConocimiento: 'INGENIERIA' },
  });

  const carDerechoUPAO = await prisma.carrera.create({
    data: { universidadId: upao.id, nombre: 'Derecho y Ciencias Políticas', facultad: 'Facultad de Derecho', areaConocimiento: 'DERECHO' },
  });
  const carMedicinaUPAO = await prisma.carrera.create({
    data: { universidadId: upao.id, nombre: 'Medicina Humana', facultad: 'Facultad de Medicina', areaConocimiento: 'CIENCIAS_SALUD' },
  });
  const carAdminUPAO = await prisma.carrera.create({
    data: { universidadId: upao.id, nombre: 'Administración de Empresas', facultad: 'Ciencias Económicas', areaConocimiento: 'NEGOCIOS' },
  });

  const carMedicinaUNMSM = await prisma.carrera.create({
    data: { universidadId: unmsm.id, nombre: 'Medicina Humana', facultad: 'San Fernando', areaConocimiento: 'CIENCIAS_SALUD' },
  });
  const carEconomiaUNMSM = await prisma.carrera.create({
    data: { universidadId: unmsm.id, nombre: 'Economía', facultad: 'Ciencias Económicas', areaConocimiento: 'NEGOCIOS' },
  });

  const carIndustrialPUCP = await prisma.carrera.create({
    data: { universidadId: pucp.id, nombre: 'Ingeniería Industrial', facultad: 'Ciencias e Ingeniería', areaConocimiento: 'INGENIERIA' },
  });
  const carSistemasUNI = await prisma.carrera.create({
    data: { universidadId: uni.id, nombre: 'Ingeniería de Sistemas', facultad: 'FIIS', areaConocimiento: 'INGENIERIA' },
  });
  console.log('✓ 13 Carreras registradas');

  // 6. CANALES Y CAMPAÑAS
  console.log('6. Registrando canales y campañas de captación...');
  const canalMeta = await prisma.canal.create({
    data: { nombre: 'Meta Ads (Facebook / Instagram)', codigo: 'META_ADS', tipo: 'PAGADO', descripcion: 'Campañas segmentadas por universidad y carrera' },
  });
  const canalTiktok = await prisma.canal.create({
    data: { nombre: 'TikTok Ads', codigo: 'TIKTOK', tipo: 'PAGADO', descripcion: 'Tráfico viral a landing page de matriz de consistencia' },
  });
  const canalGoogle = await prisma.canal.create({
    data: { nombre: 'Google Search & Display', codigo: 'GOOGLE', tipo: 'PAGADO', descripcion: 'Búsquedas de alta intención: asesoría de tesis trujillo' },
  });
  const canalOrganico = await prisma.canal.create({
    data: { nombre: 'Búsqueda Orgánica / Web', codigo: 'ORGANICO', tipo: 'ORGANICO', descripcion: 'Tráfico orgánico a artículos de blog' },
  });
  const canalReferido = await prisma.canal.create({
    data: { nombre: 'Recomendación / Boca a Boca', codigo: 'REFERIDO', tipo: 'REFERIDO', descripcion: 'Graduados que recomiendan a compañeros' },
  });

  const campTesis2026 = await prisma.campana.create({
    data: {
      canalId: canalMeta.id,
      nombre: 'Campaña Titulación 2026-I (Meta Ads)',
      presupuesto: 2500.0,
      fechaInicio: new Date('2026-07-01'),
      fechaFin: new Date('2026-12-31'),
    },
  });
  const campTiktokFlash = await prisma.campana.create({
    data: {
      canalId: canalTiktok.id,
      nombre: 'Campaña Tesis Flash (TikTok Ads)',
      presupuesto: 1800.0,
      fechaInicio: new Date('2026-08-01'),
      fechaFin: new Date('2026-11-30'),
    },
  });
  const campGoogleSearch = await prisma.campana.create({
    data: {
      canalId: canalGoogle.id,
      nombre: 'Campaña Intención Tesis Urgente (Google)',
      presupuesto: 2000.0,
      fechaInicio: new Date('2026-08-15'),
      fechaFin: new Date('2026-12-15'),
    },
  });
  const campOrganica = await prisma.campana.create({
    data: {
      canalId: canalOrganico.id,
      nombre: 'Campaña Blog Científico & SEO',
      presupuesto: 0.0,
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-12-31'),
    },
  });

  // Contenidos / Lead Magnets
  await prisma.contenido.create({
    data: {
      campanaId: campTesis2026.id,
      titulo: 'Guía Definitiva: Cómo plantear tu matriz de consistencia sin errores',
      tipo: 'GUIA_PDF',
      leadMagnet: true,
      url: 'https://inbestiga.tesis/recursos/guia-matriz-consistencia.pdf',
    },
  });
  await prisma.contenido.create({
    data: {
      campanaId: campTiktokFlash.id,
      titulo: 'Plantilla Excel: Operacionalización de variables y baremos psicométricos',
      tipo: 'DOCUMENT',
      leadMagnet: true,
      url: 'https://inbestiga.tesis/recursos/plantilla-operacionalizacion.xlsx',
    },
  });
  await prisma.contenido.create({
    data: {
      campanaId: campGoogleSearch.id,
      titulo: 'Masterclass en Video: Las 5 preguntas críticas de tu jurado de tesis',
      tipo: 'VIDEO',
      leadMagnet: true,
      url: 'https://inbestiga.tesis/recursos/masterclass-sustentacion',
    },
  });
  await prisma.contenido.create({
    data: {
      campanaId: campOrganica.id,
      titulo: 'Ebook: Normas APA 7ma edición para citas y referencias complejas',
      tipo: 'GUIA_PDF',
      leadMagnet: true,
      url: 'https://inbestiga.tesis/recursos/ebook-apa-7ma.pdf',
    },
  });
  console.log('✓ Canales, Campañas y Lead Magnets configurados');

  // 7. SERVICIOS Y REGLAS COMERCIALES
  console.log('7. Registrando catálogo de servicios y reglas comerciales...');
  const srvTesis = await prisma.servicio.create({
    data: {
      nombre: 'Asesoría Integral de Tesis de Grado',
      codigo: 'TESIS_INTEGRAL',
      descripcion: 'Acompañamiento completo desde la formulación del problema hasta la sustentación final. Incluye marco teórico, diseño metodológico, validación de instrumentos y análisis estadístico.',
      tipoInvestigacion: 'TESIS',
      precioBase: 2200.0,
      precioMinimo: 1870.0, // max 15% desc
      precioMaximo: 2800.0,
      plazoSemanasMin: 6,
      plazoSemanasMax: 16,
      maxCuotas: 4,
    },
  });
  await prisma.reglaComercial.create({
    data: {
      servicioId: srvTesis.id,
      tipoInvestigacion: 'TESIS',
      descuentoMaximoPct: 15.0,
      descuentoPagoUnicoPct: 10.0,
      cuotaMinima: 300.0,
      plazoMinimoDias: 30,
      plazoMaximoDias: 120,
      condicionesEspeciales: 'Aplica para tesistas de pregrado y posgrado con tema registrado.',
    },
  });

  const srvPlan = await prisma.servicio.create({
    data: {
      nombre: 'Elaboración y Aprobación de Plan de Tesis',
      codigo: 'PLAN_TESIS',
      descripcion: 'Diseño riguroso del proyecto de tesis: justificación, estado del arte, formulación de hipótesis, operacionalización de variables y metodología según normativa universitaria.',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      precioBase: 1200.0,
      precioMinimo: 1020.0,
      precioMaximo: 1500.0,
      plazoSemanasMin: 3,
      plazoSemanasMax: 8,
      maxCuotas: 2,
    },
  });
  await prisma.reglaComercial.create({
    data: {
      servicioId: srvPlan.id,
      tipoInvestigacion: 'PLAN_DE_TESIS',
      descuentoMaximoPct: 15.0,
      descuentoPagoUnicoPct: 10.0,
      cuotaMinima: 250.0,
      plazoMinimoDias: 20,
      plazoMaximoDias: 60,
      condicionesEspeciales: 'Garantía de levantamiento de observaciones hasta aprobación.',
    },
  });

  const srvEstadistica = await prisma.servicio.create({
    data: {
      nombre: 'Tratamiento y Análisis Estadístico (SPSS / Python / R)',
      codigo: 'ANALISIS_ESTADISTICO',
      descripcion: 'Depuración de datos, pruebas de normalidad, contrastación de hipótesis paramétricas y no paramétricas (ANOVA, Chi-cuadrado, Regresión) con tablas y gráficos en formato APA 7ma.',
      tipoInvestigacion: 'TESIS',
      precioBase: 850.0,
      precioMinimo: 722.5,
      precioMaximo: 1100.0,
      plazoSemanasMin: 2,
      plazoSemanasMax: 4,
      maxCuotas: 2,
    },
  });
  await prisma.reglaComercial.create({
    data: {
      servicioId: srvEstadistica.id,
      tipoInvestigacion: 'TESIS',
      descuentoMaximoPct: 15.0,
      descuentoPagoUnicoPct: 10.0,
      cuotaMinima: 200.0,
      plazoMinimoDias: 10,
      plazoMaximoDias: 30,
      condicionesEspeciales: 'Incluye script de procesamiento y asesoría grabada de interpretación.',
    },
  });

  const srvArticulo = await prisma.servicio.create({
    data: {
      nombre: 'Redacción y Adaptación de Artículo Científico (Scopus / WoS)',
      codigo: 'ARTICULO_CIENTIFICO',
      descripcion: 'Transformación de tesis o resultados empíricos a formato de artículo científico de alto impacto. Selección de revista diana e informe antiplagio.',
      tipoInvestigacion: 'ARTICULO_CIENTIFICO',
      precioBase: 1600.0,
      precioMinimo: 1360.0,
      precioMaximo: 2200.0,
      plazoSemanasMin: 4,
      plazoSemanasMax: 10,
      maxCuotas: 3,
    },
  });
  await prisma.reglaComercial.create({
    data: {
      servicioId: srvArticulo.id,
      tipoInvestigacion: 'ARTICULO_CIENTIFICO',
      descuentoMaximoPct: 15.0,
      descuentoPagoUnicoPct: 10.0,
      cuotaMinima: 350.0,
      plazoMinimoDias: 25,
      plazoMaximoDias: 75,
    },
  });
  console.log('✓ 4 Servicios y 4 Reglas Comerciales configurados');

  // 8. ASESORES ACADÉMICOS
  console.log('8. Registrando asesores académicos...');
  const asesorSistemas = await prisma.asesor.create({
    data: {
      nombres: 'Dr. Juan Carlos',
      apellidos: 'Alva Paredes',
      especialidad: 'Ingeniería de Software, Inteligencia Artificial y Metodología Científica',
      gradoAcademico: 'DOCTOR',
      email: 'juan.alva@inbestiga.edu.pe',
      whatsapp: '51944112233',
      maxClientesSimultaneos: 8,
      clientesActivos: 2,
    },
  });

  const asesorMetodologa = await prisma.asesor.create({
    data: {
      nombres: 'Mg. Carmen Rosa',
      apellidos: 'Rodríguez Valdivia',
      especialidad: 'Bioestadística, SPSS, Epidemiología y Ciencias de la Salud',
      gradoAcademico: 'MAGISTER',
      email: 'carmen.rodriguez@inbestiga.edu.pe',
      whatsapp: '51955223344',
      maxClientesSimultaneos: 10,
      clientesActivos: 2,
    },
  });

  const asesorDerecho = await prisma.asesor.create({
    data: {
      nombres: 'Dr. Fernando',
      apellidos: 'Mendoza Morales',
      especialidad: 'Derecho Constitucional, Ciencias Políticas y Dogmática Jurídica',
      gradoAcademico: 'DOCTOR',
      email: 'fernando.mendoza@inbestiga.edu.pe',
      whatsapp: '51966334455',
      maxClientesSimultaneos: 6,
      clientesActivos: 0,
    },
  });

  const asesorNegocios = await prisma.asesor.create({
    data: {
      nombres: 'Mg. Patricia Elizabeth',
      apellidos: 'Gómez Díaz',
      especialidad: 'Gestión Financiera, Cadena de Suministro y Optimización Industrial',
      gradoAcademico: 'MAGISTER',
      email: 'patricia.gomez@inbestiga.edu.pe',
      whatsapp: '51977445566',
      maxClientesSimultaneos: 8,
      clientesActivos: 0,
    },
  });
  console.log('✓ 4 Asesores Académicos registrados');

  // 9. CONFIGURACIÓN DEL AGENTE IA
  console.log('9. Configurando agente comercial IA...');
  await prisma.configuracionAgente.create({
    data: {
      proveedorIA: 'GEMINI',
      modelo: 'gemini-1.5-flash',
      promptSistema: `Eres el Asesor Especialista Comercial y Metodológico de INBESTIGA.TESIS. Tu misión es guiar al estudiante de manera empática, rigurosa y resolutiva hacia la solución adecuada para su graduación.
REGLAS ESTRICTAS:
1. Saluda por su nombre y menciona los detalles específicos de su formulario (universidad, carrera y dificultad académica).
2. Comprende su dolor académico con empatía y formula preguntas de diagnóstico precisas.
3. No prometas aprobación mágica; promete rigor metodológico, acompañamiento continuo y cumplimiento normativo.
4. Para ofrecer propuestas comerciales y descuentos, invoca SIEMPRE calculate_offer.
5. Al concretar el acuerdo o al consultar medios de pago, genera la cotización mediante create_payment_request y proporciona EXCLUSIVAMENTE el enlace oficial de la pasarela Culqi (https://express.culqi.com/pago/1E696A426C), explicando que Culqi cuenta con una pasarela de pago que acepta diferentes tipos de pago (Yape directo, tarjetas de débito/crédito y PagoEfectivo). NUNCA des cuentas bancarias ni transferencias manuales.`,
      tono: 'Profesional, empático, académico, proactivo y resolutivo',
      estilo: 'Consultor sénior de investigación universitaria',
      permitirNegociacion: true,
      maxDescuentoNegociablePct: 15.0,
      maxCuotasNegociables: 3,
      horarioInicio: '08:00',
      horarioFin: '22:00',
      activo: true,
    },
  });
  console.log('✓ Configuración del Agente IA registrada');

  // ===========================================================================
  // 10. GENERACIÓN DE BUYERS / LEADS / PAYERS / CUSTOMERS (COHORTE SINTÉTICA)
  // ===========================================================================
  console.log('10. Generando cohorte sintética completa bajo las reglas del funnel IMPULSE...');

  // ---------------------------------------------------------------------------
  // [DEMO LEAD 1 - CANDIDATO PRINCIPAL PARA DEMOSTRACIÓN EN VIVO]
  // Estado: LEAD | Score: 94 | Sin pago | Sin customer | Perfil Completo
  // ---------------------------------------------------------------------------
  const demoAna = await prisma.buyer.create({
    data: {
      nombres: 'Ana Lucía',
      apellidos: 'Pérez Mendoza',
      whatsapp: '51949123456',
      email: 'ana.perez.unt@demo.inbestiga.test',
      universidadId: unt.id,
      carreraId: carSistemasUNT.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: '10mo ciclo',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2200.0,
      dolorPrincipal: 'Falta de tiempo laboral y el asesor universitario no responde ni valida el modelo predictivo',
      softwareRequerido: 'PYTHON',
      plazoDefinidoDias: 60,
      leadScore: 94,
      estadoFunnel: 'LEAD',
      consentimientoWhatsapp: true,
      fechaRegistro: new Date('2026-09-15T09:30:00Z'),
      fechaConversionLead: new Date('2026-09-15T09:35:00Z'),
    },
  });

  const leadAna = await prisma.lead.create({
    data: {
      buyerId: demoAna.id,
      scoreCalificado: 94,
      umbralSuperado: true,
      criterioCalificacion: JSON.stringify({
        perfilCompleto: 20,
        tipoInvestigacion: 15,
        plazoDefinido: 15,
        situacionLaboral: 10,
        dolorYSoftware: 14,
        consentimientoWhatsapp: 10,
        leadMagnetDescargado: 10,
        puntosTotales: 94,
      }),
      fechaCalificacion: new Date('2026-09-15T09:35:00Z'),
    },
  });

  await prisma.perfilNegociacion.create({
    data: {
      buyerId: demoAna.id,
      presupuestoEstimado: 2200.0,
      urgenciaNivel: 'ALTA',
      objecionPredominante: 'TIEMPO',
      scoreSensibilidadPrecio: 40,
      notas: 'Estudiante con proyecto avanzado al 30%. Necesita apoyo metodológico y código Python para sustentar en noviembre.',
    },
  });

  await prisma.formulario.create({
    data: {
      buyerId: demoAna.id,
      datosJson: JSON.stringify({
        nombres: 'Ana Lucía',
        apellidos: 'Pérez Mendoza',
        whatsapp: '51949123456',
        email: 'ana.perez.unt@demo.inbestiga.test',
        universidad: 'Universidad Nacional de Trujillo',
        carrera: 'Ingeniería de Sistemas',
        ciclo: '10mo ciclo',
        tipoInvestigacion: 'TESIS',
        situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
        presupuestoAprox: 2200,
        dolorPrincipal: 'Falta de tiempo laboral y el asesor universitario no responde ni valida el modelo predictivo',
        softwareRequerido: 'PYTHON',
        plazoDefinidoDias: 60,
      }),
      ip: '190.237.12.84',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  await prisma.interaccion.create({
    data: {
      buyerId: demoAna.id,
      tipo: 'DESCARGA_LEAD_MAGNET',
      detalle: 'Descarga de Guía Definitiva: Cómo plantear tu matriz de consistencia sin errores',
    },
  });

  await prisma.interaccion.create({
    data: {
      buyerId: demoAna.id,
      tipo: 'ENVIO_FORMULARIO',
      detalle: 'Registro completo desde formulario Meta Ads con Lead Score 94/100',
    },
  });

  await prisma.notificacion.create({
    data: {
      tipo: 'LEAD_CALIFICADO',
      titulo: '🔥 Lead Calificado Prioritario: Ana Lucía Pérez (UNT)',
      mensaje: 'Score: 94/100. Carrera: Ingeniería de Sistemas. Dolor: Falta de tiempo y asesor no responde. Lista para [INICIAR NEGOCIACIÓN].',
      metadata: JSON.stringify({ buyerId: demoAna.id, leadId: leadAna.id, score: 94 }),
      fechaCreacion: new Date('2026-09-15T09:36:00Z'),
    },
  });

  // ---------------------------------------------------------------------------
  // [DEMO LEAD 2 - CONVERSACIÓN CON OBJECIÓN DE PRECIO REGISTRADA]
  // Estado: LEAD | Score: 88 | Negociación en curso (Manejo de Objeciones)
  // ---------------------------------------------------------------------------
  const demoCarlos = await prisma.buyer.create({
    data: {
      nombres: 'Carlos Alberto',
      apellidos: 'Ruiz Salinas',
      whatsapp: '51948765432',
      email: 'cruiz.ind@demo.inbestiga.test',
      universidadId: ucv.id,
      carreraId: carIndustrialUCV.id,
      ubicacionId: ubiVictorLarco.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: 'EGRESADO',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 1800.0,
      dolorPrincipal: 'Dificultad con la propuesta de mejora en planta y análisis estadístico en SPSS',
      softwareRequerido: 'SPSS',
      plazoDefinidoDias: 45,
      leadScore: 88,
      estadoFunnel: 'LEAD',
      consentimientoWhatsapp: true,
      fechaRegistro: new Date('2026-09-14T11:00:00Z'),
      fechaConversionLead: new Date('2026-09-14T11:05:00Z'),
    },
  });

  const leadCarlos = await prisma.lead.create({
    data: {
      buyerId: demoCarlos.id,
      scoreCalificado: 88,
      umbralSuperado: true,
      criterioCalificacion: JSON.stringify({ perfilCompleto: 20, tipoInvestigacion: 15, plazoDefinido: 15, situacionLaboral: 10, puntosTotales: 88 }),
    },
  });

  await prisma.perfilNegociacion.create({
    data: {
      buyerId: demoCarlos.id,
      presupuestoEstimado: 1800.0,
      urgenciaNivel: 'MEDIA',
      objecionPredominante: 'PRECIO',
      scoreSensibilidadPrecio: 80,
      notas: 'Sensible al precio. Requiere facilidad en cuotas o descuento por pago inicial.',
    },
  });

  await prisma.formulario.create({
    data: {
      buyerId: demoCarlos.id,
      datosJson: JSON.stringify({ nombres: 'Carlos Alberto Ruiz', whatsapp: '51948765432', universidad: 'UCV', carrera: 'Ingeniería Industrial' }),
    },
  });

  await prisma.interaccion.create({
    data: { buyerId: demoCarlos.id, tipo: 'ENVIO_FORMULARIO', detalle: 'Formulario registrado con score 88' },
  });

  // Conversación iniciada y con objeción
  const convCarlos = await prisma.conversacion.create({
    data: {
      buyerId: demoCarlos.id,
      leadId: leadCarlos.id,
      canal: 'WHATSAPP',
      estadoEtapa: 'OBJECTION_HANDLING',
      fechaInicio: new Date('2026-09-14T11:10:00Z'),
      fechaUltimaActividad: new Date('2026-09-14T14:30:00Z'),
    },
  });

  await prisma.mensaje.create({
    data: {
      conversacionId: convCarlos.id,
      direccion: 'OUTGOING',
      remitente: 'AGENTE_IA',
      contenido: '¡Hola Carlos Alberto! Te saluda el Asesor Especialista de INBESTIGA.TESIS. Vi que eres egresado de Ingeniería Industrial en la UCV y buscas apoyo para tu tesis con análisis estadístico en SPSS. ¿Cómo te encuentras el día de hoy?',
      fechaHora: new Date('2026-09-14T11:10:05Z'),
    },
  });

  await prisma.mensaje.create({
    data: {
      conversacionId: convCarlos.id,
      direccion: 'INCOMING',
      remitente: 'CLIENTE',
      contenido: 'Hola estimado, gracias por contactarme. Sí, tengo los datos de tiempos y producción recolectados pero no sé qué prueba aplicar y el presupuesto que tengo es algo ajustado.',
      fechaHora: new Date('2026-09-14T11:15:00Z'),
    },
  });

  await prisma.diagnostico.create({
    data: {
      conversacionId: convCarlos.id,
      leadId: leadCarlos.id,
      temaInvestigacion: 'Mejora de la productividad mediante manufactura esbelta en planta agroindustrial',
      avanceActualPct: 40,
      principalesDificultades: 'Contrastación de hipótesis en SPSS y cálculo de OEE',
      resumenIA: 'Estudiante con base de datos real. Requiere asesoría integral con énfasis estadístico.',
    },
  });

  const propCarlos = await prisma.propuesta.create({
    data: {
      conversacionId: convCarlos.id,
      leadId: leadCarlos.id,
      servicioId: srvTesis.id,
      precioOriginal: 2200.0,
      precioPropuesto: 2000.0,
      descuentoAplicadoPct: 9.09,
      numeroCuotas: 2,
      montoPorCuota: 1000.0,
      plazoDias: 45,
      justificacion: 'Ajuste inicial por egresado con datos disponibles',
      estado: 'ENVIADA',
    },
  });

  await prisma.objecion.create({
    data: {
      conversacionId: convCarlos.id,
      leadId: leadCarlos.id,
      tipo: 'PRECIO',
      descripcion: 'El alumno comenta que 2 cuotas de S/ 1,000 se salen de su presupuesto disponible este mes.',
      respuestaAgente: 'El agente evaluará ampliar a 3 cuotas de S/ 650 bajo la regla comercial.',
      resuelta: false,
    },
  });

  await prisma.seguimiento.create({
    data: {
      conversacionId: convCarlos.id,
      leadId: leadCarlos.id,
      tipo: 'OFERTA_LIMITADA',
      fechaProgramada: new Date('2026-09-17T10:00:00Z'),
      estado: 'PENDIENTE',
    },
  });

  // ---------------------------------------------------------------------------
  // [DEMO LEAD 3 - LISTO PARA CIERRE Y COTIZACIÓN GENERADA]
  // Estado: LEAD | Score: 82 | Etapa: CLOSING / COTIZACIÓN ACTIVA
  // ---------------------------------------------------------------------------
  const demoValeria = await prisma.buyer.create({
    data: {
      nombres: 'Valeria Sofía',
      apellidos: 'Morales Castro',
      whatsapp: '51947112233',
      email: 'vmorales@demo.inbestiga.test',
      universidadId: upao.id,
      carreraId: carDerechoUPAO.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalGoogle.id,
      campanaId: campGoogleSearch.id,
      ciclo: 'BACHILLER',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'MEDIO_TIEMPO',
      presupuestoAprox: 2000.0,
      dolorPrincipal: 'Marco teórico dogmático y estructuración de la argumentación jurídica para la tesis',
      softwareRequerido: 'ATLAS_TI',
      plazoDefinidoDias: 40,
      leadScore: 82,
      estadoFunnel: 'LEAD',
      consentimientoWhatsapp: true,
      fechaRegistro: new Date('2026-09-13T16:20:00Z'),
      fechaConversionLead: new Date('2026-09-13T16:25:00Z'),
    },
  });

  const leadValeria = await prisma.lead.create({
    data: {
      buyerId: demoValeria.id,
      scoreCalificado: 82,
      umbralSuperado: true,
      criterioCalificacion: JSON.stringify({ perfilCompleto: 20, tipoInvestigacion: 15, plazoDefinido: 15, puntosTotales: 82 }),
    },
  });

  await prisma.perfilNegociacion.create({
    data: {
      buyerId: demoValeria.id,
      presupuestoEstimado: 2000.0,
      urgenciaNivel: 'ALTA',
      objecionPredominante: 'TIEMPO',
      scoreSensibilidadPrecio: 50,
    },
  });

  await prisma.formulario.create({
    data: {
      buyerId: demoValeria.id,
      datosJson: JSON.stringify({ nombres: 'Valeria Morales', universidad: 'UPAO', carrera: 'Derecho' }),
    },
  });

  const convValeria = await prisma.conversacion.create({
    data: {
      buyerId: demoValeria.id,
      leadId: leadValeria.id,
      canal: 'WHATSAPP',
      estadoEtapa: 'CLOSING',
      fechaInicio: new Date('2026-09-13T16:30:00Z'),
      fechaUltimaActividad: new Date('2026-09-14T09:00:00Z'),
    },
  });

  const propValeria = await prisma.propuesta.create({
    data: {
      conversacionId: convValeria.id,
      leadId: leadValeria.id,
      servicioId: srvTesis.id,
      precioOriginal: 2200.0,
      precioPropuesto: 1980.0,
      descuentoAplicadoPct: 10.0,
      numeroCuotas: 2,
      montoPorCuota: 990.0,
      plazoDias: 40,
      justificacion: 'Descuento del 10% por pronta confirmación en 2 partes',
      estado: 'ACEPTADA',
    },
  });

  const cotValeria = await prisma.cotizacion.create({
    data: {
      leadId: leadValeria.id,
      propuestaId: propValeria.id,
      servicioId: srvTesis.id,
      codigoCotizacion: 'COT-2026-0002',
      subtotal: 2200.0,
      descuento: 220.0,
      total: 1980.0,
      cuotas: 2,
      plazoEntregaDias: 40,
      fechaEmision: new Date('2026-09-14'),
      fechaExpiracion: new Date('2026-09-21'),
      estado: 'ACTIVA',
    },
  });

  // ---------------------------------------------------------------------------
  // RESTO DE LA COHORTE SINTÉTICA
  // ---------------------------------------------------------------------------

  // A) OTROS LEADS (Score >= 70)
  const cohortLeadsData = [
    {
      nombres: 'Diego Armando',
      apellidos: 'García Polo',
      whatsapp: '51945112244',
      email: 'dgarcia@demo.inbestiga.test',
      universidadId: uni.id,
      carreraId: carSistemasUNI.id,
      ubicacionId: ubiLimaLosOlivos.id,
      canalId: canalTiktok.id,
      campanaId: campTiktokFlash.id,
      ciclo: '10mo ciclo',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2400.0,
      dolorPrincipal: 'Metodología ágil y redacción formal bajo normas IEEE',
      softwareRequerido: 'PYTHON',
      plazoDefinidoDias: 50,
      score: 91,
    },
    {
      nombres: 'Fiorella Belén',
      apellidos: 'Herrera Cruz',
      whatsapp: '51943223355',
      email: 'fherrera@demo.inbestiga.test',
      universidadId: pucp.id,
      carreraId: carIndustrialPUCP.id,
      ubicacionId: ubiLimaSanIsidro.id,
      canalId: canalGoogle.id,
      campanaId: campGoogleSearch.id,
      ciclo: 'EGRESADO',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2500.0,
      dolorPrincipal: 'Validación estadística con Minitab y formulación de objetivos específicos',
      softwareRequerido: 'MINITAB',
      plazoDefinidoDias: 60,
      score: 89,
    },
    {
      nombres: 'Jorge Luis',
      apellidos: 'Chávez Rivas',
      whatsapp: '51942334466',
      email: 'jchavez@demo.inbestiga.test',
      universidadId: unmsm.id,
      carreraId: carEconomiaUNMSM.id,
      ubicacionId: ubiLimaSanIsidro.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: 'BACHILLER',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'MEDIO_TIEMPO',
      presupuestoAprox: 1900.0,
      dolorPrincipal: 'Modelos econométricos en Stata y series de tiempo',
      softwareRequerido: 'STATA',
      plazoDefinidoDias: 70,
      score: 84,
    },
    {
      nombres: 'Claudia Vanessa',
      apellidos: 'Salazar Benites',
      whatsapp: '51941445577',
      email: 'csalazar@demo.inbestiga.test',
      universidadId: ucv.id,
      carreraId: carPsicologiaUCV.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalTiktok.id,
      campanaId: campTiktokFlash.id,
      ciclo: '10mo ciclo',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 1500.0,
      dolorPrincipal: 'Análisis psicométrico, confiabilidad alfa de Cronbach y omega de McDonald',
      softwareRequerido: 'SPSS',
      plazoDefinidoDias: 60,
      score: 78,
    },
    {
      nombres: 'Guillermo Manuel',
      apellidos: 'Vargas Silva',
      whatsapp: '51940556688',
      email: 'gvargas@demo.inbestiga.test',
      universidadId: unt.id,
      carreraId: carContabilidadUNT.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalOrganico.id,
      campanaId: campOrganica.id,
      ciclo: '9no ciclo',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'MEDIO_TIEMPO',
      presupuestoAprox: 1200.0,
      dolorPrincipal: 'Elaboración y delimitación del plan de tesis sobre auditoría tributaria',
      softwareRequerido: 'EXCEL',
      plazoDefinidoDias: 45,
      score: 75,
    },
    {
      nombres: 'Luciana Milagros',
      apellidos: 'Paz Soldán',
      whatsapp: '51939667799',
      email: 'lpaz@demo.inbestiga.test',
      universidadId: upao.id,
      carreraId: carMedicinaUPAO.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: 'INTERNO',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2300.0,
      dolorPrincipal: 'Tiempo cero por guardias médicas y asesor exige bioestadística inferencial',
      softwareRequerido: 'SPSS',
      plazoDefinidoDias: 40,
      score: 93,
    },
    {
      nombres: 'Renato Alonso',
      apellidos: 'Ríos Paredes',
      whatsapp: '51938778800',
      email: 'rrios@demo.inbestiga.test',
      universidadId: ucv.id,
      carreraId: carCivilUCV.id,
      ubicacionId: ubiChiclayo.id,
      canalId: canalReferido.id,
      campanaId: campTesis2026.id,
      ciclo: 'EGRESADO',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2100.0,
      dolorPrincipal: 'Cálculo estructural en SAP2000 y redacción de la discusión',
      softwareRequerido: 'SAP2000',
      plazoDefinidoDias: 50,
      score: 86,
    },
    {
      nombres: 'Estefany Rocío',
      apellidos: 'Vega Quispe',
      whatsapp: '51937889911',
      email: 'evega@demo.inbestiga.test',
      universidadId: unt.id,
      carreraId: carEnfermeriaUNT.id,
      ubicacionId: ubiHuanchaco.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: '10mo ciclo',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'MEDIO_TIEMPO',
      presupuestoAprox: 1100.0,
      dolorPrincipal: 'Aprobación del comité de ética y justificación teórica',
      plazoDefinidoDias: 60,
      score: 74,
    },
    {
      nombres: 'Alonso Gabriel',
      apellidos: 'Bravo Carranza',
      whatsapp: '51936990022',
      email: 'abravo@demo.inbestiga.test',
      universidadId: pucp.id,
      carreraId: carDerechoUPAO.id, // area DERECHO
      ubicacionId: ubiLimaSanIsidro.id,
      canalId: canalOrganico.id,
      campanaId: campOrganica.id,
      ciclo: 'MAESTRIA',
      tipoInvestigacion: 'ARTICULO_CIENTIFICO',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 1700.0,
      dolorPrincipal: 'Adaptación a guía de autores de revista Scopus Q2',
      plazoDefinidoDias: 45,
      score: 87,
    },
  ];

  for (const item of cohortLeadsData) {
    const buyerCreated = await prisma.buyer.create({
      data: {
        nombres: item.nombres,
        apellidos: item.apellidos,
        whatsapp: item.whatsapp,
        email: item.email,
        universidadId: item.universidadId,
        carreraId: item.carreraId,
        ubicacionId: item.ubicacionId,
        canalId: item.canalId,
        campanaId: item.campanaId,
        ciclo: item.ciclo,
        tipoInvestigacion: item.tipoInvestigacion,
        situacionLaboral: item.situacionLaboral,
        presupuestoAprox: item.presupuestoAprox,
        dolorPrincipal: item.dolorPrincipal,
        softwareRequerido: item.softwareRequerido,
        plazoDefinidoDias: item.plazoDefinidoDias,
        leadScore: item.score,
        estadoFunnel: 'LEAD',
        consentimientoWhatsapp: true,
        fechaRegistro: new Date('2026-09-12T10:00:00Z'),
        fechaConversionLead: new Date('2026-09-12T10:05:00Z'),
      },
    });

    const leadCreated = await prisma.lead.create({
      data: {
        buyerId: buyerCreated.id,
        scoreCalificado: item.score,
        umbralSuperado: true,
        criterioCalificacion: JSON.stringify({ perfilCompleto: 20, tipoInvestigacion: 15, plazoDefinido: 15, puntosTotales: item.score }),
      },
    });

    await prisma.formulario.create({
      data: {
        buyerId: buyerCreated.id,
        datosJson: JSON.stringify(item),
      },
    });

    await prisma.interaccion.create({
      data: {
        buyerId: buyerCreated.id,
        tipo: 'ENVIO_FORMULARIO',
        detalle: `Formulario registrado con score ${item.score}`,
      },
    });

    await prisma.perfilNegociacion.create({
      data: {
        buyerId: buyerCreated.id,
        presupuestoEstimado: item.presupuestoAprox,
        urgenciaNivel: item.score > 85 ? 'ALTA' : 'MEDIA',
        objecionPredominante: item.score > 85 ? 'TIEMPO' : 'PRECIO',
        scoreSensibilidadPrecio: 60,
      },
    });
  }

  // B) BUYERS NO CALIFICADOS (Score < 70) -> Quedan en estado BUYER
  const cohortBuyersData = [
    {
      nombres: 'Pedro Miguel',
      apellidos: 'Soto Vargas',
      whatsapp: '51921001122',
      email: 'psoto@demo.inbestiga.test',
      universidadId: upao.id,
      carreraId: carDerechoUPAO.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalOrganico.id,
      campanaId: campOrganica.id,
      ciclo: '8vo ciclo',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 600.0,
      dolorPrincipal: 'Curiosidad inicial sobre cómo elegir un tema para el próximo año',
      score: 58,
    },
    {
      nombres: 'Karla Jimena',
      apellidos: 'Mendoza León',
      whatsapp: '51922112233',
      email: 'kmendoza@demo.inbestiga.test',
      universidadId: ucv.id,
      carreraId: carIndustrialUCV.id,
      ubicacionId: ubiVictorLarco.id,
      canalId: canalTiktok.id,
      campanaId: campTiktokFlash.id,
      ciclo: '7mo ciclo',
      tipoInvestigacion: 'TESINA',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 500.0,
      dolorPrincipal: 'Duda con el formato de informe de prácticas',
      score: 42,
    },
    {
      nombres: 'Christian Paul',
      apellidos: 'Navarro Rojas',
      whatsapp: '51923223344',
      email: 'cnavarro@demo.inbestiga.test',
      universidadId: unt.id,
      carreraId: carSistemasUNT.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: '8vo ciclo',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 800.0,
      dolorPrincipal: 'Aún no tiene asesor asignado en la universidad',
      score: 62,
    },
    {
      nombres: 'Brenda Lucía',
      apellidos: 'Flores Terrones',
      whatsapp: '51924334455',
      email: 'bflores@demo.inbestiga.test',
      universidadId: pucp.id,
      carreraId: carIndustrialPUCP.id,
      ubicacionId: ubiLimaSanIsidro.id,
      canalId: canalGoogle.id,
      campanaId: campGoogleSearch.id,
      ciclo: '8vo ciclo',
      tipoInvestigacion: 'TESINA',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 750.0,
      dolorPrincipal: 'Consulta preliminar sobre costos',
      score: 50,
    },
    {
      nombres: 'Gonzalo David',
      apellidos: 'Iparraguirre Cruz',
      whatsapp: '51925445566',
      email: 'giparraguirre@demo.inbestiga.test',
      universidadId: unmsm.id,
      carreraId: carEconomiaUNMSM.id,
      ubicacionId: ubiLimaLosOlivos.id,
      canalId: canalOrganico.id,
      campanaId: campOrganica.id,
      ciclo: '7mo ciclo',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 500.0,
      dolorPrincipal: 'Descargó plantilla de consistencia',
      score: 45,
    },
    {
      nombres: 'Diana Carolina',
      apellidos: 'Zapata Morales',
      whatsapp: '51926556677',
      email: 'dzapata@demo.inbestiga.test',
      universidadId: upao.id,
      carreraId: carAdminUPAO.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: '8vo ciclo',
      tipoInvestigacion: 'TESINA',
      situacionLaboral: 'MEDIO_TIEMPO',
      presupuestoAprox: 700.0,
      dolorPrincipal: 'Pregunta general sobre asesorías grupales',
      score: 55,
    },
    {
      nombres: 'Martín Eduardo',
      apellidos: 'Cabrera Ortiz',
      whatsapp: '51927667788',
      email: 'mcabrera@demo.inbestiga.test',
      universidadId: unt.id,
      carreraId: carContabilidadUNT.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalTiktok.id,
      campanaId: campTiktokFlash.id,
      ciclo: '7mo ciclo',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 400.0,
      dolorPrincipal: 'Descargó ebook de normas APA',
      score: 38,
    },
    {
      nombres: 'Vanessa Stephanie',
      apellidos: 'Guerrero Luján',
      whatsapp: '51928778899',
      email: 'vguerrero@demo.inbestiga.test',
      universidadId: ucv.id,
      carreraId: carPsicologiaUCV.id,
      ubicacionId: ubiArequipa.id,
      canalId: canalOrganico.id,
      campanaId: campOrganica.id,
      ciclo: '8vo ciclo',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'MEDIO_TIEMPO',
      presupuestoAprox: 850.0,
      dolorPrincipal: 'Dificultad inicial para seleccionar escalas',
      score: 64,
    },
    {
      nombres: 'José Fernando',
      apellidos: 'Peralta Tapia',
      whatsapp: '51929889900',
      email: 'jperalta@demo.inbestiga.test',
      universidadId: uni.id,
      carreraId: carSistemasUNI.id,
      ubicacionId: ubiLimaLosOlivos.id,
      canalId: canalGoogle.id,
      campanaId: campGoogleSearch.id,
      ciclo: '8vo ciclo',
      tipoInvestigacion: 'TESINA',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 600.0,
      dolorPrincipal: 'Orientación para proyecto de curso',
      score: 48,
    },
    {
      nombres: 'Silvia Cristina',
      apellidos: 'Reyes Sandoval',
      whatsapp: '51930990011',
      email: 'sreyes@demo.inbestiga.test',
      universidadId: unt.id,
      carreraId: carEnfermeriaUNT.id,
      ubicacionId: ubiHuanchaco.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: '8vo ciclo',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'SOLO_ESTUDIA',
      presupuestoAprox: 700.0,
      dolorPrincipal: 'Interés en cursos extracurriculares',
      score: 52,
    },
  ];

  for (const item of cohortBuyersData) {
    const b = await prisma.buyer.create({
      data: {
        nombres: item.nombres,
        apellidos: item.apellidos,
        whatsapp: item.whatsapp,
        email: item.email,
        universidadId: item.universidadId,
        carreraId: item.carreraId,
        ubicacionId: item.ubicacionId,
        canalId: item.canalId,
        campanaId: item.campanaId,
        ciclo: item.ciclo,
        tipoInvestigacion: item.tipoInvestigacion,
        situacionLaboral: item.situacionLaboral,
        presupuestoAprox: item.presupuestoAprox,
        dolorPrincipal: item.dolorPrincipal,
        leadScore: item.score,
        estadoFunnel: 'BUYER', // Respeto estricto de la regla: Score < 70 -> BUYER
        consentimientoWhatsapp: true,
        fechaRegistro: new Date('2026-09-10T14:00:00Z'),
      },
    });

    await prisma.formulario.create({
      data: {
        buyerId: b.id,
        datosJson: JSON.stringify(item),
      },
    });

    await prisma.interaccion.create({
      data: {
        buyerId: b.id,
        tipo: 'ENVIO_FORMULARIO',
        detalle: `Envío de formulario con score ${item.score} (no superó umbral)`,
      },
    });
  }

  // C) PAYERS (Pagos confirmados, etapa previa a asignación de asesor)
  const cohortPayersData = [
    {
      nombres: 'César Augusto',
      apellidos: 'Villarreal Benítez',
      whatsapp: '51911112233',
      email: 'cvillarreal@demo.inbestiga.test',
      universidadId: unt.id,
      carreraId: carSistemasUNT.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: '10mo ciclo',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2200.0,
      score: 91,
      montoPagado: 1980.0,
      cuotas: 1,
      metodo: 'CARD',
      gateway: 'STRIPE',
      txId: 'pi_test_3N82bX2eZvKYlo2C1g9aPayer1',
      servicioId: srvTesis.id,
      codigoCot: 'COT-2026-0003',
    },
    {
      nombres: 'Katherine Gisell',
      apellidos: 'Palacios Montoya',
      whatsapp: '51912223344',
      email: 'kpalacios@demo.inbestiga.test',
      universidadId: ucv.id,
      carreraId: carIndustrialUCV.id,
      ubicacionId: ubiVictorLarco.id,
      canalId: canalTiktok.id,
      campanaId: campTiktokFlash.id,
      ciclo: 'EGRESADO',
      tipoInvestigacion: 'PLAN_DE_TESIS',
      situacionLaboral: 'MEDIO_TIEMPO',
      presupuestoAprox: 1200.0,
      score: 83,
      montoPagado: 1080.0,
      cuotas: 1,
      metodo: 'YAPE',
      gateway: 'CULQI',
      txId: 'yape_trx_9481284718_payer2',
      servicioId: srvPlan.id,
      codigoCot: 'COT-2026-0004',
    },
    {
      nombres: 'Rodrigo Javier',
      apellidos: 'Lecca Santillán',
      whatsapp: '51913334455',
      email: 'rlecca@demo.inbestiga.test',
      universidadId: upao.id,
      carreraId: carDerechoUPAO.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalGoogle.id,
      campanaId: campGoogleSearch.id,
      ciclo: 'BACHILLER',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2200.0,
      score: 87,
      montoPagado: 1000.0, // 1era de 2 cuotas
      cuotas: 2,
      metodo: 'TRANSFER',
      gateway: 'STRIPE',
      txId: 'bcp_transf_4819283_payer3',
      servicioId: srvTesis.id,
      codigoCot: 'COT-2026-0005',
    },
    {
      nombres: 'Miriam Elizabeth',
      apellidos: 'Chirinos Saavedra',
      whatsapp: '51914445566',
      email: 'mchirinos@demo.inbestiga.test',
      universidadId: unmsm.id,
      carreraId: carEconomiaUNMSM.id,
      ubicacionId: ubiLimaSanIsidro.id,
      canalId: canalOrganico.id,
      campanaId: campOrganica.id,
      ciclo: 'EGRESADO',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 850.0,
      score: 85,
      montoPagado: 765.0,
      cuotas: 1,
      metodo: 'CARD',
      gateway: 'STRIPE',
      txId: 'pi_test_3N82bX2eZvKYlo2C1g9aPayer4',
      servicioId: srvEstadistica.id,
      codigoCot: 'COT-2026-0006',
    },
  ];

  for (const item of cohortPayersData) {
    const b = await prisma.buyer.create({
      data: {
        nombres: item.nombres,
        apellidos: item.apellidos,
        whatsapp: item.whatsapp,
        email: item.email,
        universidadId: item.universidadId,
        carreraId: item.carreraId,
        ubicacionId: item.ubicacionId,
        canalId: item.canalId,
        campanaId: item.campanaId,
        ciclo: item.ciclo,
        tipoInvestigacion: item.tipoInvestigacion,
        situacionLaboral: item.situacionLaboral,
        presupuestoAprox: item.presupuestoAprox,
        leadScore: item.score,
        estadoFunnel: 'PAYER', // Regla funnel: PAYER
        consentimientoWhatsapp: true,
        fechaRegistro: new Date('2026-09-08T09:00:00Z'),
        fechaConversionLead: new Date('2026-09-08T09:05:00Z'),
      },
    });

    const l = await prisma.lead.create({
      data: {
        buyerId: b.id,
        scoreCalificado: item.score,
        umbralSuperado: true,
        criterioCalificacion: JSON.stringify({ score: item.score }),
      },
    });

    await prisma.formulario.create({
      data: { buyerId: b.id, datosJson: JSON.stringify(item) },
    });

    const cot = await prisma.cotizacion.create({
      data: {
        leadId: l.id,
        servicioId: item.servicioId,
        codigoCotizacion: item.codigoCot,
        subtotal: item.montoPagado,
        descuento: 0,
        total: item.montoPagado,
        cuotas: item.cuotas,
        plazoEntregaDias: 45,
        fechaEmision: new Date('2026-09-08'),
        fechaExpiracion: new Date('2026-09-15'),
        estado: 'ACEPTADA',
      },
    });

    const pag = await prisma.pago.create({
      data: {
        cotizacionId: cot.id,
        buyerId: b.id,
        leadId: l.id,
        gatewayProveedor: item.gateway,
        gatewayTransactionId: item.txId,
        monto: item.montoPagado,
        moneda: 'PEN',
        metodoPago: item.metodo,
        estado: 'CONFIRMADO',
        fechaCreacion: new Date('2026-09-09T10:00:00Z'),
        fechaConfirmacion: new Date('2026-09-09T10:01:00Z'),
        gatewayPayload: JSON.stringify({ status: 'succeeded', id: item.txId }),
      },
    });

    await prisma.payer.create({
      data: {
        buyerId: b.id,
        leadId: l.id,
        primerPagoId: pag.id,
        montoTotalPagado: item.montoPagado,
        metodoPrincipal: item.metodo,
        fechaConversionPayer: new Date('2026-09-09T10:01:00Z'),
        estado: 'ACTIVO',
      },
    });

    await prisma.notificacion.create({
      data: {
        tipo: 'PAGO_CONFIRMADO',
        titulo: `Pago Confirmado: S/ ${item.montoPagado} de ${item.nombres} ${item.apellidos}`,
        mensaje: `Método: ${item.metodo} (${item.gateway}). Cotización: ${item.codigoCot}. Estado de Funnel: PAYER.`,
        fechaCreacion: new Date('2026-09-09T10:02:00Z'),
      },
    });
  }

  // D) CUSTOMERS (Servicio activo, asesor asignado y sesiones programadas/realizadas)
  const cohortCustomersData = [
    {
      nombres: 'María Elena',
      apellidos: 'Castillo Vega',
      whatsapp: '51901112233',
      email: 'mcastillo@demo.inbestiga.test',
      universidadId: unmsm.id,
      carreraId: carMedicinaUNMSM.id,
      ubicacionId: ubiLimaSanIsidro.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: 'BACHILLER',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'MEDIO_TIEMPO',
      presupuestoAprox: 2200.0,
      score: 95,
      montoPagado: 1980.0,
      metodo: 'CARD',
      gateway: 'STRIPE',
      txId: 'pi_test_maria_customer1',
      servicioId: srvTesis.id,
      asesorId: asesorMetodologa.id,
      codigoCot: 'COT-2026-0007',
      temaInvestigacion: 'Prevalencia de factores de riesgo cardiovascular en pacientes post-COVID',
      observaciones: 'Datos clínicos recolectados. Requiere análisis inferencial en SPSS y redacción APA 7.',
    },
    {
      nombres: 'Álvaro Sebastián',
      apellidos: 'Gutiérrez Cerna',
      whatsapp: '51902223344',
      email: 'agutierrez@demo.inbestiga.test',
      universidadId: unt.id,
      carreraId: carSistemasUNT.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalMeta.id,
      campanaId: campTesis2026.id,
      ciclo: '10mo ciclo',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2200.0,
      score: 92,
      montoPagado: 1980.0,
      metodo: 'CARD',
      gateway: 'STRIPE',
      txId: 'pi_test_alvaro_customer2',
      servicioId: srvTesis.id,
      asesorId: asesorSistemas.id,
      codigoCot: 'COT-2026-0008',
      temaInvestigacion: 'Arquitectura de microservicios con NestJS y Docker para optimización hospitalaria',
      observaciones: 'Estudiante con tesis aprobada al 50%. Se coordina avance con Dr. Alva.',
    },
    {
      nombres: 'Gabriela Alejandra',
      apellidos: 'Paz Soldán Núñez',
      whatsapp: '51903334455',
      email: 'gpaz@demo.inbestiga.test',
      universidadId: upao.id,
      carreraId: carMedicinaUPAO.id,
      ubicacionId: ubiTrujillo.id,
      canalId: canalGoogle.id,
      campanaId: campGoogleSearch.id,
      ciclo: 'INTERNO',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2200.0,
      score: 94,
      montoPagado: 1980.0,
      metodo: 'YAPE',
      gateway: 'CULQI',
      txId: 'yape_trx_gabriela_customer3',
      servicioId: srvTesis.id,
      asesorId: asesorMetodologa.id,
      codigoCot: 'COT-2026-0009',
      temaInvestigacion: 'Biomarcadores de respuesta inflamatoria en pacientes pediátricos',
      observaciones: 'Se realizó primera sesión de depuración de variables.',
    },
    {
      nombres: 'Marco Antonio',
      apellidos: 'Bocanegra Tirado',
      whatsapp: '51904445566',
      email: 'mbocanegra@demo.inbestiga.test',
      universidadId: uni.id,
      carreraId: carSistemasUNI.id,
      ubicacionId: ubiLimaLosOlivos.id,
      canalId: canalTiktok.id,
      campanaId: campTiktokFlash.id,
      ciclo: 'EGRESADO',
      tipoInvestigacion: 'TESIS',
      situacionLaboral: 'TRABAJA_TIEMPO_COMPLETO',
      presupuestoAprox: 2200.0,
      score: 90,
      montoPagado: 1980.0,
      metodo: 'TRANSFER',
      gateway: 'STRIPE',
      txId: 'bcp_transf_marco_customer4',
      servicioId: srvTesis.id,
      asesorId: asesorSistemas.id,
      codigoCot: 'COT-2026-0010',
      temaInvestigacion: 'Algoritmos de aprendizaje profundo para detección de fallas en redes eléctricas',
      observaciones: 'En redacción de resultados y discusión.',
    },
  ];

  for (const item of cohortCustomersData) {
    const b = await prisma.buyer.create({
      data: {
        nombres: item.nombres,
        apellidos: item.apellidos,
        whatsapp: item.whatsapp,
        email: item.email,
        universidadId: item.universidadId,
        carreraId: item.carreraId,
        ubicacionId: item.ubicacionId,
        canalId: item.canalId,
        campanaId: item.campanaId,
        ciclo: item.ciclo,
        tipoInvestigacion: item.tipoInvestigacion,
        situacionLaboral: item.situacionLaboral,
        presupuestoAprox: item.presupuestoAprox,
        leadScore: item.score,
        estadoFunnel: 'CUSTOMER', // Regla funnel: CUSTOMER
        consentimientoWhatsapp: true,
        fechaRegistro: new Date('2026-09-01T08:00:00Z'),
        fechaConversionLead: new Date('2026-09-01T08:05:00Z'),
      },
    });

    const l = await prisma.lead.create({
      data: {
        buyerId: b.id,
        scoreCalificado: item.score,
        umbralSuperado: true,
        criterioCalificacion: JSON.stringify({ score: item.score }),
      },
    });

    await prisma.formulario.create({
      data: { buyerId: b.id, datosJson: JSON.stringify(item) },
    });

    const cot = await prisma.cotizacion.create({
      data: {
        leadId: l.id,
        servicioId: item.servicioId,
        codigoCotizacion: item.codigoCot,
        subtotal: 2200.0,
        descuento: 220.0,
        total: item.montoPagado,
        cuotas: 1,
        plazoEntregaDias: 45,
        fechaEmision: new Date('2026-09-02'),
        fechaExpiracion: new Date('2026-09-09'),
        estado: 'ACEPTADA',
      },
    });

    const pag = await prisma.pago.create({
      data: {
        cotizacionId: cot.id,
        buyerId: b.id,
        leadId: l.id,
        gatewayProveedor: item.gateway,
        gatewayTransactionId: item.txId,
        monto: item.montoPagado,
        moneda: 'PEN',
        metodoPago: item.metodo,
        estado: 'CONFIRMADO',
        fechaCreacion: new Date('2026-09-03T10:00:00Z'),
        fechaConfirmacion: new Date('2026-09-03T10:01:00Z'),
        gatewayPayload: JSON.stringify({ status: 'succeeded' }),
      },
    });

    const payer = await prisma.payer.create({
      data: {
        buyerId: b.id,
        leadId: l.id,
        primerPagoId: pag.id,
        montoTotalPagado: item.montoPagado,
        metodoPrincipal: item.metodo,
        fechaConversionPayer: new Date('2026-09-03T10:01:00Z'),
        estado: 'ACTIVO',
      },
    });

    const customer = await prisma.customer.create({
      data: {
        buyerId: b.id,
        leadId: l.id,
        payerId: payer.id,
        cotizacionId: cot.id,
        servicioId: item.servicioId,
        asesorId: item.asesorId,
        fechaInicioServicio: new Date('2026-09-04T09:00:00Z'),
        estadoServicio: 'EN_CURSO',
        observaciones: item.observaciones,
      },
    });

    await prisma.asignacionAsesor.create({
      data: {
        customerId: customer.id,
        asesorId: item.asesorId,
        fechaAsignacion: new Date('2026-09-04T09:00:00Z'),
        motivo: 'Asignación por afinidad de especialidad temática',
        asignadoPor: 'ADMIN',
        activo: true,
      },
    });

    // Sesión 1: Realizada
    await prisma.sesion.create({
      data: {
        customerId: customer.id,
        asesorId: item.asesorId,
        numeroSesion: 1,
        fechaHoraProgramada: new Date('2026-09-06T10:00:00Z'),
        fechaHoraRealizada: new Date('2026-09-06T11:15:00Z'),
        temaTratado: `Revisión inicial del tema: ${item.temaInvestigacion} y definición de cronograma`,
        estado: 'REALIZADA',
        enlaceReunion: 'https://meet.google.com/inbestiga-sesion-01',
        observaciones: 'Se acordaron entregables para la semana siguiente.',
      },
    });

    // Sesión 2: Programada
    await prisma.sesion.create({
      data: {
        customerId: customer.id,
        asesorId: item.asesorId,
        numeroSesion: 2,
        fechaHoraProgramada: new Date('2026-09-22T16:00:00Z'),
        temaTratado: 'Revisión del capítulo de metodología, instrumentos y contrastación estadística',
        estado: 'PROGRAMADA',
        enlaceReunion: 'https://meet.google.com/inbestiga-sesion-02',
      },
    });

    await prisma.notificacion.create({
      data: {
        tipo: 'SESION_PROGRAMADA',
        titulo: `Sesión #2 Programada para ${item.nombres} ${item.apellidos}`,
        mensaje: 'Fecha: 22 de Septiembre a las 16:00. Asesor asignado presente.',
        fechaCreacion: new Date('2026-09-07T12:00:00Z'),
      },
    });
  }

  console.log('✓ Cohorte sintética registrada con éxito.');
  console.log('================================================================');
  console.log('--- RESUMEN FINAL DEL SEED (FUNNEL IMPULSE) ---');
  console.log('Total BUYERS registrados:       30');
  console.log('  - En estado BUYER (Score < 70): 10');
  console.log('  - En estado LEAD (Score >= 70): 12 (Incluyendo 3 Demo Leads)');
  console.log('  - En estado PAYER (Score >= 70): 4 (Pagos confirmados)');
  console.log('  - En estado CUSTOMER (Score >= 70): 4 (En asesoría con sesiones)');
  console.log('Total LEADS totales en BD:      20 (12 Leads + 4 Payers + 4 Customers)');
  console.log('Total PAYERS en BD:              8 (4 Payers + 4 Customers)');
  console.log('Total CUSTOMERS en BD:           4');
  console.log('Total SESIONES en BD:            8 (4 Realizadas + 4 Programadas)');
  console.log('Total PAGOS confirmados:         8');
  console.log('================================================================');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
