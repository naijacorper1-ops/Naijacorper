import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { upload } from '../uploads/upload-interceptor';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.getMe(user.id);
  }

  @Patch('me')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  // Multipart form, file in the "file" field. JPG, PNG or WebP, up to 5 MB.
  @Patch('me/avatar')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(upload(5))
  setAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.setAvatar(user.id, file);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.usersService.removeAvatar(user.id);
  }

  // Deletes the account and everything on it. Needs the password.
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  deleteAccount(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto) {
    return this.usersService.deleteAccount(user.id, dto.password);
  }

  @Get('search')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  search(@CurrentUser() user: AuthUser, @Query() query: SearchUsersDto) {
    return this.usersService.search(user.id, query.q);
  }

  @Get(':username')
  getProfile(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.usersService.getPublicProfile(user.id, username);
  }

  @Get(':username/posts')
  listPosts(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query() query: PageQueryDto,
  ) {
    return this.usersService.listPosts(user.id, username, query.cursor, query.pageSize);
  }

  @Get(':username/followers')
  listFollowers(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query() query: PageQueryDto,
  ) {
    return this.usersService.listFollowers(user.id, username, query.cursor, query.pageSize);
  }

  @Get(':username/following')
  listFollowing(
    @CurrentUser() user: AuthUser,
    @Param('username') username: string,
    @Query() query: PageQueryDto,
  ) {
    return this.usersService.listFollowing(user.id, username, query.cursor, query.pageSize);
  }
}
