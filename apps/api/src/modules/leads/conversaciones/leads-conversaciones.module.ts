import { Module, forwardRef } from '@nestjs/common';
import { AiAgentModule } from '../../ai-agent/ai-agent.module';
import { WhatsAppModule } from '../../whatsapp/whatsapp.module';
import { LeadsModule } from '../leads.module';
import { OrquestadorConversacionalService } from './orquestador.service';

/**
 * Orquestador conversacional de LEADS (P03). Separado de LeadsModule porque depende del agente IA
 * y del adaptador de WhatsApp, que a su vez dependen del flujo de negociación.
 */
@Module({
  imports: [AiAgentModule, LeadsModule, forwardRef(() => WhatsAppModule)],
  providers: [OrquestadorConversacionalService],
  exports: [OrquestadorConversacionalService],
})
export class LeadsConversacionesModule {}
