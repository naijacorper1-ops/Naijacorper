import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { UserRole, VerificationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';

export class QueryAdminUsersDto extends PageQueryDto {
  // Search in username, full name and email.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  verification?: VerificationStatus;
}

export class ChangeRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SetVerificationDto {
  @ApiProperty({ enum: [VerificationStatus.VERIFIED, VerificationStatus.UNVERIFIED] })
  @IsIn([VerificationStatus.VERIFIED, VerificationStatus.UNVERIFIED])
  status: VerificationStatus;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
