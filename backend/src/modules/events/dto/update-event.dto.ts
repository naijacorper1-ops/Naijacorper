import { PartialType } from '@nestjs/swagger';
import { CreateEventDto } from './create-event.dto';

// Any field can be changed. Send only what changes. Optional fields can be
// cleared by sending null.
export class UpdateEventDto extends PartialType(CreateEventDto) {}
