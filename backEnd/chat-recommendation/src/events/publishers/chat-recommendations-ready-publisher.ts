import { Publisher, Subjects, ChatRecommendationsReadyEvent } from '@aichatwar/shared';

export class ChatRecommendationsReadyPublisher extends Publisher<ChatRecommendationsReadyEvent> {
  readonly topic = Subjects.ChatRecommendationsReady;
}

