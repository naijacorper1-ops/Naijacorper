import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { AuthUser } from '../../common/types/auth-user';
import { upload } from '../uploads/upload-interceptor';
import { CreateGroupDto } from './dto/create-group.dto';
import { QueryGroupsDto } from './dto/query-groups.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupsService } from './groups.service';

// :group can be the group's id or its slug (for example "lagos-corpers").
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  @UseGuards(VerifiedEmailGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryGroupsDto) {
    return this.groupsService.findAll(user.id, query);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.groupsService.findMine(user.id, query.cursor, query.pageSize);
  }

  @Get(':group')
  findOne(@CurrentUser() user: AuthUser, @Param('group') group: string) {
    return this.groupsService.findOne(user.id, group);
  }

  @Patch(':group')
  update(@CurrentUser() user: AuthUser, @Param('group') group: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(user.id, group, dto);
  }

  @Delete(':group')
  remove(@CurrentUser() user: AuthUser, @Param('group') group: string) {
    return this.groupsService.deleteOwn(user.id, group);
  }

  // Multipart form, file in the "file" field. JPG, PNG or WebP, up to 5 MB.
  @Patch(':group/avatar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(upload(5))
  setAvatar(
    @CurrentUser() user: AuthUser,
    @Param('group') group: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.groupsService.setAvatar(user.id, group, file);
  }

  @Post(':group/join')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  join(@CurrentUser() user: AuthUser, @Param('group') group: string) {
    return this.groupsService.join(user.id, group);
  }

  @Delete(':group/leave')
  leave(@CurrentUser() user: AuthUser, @Param('group') group: string) {
    return this.groupsService.leave(user.id, group);
  }

  @Get(':group/members')
  listMembers(
    @CurrentUser() user: AuthUser,
    @Param('group') group: string,
    @Query() query: PageQueryDto,
  ) {
    return this.groupsService.listMembers(user.id, group, query.cursor, query.pageSize);
  }

  // To post in a group, use POST /posts with "groupId".
  @Get(':group/posts')
  listPosts(
    @CurrentUser() user: AuthUser,
    @Param('group') group: string,
    @Query() query: PageQueryDto,
  ) {
    return this.groupsService.listPosts(user.id, group, query.cursor, query.pageSize);
  }
}
