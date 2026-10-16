import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() currentUser: { id: string }) {
    const user = await this.usersService.findById(currentUser.id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.sanitize(user);
  }
}
