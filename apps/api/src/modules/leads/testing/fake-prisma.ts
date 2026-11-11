/**
 * Prisma en memoria para pruebas del módulo LEADS (no se compila en el build: ver tsconfig.build.json).
 * Reproduce las restricciones únicas de la migración 2_leads_backfill_restricciones:
 *  - UX_OPORT_ABIERTA_POR_LEAD (leadId) WHERE fechaCierre IS NULL
 *  - UX_PROPUESTA_VERSION (oportunidadId, version)
 *  - UX_RESPUESTA_ACEPTADA (propuestaId) WHERE tipoRespuesta = 'ACEPTADA'
 * y la atomicidad de $transaction (si la función falla, el estado se restaura).
 */
import { Prisma } from '@prisma/client';

type Row = Record<string, any>;
let seq = 0;
const nuevoId = (p: string) => `${p}-${++seq}`;
const violacionUnica = (indice: string) => Object.assign(new Error(`Unique constraint failed: ${indice}`), { code: 'P2002' });

function cumple(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof Prisma.Decimal)) {
      if ('not' in v) return row[k] !== v.not;
      if ('in' in v) return v.in.includes(row[k]);
      return true;
    }
    return (row[k] ?? null) === (v ?? null);
  });
}

export function crearFakePrisma() {
  const db: Record<string, Row[]> = {
    lead: [],
    servicio: [],
    oportunidadComercial: [],
    oportunidadHistorial: [],
    propuesta: [],
    respuestaPropuesta: [],
  };

  const verificarUnicos = () => {
    const abiertas = db.oportunidadComercial.filter((o) => o.fechaCierre == null).map((o) => o.leadId);
    if (new Set(abiertas).size !== abiertas.length) throw violacionUnica('UX_OPORT_ABIERTA_POR_LEAD');
    const versiones = db.propuesta.filter((p) => p.oportunidadId && p.version != null).map((p) => `${p.oportunidadId}#${p.version}`);
    if (new Set(versiones).size !== versiones.length) throw violacionUnica('UX_PROPUESTA_VERSION');
    const aceptadas = db.respuestaPropuesta.filter((r) => r.tipoRespuesta === 'ACEPTADA').map((r) => r.propuestaId);
    if (new Set(aceptadas).size !== aceptadas.length) throw violacionUnica('UX_RESPUESTA_ACEPTADA');
  };

  const insertar = (tabla: string, prefijo: string, defaults: Row = {}) => async ({ data }: { data: Row }) => {
    const row = { id: nuevoId(prefijo), ...defaults, ...data };
    db[tabla].push(row);
    try {
      verificarUnicos();
    } catch (e) {
      db[tabla].pop();
      throw e;
    }
    return { ...row };
  };

  const updateMany = (tabla: string) => async ({ where, data }: { where: Row; data: Row }) => {
    const filas = db[tabla].filter((r) => cumple(r, where));
    const previas = filas.map((r) => ({ ...r }));
    filas.forEach((r) => Object.assign(r, data));
    try {
      verificarUnicos();
    } catch (e) {
      filas.forEach((r, i) => Object.keys(r).forEach((k) => (r[k] = previas[i][k])));
      throw e;
    }
    return { count: filas.length };
  };

  let cola: Promise<unknown> = Promise.resolve();

  const prisma: any = {
    _db: db,
    lead: {
      findUnique: async ({ where }: any) => db.lead.find((l) => cumple(l, where)) ?? null,
    },
    servicio: {
      findUnique: async ({ where }: any) => db.servicio.find((s) => s.id === where.id) ?? null,
    },
    oportunidadComercial: {
      create: insertar('oportunidadComercial', 'op', { estado: 'ABIERTA', fechaInicio: new Date(), fechaAptaCotizar: null, fechaCierre: null }),
      findFirst: async ({ where }: any) => db.oportunidadComercial.find((o) => cumple(o, where)) ?? null,
      findUnique: async ({ where }: any) => {
        const o = db.oportunidadComercial.find((x) => x.id === where.id);
        return o ? { ...o } : null;
      },
      updateMany: updateMany('oportunidadComercial'),
    },
    oportunidadHistorial: {
      create: insertar('oportunidadHistorial', 'hist', { fecha: new Date() }),
    },
    propuesta: {
      create: insertar('propuesta', 'prop', { estado: 'BORRADOR', fechaPresentacion: null, vigenciaHasta: null }),
      aggregate: async ({ where }: any) => {
        const vs = db.propuesta.filter((p) => cumple(p, where)).map((p) => p.version ?? 0);
        return { _max: { version: vs.length ? Math.max(...vs) : null } };
      },
      findUnique: async ({ where, include }: any) => {
        const p = db.propuesta.find((x) => x.id === where.id);
        if (!p) return null;
        return include?.oportunidad ? { ...p, oportunidad: { ...db.oportunidadComercial.find((o) => o.id === p.oportunidadId) } } : { ...p };
      },
      updateMany: updateMany('propuesta'),
      count: async ({ where }: any) => db.propuesta.filter((p) => cumple(p, where)).length,
    },
    respuestaPropuesta: {
      create: insertar('respuestaPropuesta', 'resp', { fechaRespuesta: new Date() }),
    },
    // Transacciones serializadas (como bloqueos de una BD real): la reversión de una no
    // puede deshacer el trabajo confirmado por otra.
    $transaction: (fn: (tx: any) => Promise<any>) => {
      const ejecutar = async () => {
        const copia = Object.fromEntries(Object.entries(db).map(([k, v]) => [k, v.map((r) => ({ ...r }))]));
        try {
          return await fn(prisma);
        } catch (e) {
          Object.keys(db).forEach((k) => (db[k] = copia[k]));
          throw e;
        }
      };
      const resultado = cola.then(ejecutar, ejecutar);
      cola = resultado.catch(() => undefined);
      return resultado;
    },
  };
  return prisma;
}
