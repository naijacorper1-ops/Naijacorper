import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { normalizeEmail } from '../../../common/transforms';

export class ForgotPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;
}
