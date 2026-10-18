import { Global, Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { EmailProvider, WhatsAppProvider } from './providers';

@Global()
@Module({
  providers: [MessagingService, EmailProvider, WhatsAppProvider],
  exports: [MessagingService, EmailProvider, WhatsAppProvider],
})
export class MessagingModule {}
