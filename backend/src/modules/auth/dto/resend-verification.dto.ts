import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { normalizeEmail } from '../../../common/transforms';

export class ResendVerificationDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;
}
