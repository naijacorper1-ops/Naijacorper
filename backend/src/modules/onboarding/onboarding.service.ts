import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { UserRole, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { UsersService } from '../users/users.service';
import { JourneyStage, JourneyStageDto } from './dto/journey-stage.dto';
import { ProspectiveDetailsDto } from './dto/prospective-details.dto';
import { ServingDetailsDto } from './dto/serving-details.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';

const STAGE_TO_ROLE: Record<JourneyStage, UserRole> = {
  [JourneyStage.PREPARING]: UserRole.PROSPECTIVE_CORPER,
  [JourneyStage.SERVING]: UserRole.SERVING_CORPER,
  [JourneyStage.COMPLETED]: UserRole.EX_CORPER,
};

const JOURNEY_ROLES: UserRole[] = Object.values(STAGE_TO_ROLE);

// After this many submissions in 30 days, the person is asked to contact
// support instead of sending more (stops admins being flooded with files).
const MAX_VERIFICATION_ATTEMPTS_PER_30_DAYS = 5;

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private uploadsService: UploadsService,
  ) {}

  async setJourneyStage(userId: string, dto: JourneyStageDto) {
    const user = await this.usersService.findById(userId);

    // The journey stage sets the role. Without this check, an admin (or a
    // business or recruiter account) calling this endpoint lost their role.
    if (!user || !JOURNEY_ROLES.includes(user.role)) {
      throw new ForbiddenException('This account type does not use a journey stage');
    }

    await this.usersService.updateById(userId, { role: STAGE_TO_ROLE[dto.stage] });
    return this.usersService.getMe(userId);
  }

  async setProspectiveDetails(userId: string, dto: ProspectiveDetailsDto) {
    const user = await this.usersService.findById(userId);

    if (!user || user.role !== UserRole.PROSPECTIVE_CORPER) {
      throw new BadRequestException(
        'Set journey stage to PREPARING before submitting these details',
      );
    }

    await this.usersService.updateById(userId, {
      nyscStage: dto.nyscStage,
      state: dto.state,
      interests: dto.interests,
      onboardingCompleted: true,
    });

    return this.usersService.getMe(userId);
  }

  async setServingDetails(userId: string, dto: ServingDetailsDto) {
    const user = await this.usersService.findById(userId);

    if (!user || user.role !== UserRole.SERVING_CORPER) {
      throw new BadRequestException(
        'Set journey stage to SERVING before submitting these details',
      );
    }

    await this.usersService.updateById(userId, {
      state: dto.state,
      lga: dto.lga,
      batch: dto.batch,
      stream: dto.stream,
      ppa: dto.ppa,
      interests: dto.interests,
      onboardingCompleted: true,
    });

    return this.usersService.getMe(userId);
  }

  // One step: the file and its details arrive together, the file goes to
  // private storage, and the request goes into the admin queue.
  async submitVerification(
    userId: string,
    dto: SubmitVerificationDto,
    file: Express.Multer.File | undefined,
  ) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admin accounts do not need verification');
    }

    if (user.verificationStatus === VerificationStatus.VERIFIED) {
      throw new ConflictException('Your account is already verified');
    }

    let previousStatus = user.verificationStatus;

    if (user.verificationStatus === VerificationStatus.PENDING) {
      // Requests made before this update only saved an expired link and can
      // never be opened by an admin. Those people may submit again.
      const openRequests = await this.prisma.verificationDocument.count({
        where: { userId, status: VerificationStatus.PENDING, publicId: { not: null } },
      });

      if (openRequests > 0) {
        throw new ConflictException('Your verification request is already being reviewed');
      }

      await this.prisma.$transaction([
        this.prisma.verificationDocument.updateMany({
          where: { userId, status: VerificationStatus.PENDING },
          data: {
            status: VerificationStatus.REJECTED,
            rejectionReason: 'Please upload your document again.',
            reviewedAt: new Date(),
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: { verificationStatus: VerificationStatus.REJECTED },
        }),
      ]);

      previousStatus = VerificationStatus.REJECTED;
    }

    const recent = await this.prisma.verificationDocument.count({
      where: { userId, createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });

    if (recent >= MAX_VERIFICATION_ATTEMPTS_PER_30_DAYS) {
      throw new HttpException(
        'Too many verification attempts. Please contact support.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Step 1: claim the slot. Only one of two simultaneous requests can move
    // the status from UNVERIFIED/REJECTED to PENDING, the other gets a 409.
    const claimed = await this.prisma.user.updateMany({
      where: {
        id: userId,
        verificationStatus: { in: [VerificationStatus.UNVERIFIED, VerificationStatus.REJECTED] },
      },
      data: { verificationStatus: VerificationStatus.PENDING },
    });

    if (claimed.count === 0) {
      throw new ConflictException('Your verification request is already being reviewed');
    }

    // Step 2: store the file privately and record it. If anything fails, the
    // status goes back so the person can try again.
    let stored: Awaited<ReturnType<UploadsService['uploadVerificationDocument']>> | null = null;

    try {
      stored = await this.uploadsService.uploadVerificationDocument(file);

      await this.prisma.verificationDocument.create({
        data: {
          userId,
          documentType: dto.documentType,
          note: dto.note,
          publicId: stored.publicId,
          resourceType: stored.resourceType,
          format: stored.format,
        },
      });
    } catch (error) {
      await this.prisma.user.updateMany({
        where: { id: userId, verificationStatus: VerificationStatus.PENDING },
        data: { verificationStatus: previousStatus },
      });

      if (stored) {
        await this.uploadsService.deleteDocument(stored);
      }

      throw error;
    }

    return { status: VerificationStatus.PENDING };
  }

  // Where the person's request stands. The rejection reason is shown so they
  // know what to fix before submitting again.
  async getVerification(userId: string) {
    const [user, latest] = await Promise.all([
      this.usersService.findById(userId),
      this.prisma.verificationDocument.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          documentType: true,
          status: true,
          rejectionReason: true,
          createdAt: true,
          reviewedAt: true,
        },
      }),
    ]);

    return {
      status: user?.verificationStatus ?? VerificationStatus.UNVERIFIED,
      isVerified: user?.isVerified ?? false,
      emailVerified: user?.emailVerified ?? false,
      latest,
    };
  }
}
