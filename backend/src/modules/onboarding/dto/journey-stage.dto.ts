import { IsEnum } from 'class-validator';

export enum JourneyStage {
  PREPARING = 'PREPARING',
  SERVING = 'SERVING',
  COMPLETED = 'COMPLETED',
}

export class JourneyStageDto {
  @IsEnum(JourneyStage)
  stage: JourneyStage;
}
