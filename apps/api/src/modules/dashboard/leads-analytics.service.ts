import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

type CutoffInput = { corte?: string };

@Injectable()
export class LeadsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private jsonSafe<T>(value: T): T {
    return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? Number(item) : item)));
  }

  private cutoff(value?: string): string {
    const corte = value ?? new Date().toISOString().slice(0, 10);
    const fecha = new Date(`${corte}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(corte) || Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== corte) {
      throw new BadRequestException('corte debe tener formato YYYY-MM-DD');
    }
    return corte;
  }

  async getDashboard(input: CutoffInput = {}) {
    const corte = this.cutoff(input.corte);
    const [kpi, etl] = await Promise.all([
      this.prisma.$queryRawUnsafe('SELECT TOP 1 * FROM INBESTIGA_MART.dbo.vw_leads_kpi_oficial'),
      this.prisma.$queryRawUnsafe(
        'SELECT TOP 1 id, fecha_inicio, fecha_fin, fecha_corte, estado, filas_diagnostico, filas_oportunidad, filas_objecion, error_mensaje FROM INBESTIGA_MART.dbo.Leads_Etl_Ejecucion ORDER BY id DESC',
      ),
    ]);
    return { corte, fuente: 'INBESTIGA_MART', datos: this.jsonSafe(kpi), ultimaEjecucionEtl: this.jsonSafe(etl) };
  }

  async runEtl(input: CutoffInput = {}) {
    const corte = this.cutoff(input.corte);
    const result = await this.prisma.$queryRawUnsafe(
      `EXEC INBESTIGA_MART.dbo.sp_etl_leads @Corte = '${corte}'`,
    );
    return { corte, resultado: this.jsonSafe(result) };
  }

  async report(report: 'r1' | 'r2' | 'r3' | 'r4') {
    const objects: Record<string, string> = {
      r1: 'vw_leads_r1_diagnosticos',
      r2: 'vw_leads_r2_cotizacion',
      r3: 'vw_leads_r3_objeciones',
    };
    if (report === 'r4') {
      return this.jsonSafe(await this.prisma.$queryRawUnsafe('EXEC INBESTIGA_MART.dbo.sp_leads_r4_operativo'));
    }
    return this.jsonSafe(await this.prisma.$queryRawUnsafe(`SELECT * FROM INBESTIGA_MART.dbo.${objects[report]}`));
  }
}
