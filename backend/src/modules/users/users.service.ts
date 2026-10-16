import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updateById(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async setActive(id: string, isActive: boolean) {
    return this.updateById(id, { isActive });
  }

  sanitize(user: User) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
