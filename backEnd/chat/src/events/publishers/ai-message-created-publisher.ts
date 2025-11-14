import { Publisher } from '@aichatwar/shared';
import { AiMessageCreatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class AiMessageCreatedPublisher extends Publisher<AiMessageCreatedEvent> {
  readonly topic = Subjects.AiMessageCreated;
}

