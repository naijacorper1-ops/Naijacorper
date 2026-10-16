import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('resend.apiKey'));
  }

  async sendVerificationEmail(to: string, code: string) {
    await this.resend.emails.send({
      from: this.configService.getOrThrow<string>('resend.fromAddress'),
      to,
      subject: 'Verify your NaijaCorper account',
      html: `<p>Your verification code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
    });
  }

  async sendPasswordResetEmail(to: string, code: string) {
    await this.resend.emails.send({
      from: this.configService.getOrThrow<string>('resend.fromAddress'),
      to,
      subject: 'Reset your NaijaCorper password',
      html: `<p>Your password reset code is <strong>${code}</strong>. It expires in 15 minutes.</p>`,
    });
  }
}
