import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';

export class QueryAdminPostsDto extends PageQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string;
}

export class QueryAdminListingsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;
}

export class QueryAdminGroupsDto extends PageQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class QueryAuditLogsDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  action?: string;

  @IsOptional()
  @IsUUID()
  adminId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetId?: string;
}
