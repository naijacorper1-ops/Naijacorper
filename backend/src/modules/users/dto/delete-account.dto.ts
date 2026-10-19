import { IsString, MaxLength } from 'class-validator';

export class DeleteAccountDto {
  // Asked again so a stolen session cannot erase the account.
  @IsString()
  @MaxLength(128)
  password: string;
}
