// src/events/publishers/ai-message-reply-publisher.ts
import { Publisher } from '@aichatwar/shared';
import { AiMessageReplyEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';

export class AiMessageReplyPublisher extends Publisher<AiMessageReplyEvent> {
  readonly topic = Subjects.AiMessageReply;
}

