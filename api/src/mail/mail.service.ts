import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { verifyEmailTemplate } from './templates/verify-email.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow('SMTP_HOST'),
      port: config.getOrThrow('SMTP_PORT'),
      secure: config.getOrThrow('SMTP_SECURE'),
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  async sendEmailVerification(
    name: string,
    email: string,
    token: string,
  ): Promise<void> {
    const minutes = this.config.getOrThrow<number>(
      'EMAIL_VERIFICATION_EXPIRES_IN_MINUTES',
    );
    const url = `${this.config.getOrThrow<string>('FRONTEND_URL').replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    const template = verifyEmailTemplate(name, url, minutes);
    try {
      await this.transporter.sendMail({
        from: {
          name: this.config.getOrThrow('SMTP_FROM_NAME'),
          address: this.config.getOrThrow('SMTP_FROM_EMAIL'),
        },
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch {
      this.logger.error(
        'Falha ao enviar e-mail de confirmação pelo SMTP configurado.',
      );
      throw new Error('MAIL_DELIVERY_FAILED');
    }
  }
}
