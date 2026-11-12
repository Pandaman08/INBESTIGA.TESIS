import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { LeadsAnalyticsController } from './leads-analytics.controller';
import { LeadsAnalyticsService } from './leads-analytics.service';

@Module({
  controllers: [DashboardController, LeadsAnalyticsController],
  providers: [DashboardService, LeadsAnalyticsService],
  exports: [DashboardService],
})
export class DashboardModule {}
