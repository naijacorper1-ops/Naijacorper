import { IsUrl } from 'class-validator';

export class VerificationDocumentDto {
  @IsUrl()
  documentUrl: string;
}
