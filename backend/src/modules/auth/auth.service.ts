import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName,
        passwordHash,
      },
    });

    await this.sendEmailVerification(user.id, user.email);

    return this.issueTokens(user.id, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    return this.issueTokens(user.id, user.role);
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    // Rotate on every use: the old token can never be replayed again.
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    return this.issueTokens(storedToken.userId, storedToken.user.role);
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
  }

  async sendEmailVerification(userId: string, email: string) {
    const code = this.generateOtp();

    await this.prisma.otpCode.create({
      data: {
        userId,
        codeHash: this.hashToken(code),
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        expiresAt: this.getOtpExpiryDate(),
      },
    });

    await this.mailService.sendVerificationEmail(email, code);
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      throw new BadRequestException('Invalid email or code');
    }

    await this.consumeOtp(user.id, dto.code, OtpPurpose.EMAIL_VERIFICATION);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    return { verified: true };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user && !user.emailVerified) {
      await this.sendEmailVerification(user.id, user.email);
    }

    return { message: 'If that email needs verifying, a new code is on its way' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user) {
      const code = this.generateOtp();

      await this.prisma.otpCode.create({
        data: {
          userId: user.id,
          codeHash: this.hashToken(code),
          purpose: OtpPurpose.PASSWORD_RESET,
          expiresAt: this.getOtpExpiryDate(),
        },
      });

      await this.mailService.sendPasswordResetEmail(user.email, code);
    }

    // Same message whether or not the email exists — don't leak that.
    return { message: 'If that email is registered, a reset code is on its way' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      throw new BadRequestException('Invalid email or code');
    }

    await this.consumeOtp(user.id, dto.code, OtpPurpose.PASSWORD_RESET);

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Password changed — every existing session gets logged out.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });

    return { reset: true };
  }

  private async issueTokens(userId: string, role: string) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, role },
      {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
      },
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId,
        expiresAt: this.getRefreshExpiryDate(),
      },
    });

    return { accessToken, refreshToken };
  }

  // Refresh tokens are opaque, not JWTs, so we hash them the same way
  // a password reset token would be hashed before storing.
  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshExpiryDate() {
    const days = this.configService.getOrThrow<number>('jwt.refreshExpiresInDays');
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  private generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getOtpExpiryDate() {
    return new Date(Date.now() + 15 * 60 * 1000);
  }

  private async consumeOtp(userId: string, code: string, purpose: OtpPurpose) {
    const codeHash = this.hashToken(code);

    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, codeHash, consumed: false },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumed: true },
    });
  }
}
