import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types/auth-user';
import { CancelEventDto } from './dto/cancel-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { QueryEventsDto, QueryMyEventsDto } from './dto/query-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  // Admins publish at once. Everyone else who is allowed to (verified corps
  // members, recruiters and businesses) submits it for approval. The 403
  // carries a `code`: EMAIL_NOT_VERIFIED, VERIFICATION_REQUIRED or
  // ROLE_NOT_ALLOWED.
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryEventsDto) {
    return this.eventsService.findAll(user, query);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthUser, @Query() query: QueryMyEventsDto) {
    return this.eventsService.findMine(user, query);
  }

  // Events I said I am going to.
  @Get('going')
  findGoing(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.eventsService.findGoing(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.eventsService.findById(user, id);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(user, id, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CancelEventDto) {
    return this.eventsService.cancel(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.eventsService.deleteOwn(user, id);
  }

  @Post(':id/rsvp')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  rsvp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.eventsService.rsvp(user, id);
  }

  @Delete(':id/rsvp')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  cancelRsvp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.eventsService.cancelRsvp(user, id);
  }

  // Organizer and admins only.
  @Get(':id/attendees')
  attendees(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() query: PageQueryDto) {
    return this.eventsService.attendees(user, id, query);
  }
}
