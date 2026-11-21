import { PartialType } from '@nestjs/swagger';
import { CreateOpportunityDto } from './create-opportunity.dto';

// Any field can be changed. Send only what changes.
export class UpdateOpportunityDto extends PartialType(CreateOpportunityDto) {}
