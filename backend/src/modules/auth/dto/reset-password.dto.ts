import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';
import { normalizeEmail, trim } from '../../../common/transforms';
import { NewPassword } from './password';

export class ResetPasswordDto {
  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @Transform(trim)
  @IsString()
  @Length(6, 6)
  code: string;

  @NewPassword()
  newPassword: string;
}
