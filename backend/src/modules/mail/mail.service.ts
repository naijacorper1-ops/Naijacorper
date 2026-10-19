import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('resend.apiKey'));
  }

  async sendVerificationEmail(to: string, code: string) {
    return this.send(
      to,
      'Verify your NaijaCorper account',
      `<p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
    );
  }

  async sendPasswordResetEmail(to: string, code: string) {
    return this.send(
      to,
      'Reset your NaijaCorper password',
      `<p>Your password reset code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
    );
  }

  // An email problem (Resend down, sandbox sender, bad address) must never
  // turn into a failed signup or a 500. Resend's SDK returns errors instead
  // of throwing, so they used to disappear silently; now they are logged.
  // The code itself is never logged.
  private async send(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.configService.getOrThrow<string>('resend.fromAddress'),
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Resend rejected an email to ${this.mask(to)}: ${error.message}`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(
        `Could not send an email to ${this.mask(to)}`,
        err instanceof Error ? err.stack : String(err),
      );
      return false;
    }
  }

  private mask(email: string) {
    const [name, domain] = email.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
}
