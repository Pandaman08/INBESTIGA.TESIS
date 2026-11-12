import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeadsAnalyticsService } from './leads-analytics.service';

@ApiTags('Dashboard / LEADS')
@Controller('dashboard/leads')
export class LeadsAnalyticsController {
  constructor(private readonly service: LeadsAnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'KPI oficiales K1-K5 de LEADS desde el DataMart' })
  getDashboard() {
    return this.service.getDashboard();
  }

  @Post('etl')
  @ApiOperation({ summary: 'Ejecutar ETL transaccional de LEADS para una fecha de corte' })
  runEtl(@Body() body: { corte?: string }) {
    return this.service.runEtl(body ?? {});
  }

  @Get('reportes/:reporte')
  @ApiOperation({ summary: 'Consultar R1, R2, R3 o R4' })
  report(@Param('reporte') reporte: string) {
    if (!['r1', 'r2', 'r3', 'r4'].includes(reporte)) {
      throw new BadRequestException('reporte debe ser r1, r2, r3 o r4');
    }
    return this.service.report(reporte as 'r1' | 'r2' | 'r3' | 'r4');
  }
}
