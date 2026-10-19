import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageChannel, MessageKind, MessageStatus } from '@prisma/client';
import { PrismaService } from '../../core/infrastructure/database/prisma/prisma.service';
import { EmailProvider, WhatsAppProvider } from './providers';

export interface OutgoingMessage {
  tenantId: string;
  clientId?: string | null;
  kind: MessageKind;
  channels: MessageChannel[];
  phone?: string | null;
  email?: string | null;
  subject?: string;
  text: string;
  html?: string;
  appointmentId?: string;
  campaignId?: string;
}

/** Renderiza modelos com {{variavel}} */
export function renderTemplate(tpl: string, vars: Record<string, string | number | null | undefined>) {
  return (tpl || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ''));
}

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailProvider,
    private whatsapp: WhatsAppProvider,
    private config: ConfigService,
  ) {}

  get status() {
    return { email: this.email.enabled, whatsapp: this.whatsapp.enabled };
  }

  /** Envia por todos os canais possíveis e registra em message_logs */
  async send(msg: OutgoingMessage) {
    const results: { channel: MessageChannel; ok: boolean; error?: string }[] = [];
    for (const channel of msg.channels) {
      let recipient: string | null = null;
      if (channel === 'WHATSAPP') recipient = msg.phone ?? null;
      if (channel === 'EMAIL') recipient = msg.email ?? null;
      if (!recipient) continue;

      const log = await this.prisma.messageLog.create({
        data: {
          tenantId: msg.tenantId,
          clientId: msg.clientId ?? undefined,
          channel,
          kind: msg.kind,
          recipient,
          subject: msg.subject,
          content: msg.text,
          appointmentId: msg.appointmentId,
          campaignId: msg.campaignId,
        },
      });

      const r =
        channel === 'WHATSAPP'
          ? await this.whatsapp.send(recipient, msg.text)
          : await this.email.send(recipient, msg.subject || 'Connect Barber', msg.html || this.basicHtml(msg.text), msg.text);

      await this.prisma.messageLog.update({
        where: { id: log.id },
        data: {
          status: r.ok ? MessageStatus.SENT : MessageStatus.FAILED,
          sentAt: r.ok ? new Date() : undefined,
          externalId: r.externalId,
          error: r.error,
        },
      });
      results.push({ channel, ok: r.ok, error: r.error });
    }
    return results;
  }

  // ---------- e-mails da plataforma (sem tenant) ----------
  async sendWelcomeEmail(to: string, name: string, tenantName: string) {
    const app = this.appUrl();
    return this.email.send(
      to,
      `Bem-vindo ao Connect Barber, ${name.split(' ')[0]}!`,
      this.basicHtml(
        `Olá ${name},\n\nA barbearia "${tenantName}" foi criada e você tem 30 dias grátis com todas as funcionalidades.\n\nAcesse o painel: ${app}/app\n\nPróximos passos: cadastre seus serviços, profissionais e a jornada de trabalho. Em minutos sua agenda online estará no ar.\n\nEquipe Connect Barber`,
      ),
    );
  }

  async sendPasswordResetEmail(to: string, name: string, url: string) {
    return this.email.send(
      to,
      'Redefinição de senha - Connect Barber',
      this.basicHtml(`Olá ${name},\n\nPara redefinir sua senha, acesse o link abaixo (válido por 24 horas):\n${url}\n\nSe você não pediu isso, ignore este e-mail.`),
    );
  }

  // ---------- avisos da plataforma para a barbearia (sem log por cliente) ----------
  /** E-mail da plataforma (fatura, pagamento confirmado). Melhor esforço: nunca lança. */
  async sendPlatformEmail(to: string | null | undefined, subject: string, text: string) {
    if (!to) return { ok: false, error: 'sem e-mail' };
    try {
      return await this.email.send(to, subject, this.basicHtml(text), text);
    } catch (e: any) {
      return { ok: false, error: e?.message };
    }
  }

  /** WhatsApp da plataforma para o telefone da barbearia. Melhor esforço: nunca lança. */
  async sendPlatformWhatsApp(phone: string | null | undefined, text: string) {
    const digits = (phone ?? '').replace(/\D/g, '');
    if (!digits) return { ok: false, error: 'sem telefone' };
    try {
      return await this.whatsapp.send(digits.startsWith('55') ? digits : `55${digits}`, text);
    } catch (e: any) {
      return { ok: false, error: e?.message };
    }
  }

  appUrl() {
    return (this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173').split(',')[0];
  }

  basicHtml(text: string) {
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const linked = esc.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
<div style="font-weight:700;font-size:20px;margin-bottom:16px">💈 Connect Barber</div>
<div style="white-space:pre-wrap">${linked}</div>
<hr style="border:0;border-top:1px solid #eee;margin:24px 0"/>
<div style="color:#777;font-size:12px">Mensagem automática do Connect Barber.</div>
</body></html>`;
  }
}
