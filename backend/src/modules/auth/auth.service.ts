import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const OTP_LIFETIME_MS = 15 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
// A new code for the same person and purpose is not sent more than once a
// minute, so one victim cannot be flooded with emails from many places.
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class AuthService implements OnModuleInit {
  // A real argon2 hash of a throwaway password. When a login uses an email we
  // do not know, we still check the password against this, so the response
  // takes the same time and nobody can tell which emails have accounts.
  private dummyHash = '';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await argon2.hash('timing-equaliser-not-a-real-password');
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: dto.email, mode: 'insensitive' } },
          { username: { equals: dto.username, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email or username already in use');
    }

    const passwordHash = await argon2.hash(dto.password);

    // If two people submit the same email at the same moment, the database's
    // unique rule rejects the second one and the global filter turns that
    // into the same 409 as above.
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        fullName: dto.fullName,
        passwordHash,
      },
    });

    await this.sendEmailVerification(user.id, user.email);

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.findByEmail(dto.email);

    if (!user) {
      await argon2.verify(this.dummyHash, dto.password).catch(() => false);
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password).catch(() => false);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account has been deactivated');
    }

    return this.issueTokens(user.id);
  }

  async refresh(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);

    // One atomic step: only the request that flips revoked from false to true
    // gets a new token. Two requests with the same token at the same moment
    // can no longer both succeed (the old read-then-update could).
    const rotated = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
      data: { revoked: true },
    });

    if (rotated.count === 0) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      select: { userId: true, user: { select: { isActive: true } } },
    });

    // A deactivated user must not be able to keep renewing their session.
    if (!stored || !stored.user.isActive) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    return this.issueTokens(stored.userId);
  }

  async logout(rawToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken) },
      data: { revoked: true },
    });
  }

  // Signs the user out on every device.
  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword).catch(() => false);

    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    // Every other device is signed out, this one continues with fresh tokens.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    return this.issueTokens(userId);
  }

  async sendEmailVerification(userId: string, email: string) {
    const code = await this.createOtp(userId, OtpPurpose.EMAIL_VERIFICATION);

    if (code) {
      await this.mailService.sendVerificationEmail(email, code);
    }
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.findByEmail(dto.email);

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
    const user = await this.findByEmail(dto.email);

    if (user && !user.emailVerified) {
      await this.sendEmailVerification(user.id, user.email);
    }

    return { message: 'If that email needs verifying, a new code is on its way' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.findByEmail(dto.email);

    if (user && user.isActive) {
      const code = await this.createOtp(user.id, OtpPurpose.PASSWORD_RESET);

      if (code) {
        await this.mailService.sendPasswordResetEmail(user.email, code);
      }
    }

    // Same message whether or not the email exists, so it cannot be probed.
    return { message: 'If that email is registered, a reset code is on its way' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.findByEmail(dto.email);

    if (!user) {
      throw new BadRequestException('Invalid email or code');
    }

    await this.consumeOtp(user.id, dto.code, OtpPurpose.PASSWORD_RESET);

    const passwordHash = await argon2.hash(dto.newPassword);

    // The code went to this inbox, so using it also proves the email is theirs.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, emailVerified: true },
    });

    // Password changed, so every existing session is logged out.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true },
    });

    return { reset: true };
  }

  // Emails are stored in lowercase. Accounts made before that rule may still
  // have capital letters, so fall back to a case-insensitive match.
  private async findByEmail(email: string) {
    const exact = await this.prisma.user.findUnique({ where: { email } });

    if (exact) {
      return exact;
    }

    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
  }

  // Access tokens carry only the user id. Role and active status are read from
  // the database on every request (see JwtStrategy), so they are never stale.
  private async issueTokens(userId: string) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
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

    // Housekeeping: expired tokens are of no use to anyone.
    await this.prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    return { accessToken, refreshToken };
  }

  // Refresh tokens and codes are hashed before storing, so a leaked
  // database does not leak working tokens.
  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshExpiryDate() {
    const days = this.configService.getOrThrow<number>('jwt.refreshExpiresInDays');
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  // Returns the plain code, or null when one was sent less than a minute ago.
  private async createOtp(userId: string, purpose: OtpPurpose): Promise<string | null> {
    const latest = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, consumed: false },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (latest && Date.now() - latest.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      return null;
    }

    // crypto.randomInt is a proper random source. Math.random is guessable.
    const code = crypto.randomInt(100000, 1000000).toString();

    // Only the newest code works, and old finished ones are cleaned out.
    await this.prisma.otpCode.deleteMany({
      where: {
        userId,
        purpose,
        OR: [{ consumed: true }, { expiresAt: { lt: new Date() } }],
      },
    });
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, consumed: false },
      data: { consumed: true },
    });

    await this.prisma.otpCode.create({
      data: {
        userId,
        codeHash: this.hashToken(code),
        purpose,
        expiresAt: new Date(Date.now() + OTP_LIFETIME_MS),
      },
    });

    return code;
  }

  private async consumeOtp(userId: string, code: string, purpose: OtpPurpose) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, consumed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date() || otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Invalid or expired code');
    }

    // Every guess uses up one of the 5 attempts BEFORE the code is compared,
    // in one atomic step. Checking and counting separately would let many
    // guesses sent at the same instant all slip through before the count rose.
    const claimed = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumed: false, attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });

    if (claimed.count === 0) {
      throw new BadRequestException('Invalid or expired code');
    }

    const given = Buffer.from(this.hashToken(code), 'hex');
    const expected = Buffer.from(otp.codeHash, 'hex');
    const matches = given.length === expected.length && crypto.timingSafeEqual(given, expected);

    if (!matches) {
      throw new BadRequestException('Invalid or expired code');
    }

    // Marking it used is the single step that decides who wins if the same
    // correct code arrives twice at once.
    const used = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, consumed: false },
      data: { consumed: true },
    });

    if (used.count === 0) {
      throw new BadRequestException('Invalid or expired code');
    }
  }
}
