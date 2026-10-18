import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface SendResult {
  ok: boolean;
  externalId?: string;
  error?: string;
}

/** E-mail transacional via Resend (https://resend.com) */
@Injectable()
export class EmailProvider {
  private readonly logger = new Logger('Email');
  constructor(private config: ConfigService) {}

  get enabled() {
    return !!this.config.get('RESEND_API_KEY');
  }

  async send(to: string, subject: string, html: string, text?: string): Promise<SendResult> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('FROM_EMAIL') || 'Connect Barber <noreply@creativenext.cloud>';
    if (!apiKey) {
      this.logger.debug(`[simulado] e-mail para ${to}: ${subject}`);
      return { ok: false, error: 'RESEND_API_KEY não configurada' };
    }
    try {
      const { data } = await axios.post(
        'https://api.resend.com/emails',
        { from, to: [to], subject, html, text },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 15000 },
      );
      return { ok: true, externalId: data?.id };
    } catch (e: any) {
      const msg = e?.response?.data?.message || e.message;
      this.logger.warn(`Falha e-mail para ${to}: ${msg}`);
      return { ok: false, error: msg };
    }
  }
}

/** WhatsApp via Evolution API (instância compartilhada da plataforma) */
@Injectable()
export class WhatsAppProvider {
  private readonly logger = new Logger('WhatsApp');
  constructor(private config: ConfigService) {}

  get enabled() {
    return !!(this.config.get('EVOLUTION_API_URL') && this.config.get('EVOLUTION_API_KEY'));
  }

  async send(phone: string, text: string): Promise<SendResult> {
    const base = (this.config.get<string>('EVOLUTION_API_URL') || '').replace(/\/$/, '');
    const key = this.config.get<string>('EVOLUTION_API_KEY');
    const instance = this.config.get<string>('EVOLUTION_INSTANCE_NAME') || 'CREATIVELABS';
    if (!base || !key) {
      this.logger.debug(`[simulado] whatsapp para ${phone}: ${text.slice(0, 60)}...`);
      return { ok: false, error: 'Evolution API não configurada' };
    }
    try {
      const { data } = await axios.post(
        `${base}/message/sendText/${instance}`,
        { number: phone, text, delay: 800 },
        { headers: { apikey: key }, timeout: 20000 },
      );
      return { ok: true, externalId: data?.key?.id };
    } catch (e: any) {
      const msg = e?.response?.data?.response?.message?.[0] || e?.response?.data?.message || e.message;
      this.logger.warn(`Falha WhatsApp para ${phone}: ${JSON.stringify(msg)}`);
      return { ok: false, error: typeof msg === 'string' ? msg : JSON.stringify(msg) };
    }
  }
}
