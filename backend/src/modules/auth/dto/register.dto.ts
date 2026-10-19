import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail, trim } from '../../../common/transforms';
import { Username } from '../../../common/validators/username.validator';
import { NewPassword } from './password';

export class RegisterDto {
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Username()
  username: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName: string;

  @NewPassword()
  password: string;
}
