// src/events/listeners/message-created-listener.ts
import { Listener } from '@aichatwar/shared';
import { MessageCreatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { SessionManager } from '../../services/session-manager';

export class MessageCreatedListener extends Listener<MessageCreatedEvent> {
  readonly topic = Subjects.MessageCreated;
  readonly groupId = 'chat-history-service-message-created';

  async onMessage(data: MessageCreatedEvent['data'], payload: any) {
    const { id: messageId, roomId, senderId, senderType, createdAt } = data;

    console.log(`[MessageCreatedListener] Processing message ${messageId} from ${senderType} ${senderId} in room ${roomId}`);

    try {
      // Link message to session (creates session if needed)
      await SessionManager.linkMessageToSession(
        messageId,
        roomId,
        senderId,
        senderType as 'human' | 'agent',
        new Date(createdAt)
      );

      console.log(`[MessageCreatedListener] Successfully processed message ${messageId}`);
    } catch (error: any) {
      console.error(`[MessageCreatedListener] Error processing message ${messageId}:`, error);
      // Don't throw - acknowledge to prevent infinite retries
      // The error is logged for investigation
    }

    await this.ack();
  }
}

