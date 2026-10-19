import { IsUUID } from 'class-validator';

export class VotePollDto {
  @IsUUID()
  optionId: string;
}
