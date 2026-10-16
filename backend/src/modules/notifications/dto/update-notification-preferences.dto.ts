import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  likes?: boolean;

  @IsOptional()
  @IsBoolean()
  comments?: boolean;

  @IsOptional()
  @IsBoolean()
  follows?: boolean;

  @IsOptional()
  @IsBoolean()
  messages?: boolean;
}
