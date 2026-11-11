import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { CommercialRulesModule } from './modules/commercial-rules/commercial-rules.module';
import { BuyersModule } from './modules/buyers/buyers.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { NegotiationModule } from './modules/negotiation/negotiation.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ServicesModule } from './modules/services/services.module';
import { AdvisorsModule } from './modules/advisors/advisors.module';
import { EtlModule } from './modules/etl/etl.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AlertsModule } from './modules/alerts/alerts.module';

@Module({
  imports: [
    // apps/api/.env tiene prioridad; el .env de la raíz del monorepo completa lo que falte
    // (allí viven OPENWA_API_KEY / OPENWA_WEBHOOK_SECRET compartidos con el compose de OpenWA).
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    AuthModule,
    ScoringModule,
    CommercialRulesModule,
    BuyersModule,
    AiAgentModule,
    WhatsAppModule,
    NegotiationModule,
    CustomersModule,
    PaymentsModule,
    ServicesModule,
    AdvisorsModule,
    EtlModule,
    DashboardModule,
    AlertsModule,
  ],
})
export class AppModule {}
