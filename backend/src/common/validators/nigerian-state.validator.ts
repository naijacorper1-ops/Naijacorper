import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';
import { NIGERIAN_STATES, normalizeState } from '../utils/nigeria-states';

// Turns "lagos state" into "Lagos" before validating. If the value is not a
// Nigerian state it is left alone, so the validation error shows what the
// user actually sent.
export function NigerianState() {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? (normalizeState(value) ?? value) : value)),
    IsIn([...NIGERIAN_STATES], {
      message: 'state must be a valid Nigerian state (for example Lagos, Oyo or FCT)',
    }),
  );
}
