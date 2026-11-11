import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard / Analítica')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Obtener métricas consolidadas del Funnel IMPULSE y KPIs ejecutivos' })
  async getOverview() {
    return this.dashboardService.getMetrics();
  }

  @Get('reportes-ejecutivos')
  @ApiOperation({ summary: 'Obtener reportes ejecutivos de Inteligencia de Negocios por cada fase del Funnel' })
  async getExecutiveReports() {
    return this.dashboardService.getExecutiveReports();
  }
}
