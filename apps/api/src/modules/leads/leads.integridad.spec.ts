import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validarTransicion } from './domain/oportunidad-estados';
import { OportunidadesService } from './oportunidades/oportunidades.service';
import { PropuestasService } from './propuestas/propuestas.service';
import { crearFakePrisma } from './testing/fake-prisma';

const ADMIN = { tipo: 'ADMIN' as const, id: 'u-admin' };
const ESTUDIANTE = { tipo: 'ESTUDIANTE' as const };

function montar() {
  const prisma = crearFakePrisma();
  prisma._db.lead.push({ id: 'lead-1', buyerId: 'buyer-1' }, { id: 'lead-2', buyerId: 'buyer-2' });
  prisma._db.servicio.push({
    id: 'srv-1',
    activo: true,
    precioBase: new Prisma.Decimal(2200),
    precioMinimo: new Prisma.Decimal(1870),
    precioMaximo: new Prisma.Decimal(2600),
    maxCuotas: 4,
  });
  const oportunidades = new OportunidadesService(prisma);
  const propuestas = new PropuestasService(prisma, oportunidades);
  return { prisma, oportunidades, propuestas };
}

/** Lleva una oportunidad nueva hasta APTA_PARA_COTIZAR por transiciones manuales autorizadas. */
async function oportunidadApta(ctx: ReturnType<typeof montar>, buyerId = 'buyer-1') {
  const { oportunidad } = await ctx.oportunidades.abrirParaBuyer(buyerId, ADMIN);
  await ctx.oportunidades.transicionar(oportunidad.id, 'EN_DIAGNOSTICO', ADMIN);
  await ctx.oportunidades.transicionar(oportunidad.id, 'APTA_PARA_COTIZAR', ADMIN);
  return oportunidad.id as string;
}

describe('Contrato de estados (informe Tabla 6)', () => {
  it('permite el camino manual ABIERTA → EN_DIAGNOSTICO → APTA_PARA_COTIZAR', () => {
    expect(validarTransicion('ABIERTA', 'EN_DIAGNOSTICO', 'MANUAL')).toBeNull();
    expect(validarTransicion('EN_DIAGNOSTICO', 'APTA_PARA_COTIZAR', 'MANUAL')).toBeNull();
  });

  it('no permite saltar etapas ni forzar manualmente estados que nacen de un evento', () => {
    expect(validarTransicion('ABIERTA', 'APTA_PARA_COTIZAR', 'MANUAL')).toMatch(/no permitida/);
    expect(validarTransicion('APTA_PARA_COTIZAR', 'EN_NEGOCIACION', 'MANUAL')).toMatch(/evento/);
    expect(validarTransicion('EN_NEGOCIACION', 'ACEPTADA', 'MANUAL')).toMatch(/evento/);
    expect(validarTransicion('ACEPTADA', 'PAYER_CONFIRMADO', 'EVENTO')).toMatch(/no permitida/); // propuesta → PAYER sin transferencia
  });

  it('una oportunidad cerrada no se reabre', () => {
    expect(validarTransicion('DESCARTADA', 'ABIERTA', 'MANUAL')).toMatch(/cerrada/);
    expect(validarTransicion('PAYER_CONFIRMADO', 'EN_NEGOCIACION', 'EVENTO')).toMatch(/cerrada/);
  });
});

describe('Oportunidad repetida', () => {
  it('abrir dos veces para el mismo BUYER devuelve la misma oportunidad abierta', async () => {
    const ctx = montar();
    const a = await ctx.oportunidades.abrirParaBuyer('buyer-1', ADMIN);
    const b = await ctx.oportunidades.abrirParaBuyer('buyer-1', ADMIN);
    expect(a.creada).toBe(true);
    expect(b.creada).toBe(false);
    expect(b.oportunidad.id).toBe(a.oportunidad.id);
    expect(ctx.prisma._db.oportunidadComercial).toHaveLength(1);
  });

  it('dos aperturas simultáneas producen UNA sola oportunidad (el índice único resuelve la carrera)', async () => {
    const ctx = montar();
    const [a, b] = await Promise.all([ctx.oportunidades.abrirParaLead('lead-1', ADMIN), ctx.oportunidades.abrirParaLead('lead-1', ADMIN)]);
    expect(a.oportunidad.id).toBe(b.oportunidad.id);
    expect(ctx.prisma._db.oportunidadComercial).toHaveLength(1);
  });

  it('tras descartar, se abre un NUEVO ciclo; el anterior queda cerrado e intacto', async () => {
    const ctx = montar();
    const { oportunidad: primera } = await ctx.oportunidades.abrirParaBuyer('buyer-1', ADMIN);
    await ctx.oportunidades.transicionar(primera.id, 'DESCARTADA', ADMIN, 'Sin presupuesto este ciclo');
    const { oportunidad: segunda, creada } = await ctx.oportunidades.abrirParaBuyer('buyer-1', ADMIN);

    expect(creada).toBe(true);
    expect(segunda.id).not.toBe(primera.id);
    const cerrada = ctx.prisma._db.oportunidadComercial.find((o: any) => o.id === primera.id);
    expect(cerrada).toMatchObject({ estado: 'DESCARTADA', motivoCierre: 'Sin presupuesto este ciclo' });
    expect(cerrada.fechaCierre).toBeInstanceOf(Date);
    await expect(ctx.oportunidades.transicionar(primera.id, 'EN_DIAGNOSTICO', ADMIN)).rejects.toBeInstanceOf(ConflictException);
  });

  it('descartar exige motivo; cada transición queda en el historial con el actor', async () => {
    const ctx = montar();
    const { oportunidad } = await ctx.oportunidades.abrirParaBuyer('buyer-1', ADMIN);
    await expect(ctx.oportunidades.transicionar(oportunidad.id, 'DESCARTADA', ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    await ctx.oportunidades.transicionar(oportunidad.id, 'EN_DIAGNOSTICO', ADMIN);
    const hist = ctx.prisma._db.oportunidadHistorial.filter((h: any) => h.oportunidadId === oportunidad.id);
    expect(hist.map((h: any) => [h.estadoAnterior, h.estadoNuevo, h.actorTipo])).toEqual([
      [null, 'ABIERTA', 'ADMIN'],
      ['ABIERTA', 'EN_DIAGNOSTICO', 'ADMIN'],
    ]);
  });

  it('la aptitud fija fechaAptaCotizar una sola vez (inicio del plazo K2)', async () => {
    const ctx = montar();
    const id = await oportunidadApta(ctx);
    const op = ctx.prisma._db.oportunidadComercial.find((o: any) => o.id === id);
    expect(op.fechaAptaCotizar).toBeInstanceOf(Date);
  });

  it('un BUYER que no es LEAD no puede abrir oportunidad', async () => {
    const ctx = montar();
    await expect(ctx.oportunidades.abrirParaBuyer('buyer-sin-lead', ADMIN)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Propuestas múltiples y versionadas', () => {
  it('no se cotiza una oportunidad que no está apta', async () => {
    const ctx = montar();
    const { oportunidad } = await ctx.oportunidades.abrirParaBuyer('buyer-1', ADMIN);
    await expect(ctx.propuestas.crearVersion(oportunidad.id, { servicioId: 'srv-1', precioPropuesto: 2200 }, ADMIN)).rejects.toBeInstanceOf(ConflictException);
  });

  it('numera versiones 1, 2, 3 por oportunidad y de forma independiente entre oportunidades', async () => {
    const ctx = montar();
    const op1 = await oportunidadApta(ctx, 'buyer-1');
    const op2 = await oportunidadApta(ctx, 'buyer-2');
    const v = [];
    for (const precio of [2200, 2100, 2000]) v.push((await ctx.propuestas.crearVersion(op1, { servicioId: 'srv-1', precioPropuesto: precio }, ADMIN)).version);
    const otra = await ctx.propuestas.crearVersion(op2, { servicioId: 'srv-1', precioPropuesto: 2200 }, ADMIN);
    expect(v).toEqual([1, 2, 3]);
    expect(otra.version).toBe(1);
  });

  it('versiones creadas en paralelo no repiten número', async () => {
    const ctx = montar();
    const op = await oportunidadApta(ctx);
    const res = await Promise.all([2200, 2100].map((p) => ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: p }, ADMIN)));
    expect(res.map((r) => r.version).sort()).toEqual([1, 2]);
  });

  it('si otra petición toma la misma versión (índice único), se renumera y reintenta una vez', async () => {
    const ctx = montar();
    const op = await oportunidadApta(ctx);
    // Otra petición ya confirmó la v1, pero esta leyó la versión máxima antes (lectura desfasada).
    ctx.prisma._db.propuesta.push({ id: 'ajena', oportunidadId: op, version: 1, estado: 'BORRADOR' });
    const aggregateReal = ctx.prisma.propuesta.aggregate;
    let lecturas = 0;
    ctx.prisma.propuesta.aggregate = async (args: any) => (++lecturas === 1 ? { _max: { version: null } } : aggregateReal(args));

    const v = await ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: 2200 }, ADMIN);
    expect(lecturas).toBe(2); // hubo un reintento
    expect(v.version).toBe(2);
  });

  it('rechaza precios fuera del rango del servicio (mínimo/máximo)', async () => {
    const ctx = montar();
    const op = await oportunidadApta(ctx);
    await expect(ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: 1500 }, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    await expect(ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: 3000 }, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la primera presentación lleva la oportunidad a EN_NEGOCIACION; una nueva versión presentada reemplaza la anterior sin borrarla', async () => {
    const ctx = montar();
    const op = await oportunidadApta(ctx);
    const v1 = await ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: 2200 }, ADMIN);
    await ctx.propuestas.presentar(v1.id, ADMIN);
    expect(ctx.prisma._db.oportunidadComercial[0].estado).toBe('EN_NEGOCIACION');

    const v2 = await ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: 2000 }, ADMIN);
    await ctx.propuestas.presentar(v2.id, ADMIN);
    const filas = ctx.prisma._db.propuesta;
    expect(filas.find((p: any) => p.id === v1.id)).toMatchObject({ estado: 'REEMPLAZADA', version: 1 });
    expect(filas.find((p: any) => p.id === v1.id).precioPropuesto.toNumber()).toBe(2200); // condiciones preservadas
    expect(filas.find((p: any) => p.id === v2.id)).toMatchObject({ estado: 'ENVIADA', version: 2 });
    expect(filas.find((p: any) => p.id === v2.id).fechaPresentacion).toBeInstanceOf(Date);
  });
});

describe('Aceptación de una versión', () => {
  async function presentada(ctx: ReturnType<typeof montar>, precio = 2200) {
    const op = await oportunidadApta(ctx);
    const v = await ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: precio }, ADMIN);
    await ctx.propuestas.presentar(v.id, ADMIN);
    return { op, v };
  }

  it('sin confirmación expresa no hay aceptación', async () => {
    const ctx = montar();
    const { v } = await presentada(ctx);
    await expect(ctx.propuestas.responder(v.id, { tipoRespuesta: 'ACEPTADA' }, ESTUDIANTE)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta una versión vigente: oportunidad ACEPTADA, respuesta registrada y NINGÚN registro de PAYERS', async () => {
    const ctx = montar();
    const { op, v } = await presentada(ctx);
    await ctx.propuestas.responder(v.id, { tipoRespuesta: 'ACEPTADA', confirmacionExpresa: true, canal: 'WHATSAPP' }, ESTUDIANTE);
    expect(ctx.prisma._db.oportunidadComercial.find((o: any) => o.id === op).estado).toBe('ACEPTADA');
    expect(ctx.prisma._db.respuestaPropuesta).toHaveLength(1);
    expect(ctx.prisma.payer).toBeUndefined(); // el servicio ni siquiera tiene acceso a PAYER
  });

  it('una versión no se acepta dos veces y no se aceptan dos versiones de la misma oportunidad', async () => {
    const ctx = montar();
    const { v } = await presentada(ctx);
    await ctx.propuestas.responder(v.id, { tipoRespuesta: 'ACEPTADA', confirmacionExpresa: true }, ESTUDIANTE);
    await expect(ctx.propuestas.responder(v.id, { tipoRespuesta: 'ACEPTADA', confirmacionExpresa: true }, ESTUDIANTE)).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.prisma._db.respuestaPropuesta).toHaveLength(1);
  });

  it('una versión REEMPLAZADA (antigua) ya no puede aceptarse', async () => {
    const ctx = montar();
    const { op, v } = await presentada(ctx);
    const v2 = await ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: 2000 }, ADMIN);
    await ctx.propuestas.presentar(v2.id, ADMIN);
    await expect(ctx.propuestas.responder(v.id, { tipoRespuesta: 'ACEPTADA', confirmacionExpresa: true }, ESTUDIANTE)).rejects.toBeInstanceOf(ConflictException);
  });

  it('una versión vencida no se acepta y no deja cambios a medias', async () => {
    const ctx = montar();
    const op = await oportunidadApta(ctx);
    const v = await ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: 2200, vigenciaHasta: new Date(Date.now() - 1000) }, ADMIN);
    await ctx.propuestas.presentar(v.id, ADMIN);
    await expect(ctx.propuestas.responder(v.id, { tipoRespuesta: 'ACEPTADA', confirmacionExpresa: true }, ESTUDIANTE)).rejects.toThrow(/venció/);
    expect(ctx.prisma._db.respuestaPropuesta).toHaveLength(0);
    expect(ctx.prisma._db.oportunidadComercial.find((o: any) => o.id === op).estado).toBe('EN_NEGOCIACION');
  });

  it('rechazar una versión no cierra la oportunidad (puede ofrecerse otra versión)', async () => {
    const ctx = montar();
    const { op, v } = await presentada(ctx);
    await ctx.propuestas.responder(v.id, { tipoRespuesta: 'RECHAZADA' }, ESTUDIANTE);
    expect(ctx.prisma._db.propuesta.find((p: any) => p.id === v.id).estado).toBe('RECHAZADA');
    expect(ctx.prisma._db.oportunidadComercial.find((o: any) => o.id === op).estado).toBe('EN_NEGOCIACION');
    const v2 = await ctx.propuestas.crearVersion(op, { servicioId: 'srv-1', precioPropuesto: 2000 }, ADMIN);
    expect(v2.version).toBe(2);
  });
});
