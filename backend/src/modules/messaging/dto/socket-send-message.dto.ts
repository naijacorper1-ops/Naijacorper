import { Transform } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';

// The body of the "sendMessage" socket event. REST calls are checked by the
// global validation pipe, socket events are not, so this is checked by hand
// in the gateway.
export class SocketSendMessageDto {
  @IsUUID()
  conversationId: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
