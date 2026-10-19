import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { AuthUser } from '../../common/types/auth-user';
import { upload } from '../uploads/upload-interceptor';
import { JourneyStageDto } from './dto/journey-stage.dto';
import { ProspectiveDetailsDto } from './dto/prospective-details.dto';
import { ServingDetailsDto } from './dto/serving-details.dto';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { OnboardingService } from './onboarding.service';

@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Patch('journey-stage')
  setJourneyStage(@CurrentUser() user: AuthUser, @Body() dto: JourneyStageDto) {
    return this.onboardingService.setJourneyStage(user.id, dto);
  }

  @Patch('prospective-details')
  setProspectiveDetails(@CurrentUser() user: AuthUser, @Body() dto: ProspectiveDetailsDto) {
    return this.onboardingService.setProspectiveDetails(user.id, dto);
  }

  @Patch('serving-details')
  setServingDetails(@CurrentUser() user: AuthUser, @Body() dto: ServingDetailsDto) {
    return this.onboardingService.setServingDetails(user.id, dto);
  }

  // Multipart form: "file" (JPG, PNG, WebP or PDF, up to 10 MB), optional
  // "documentType" and "note". Needs a verified email first.
  @Post('verification-document')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(VerifiedEmailGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(upload(10))
  submitVerification(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitVerificationDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.onboardingService.submitVerification(user.id, dto, file);
  }

  @Get('verification')
  getVerification(@CurrentUser() user: AuthUser) {
    return this.onboardingService.getVerification(user.id);
  }
}
