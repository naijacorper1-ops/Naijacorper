import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JourneyStageDto } from './dto/journey-stage.dto';
import { ProspectiveDetailsDto } from './dto/prospective-details.dto';
import { ServingDetailsDto } from './dto/serving-details.dto';
import { VerificationDocumentDto } from './dto/verification-document.dto';
import { OnboardingService } from './onboarding.service';

@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Patch('journey-stage')
  setJourneyStage(@CurrentUser() user: { id: string }, @Body() dto: JourneyStageDto) {
    return this.onboardingService.setJourneyStage(user.id, dto);
  }

  @Patch('prospective-details')
  setProspectiveDetails(@CurrentUser() user: { id: string }, @Body() dto: ProspectiveDetailsDto) {
    return this.onboardingService.setProspectiveDetails(user.id, dto);
  }

  @Patch('serving-details')
  setServingDetails(@CurrentUser() user: { id: string }, @Body() dto: ServingDetailsDto) {
    return this.onboardingService.setServingDetails(user.id, dto);
  }

  @Post('verification-document')
  submitVerificationDocument(
    @CurrentUser() user: { id: string },
    @Body() dto: VerificationDocumentDto,
  ) {
    return this.onboardingService.submitVerificationDocument(user.id, dto);
  }
}
