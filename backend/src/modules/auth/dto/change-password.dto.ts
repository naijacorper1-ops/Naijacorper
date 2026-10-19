import { IsString, MaxLength } from 'class-validator';
import { NewPassword } from './password';

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @NewPassword()
  newPassword: string;
}
