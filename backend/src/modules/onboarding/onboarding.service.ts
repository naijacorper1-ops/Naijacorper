import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { JourneyStage, JourneyStageDto } from './dto/journey-stage.dto';
import { ProspectiveDetailsDto } from './dto/prospective-details.dto';
import { ServingDetailsDto } from './dto/serving-details.dto';
import { VerificationDocumentDto } from './dto/verification-document.dto';

const STAGE_TO_ROLE: Record<JourneyStage, UserRole> = {
  [JourneyStage.PREPARING]: UserRole.PROSPECTIVE_CORPER,
  [JourneyStage.SERVING]: UserRole.SERVING_CORPER,
  [JourneyStage.COMPLETED]: UserRole.EX_CORPER,
};

@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async setJourneyStage(userId: string, dto: JourneyStageDto) {
    const role = STAGE_TO_ROLE[dto.stage];
    const user = await this.usersService.updateById(userId, { role });
    return this.usersService.sanitize(user);
  }

  async setProspectiveDetails(userId: string, dto: ProspectiveDetailsDto) {
    const user = await this.usersService.findById(userId);

    if (!user || user.role !== UserRole.PROSPECTIVE_CORPER) {
      throw new BadRequestException(
        'Set journey stage to PREPARING before submitting these details',
      );
    }

    const updated = await this.usersService.updateById(userId, {
      nyscStage: dto.nyscStage,
      state: dto.state,
      interests: dto.interests,
      onboardingCompleted: true,
    });

    return this.usersService.sanitize(updated);
  }

  async setServingDetails(userId: string, dto: ServingDetailsDto) {
    const user = await this.usersService.findById(userId);

    if (!user || user.role !== UserRole.SERVING_CORPER) {
      throw new BadRequestException(
        'Set journey stage to SERVING before submitting these details',
      );
    }

    const updated = await this.usersService.updateById(userId, {
      state: dto.state,
      lga: dto.lga,
      batch: dto.batch,
      stream: dto.stream,
      ppa: dto.ppa,
      interests: dto.interests,
      onboardingCompleted: true,
    });

    return this.usersService.sanitize(updated);
  }

  async submitVerificationDocument(userId: string, dto: VerificationDocumentDto) {
    await this.prisma.verificationDocument.create({
      data: { userId, documentUrl: dto.documentUrl },
    });

    await this.usersService.updateById(userId, {
      verificationStatus: VerificationStatus.PENDING,
    });

    return { status: VerificationStatus.PENDING };
  }
}
