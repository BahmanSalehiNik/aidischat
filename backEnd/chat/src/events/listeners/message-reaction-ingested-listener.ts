// src/events/listeners/message-reaction-ingested-listener.ts
import { Listener, Subjects, MessageReactionIngestedEvent } from '@aichatwar/shared';
import { Message } from '../../models/message';
import { RoomParticipant } from '../../models/room-participant';
import { MessageReactionCreatedPublisher, MessageReactionRemovedPublisher } from '../publishers/message-reaction-publishers';
import { kafkaWrapper } from '../../kafka-client';
import { EachMessagePayload } from 'kafkajs';

export class MessageReactionIngestedListener extends Listener<MessageReactionIngestedEvent> {
  readonly topic = Subjects.MessageReactionIngested;
  readonly groupId = 'chat-service-message-reaction-ingested';

  async onMessage(data: MessageReactionIngestedEvent['data'], payload: EachMessagePayload) {
    const { roomId, messageId, userId, emoji, action } = data;

    console.log(`[Message Reaction Ingested] Processing reaction for message ${messageId} by user ${userId}`);

    // Validate: Check if user is a participant in the room
    const participant = await RoomParticipant.findOne({
      roomId,
      participantId: userId,
      leftAt: { $exists: false }
    });

    if (!participant) {
      console.log(`[Message Reaction Ingested] Rejected: User ${userId} is not a participant in room ${roomId}`);
      await this.ack();
      return;
    }

    // Load message from database
    const message = await Message.findOne({ _id: messageId, roomId });
    if (!message) {
      console.log(`[Message Reaction Ingested] Message ${messageId} not found in room ${roomId}`);
      await this.ack();
      return;
    }

    // Initialize reactions array if it doesn't exist
    if (!message.reactions || !Array.isArray(message.reactions)) {
      message.reactions = [];
    }

    // Find existing reaction by this user
    const existingReactionIndex = message.reactions.findIndex(
      (r: any) => r.userId === userId
    );

    if (action === 'remove' || (existingReactionIndex >= 0 && message.reactions[existingReactionIndex].emoji === emoji)) {
      // Remove reaction (toggle off)
      if (existingReactionIndex >= 0) {
        message.reactions.splice(existingReactionIndex, 1);
        await message.save();

        // Aggregate reactions summary
        const reactionsSummary = this.aggregateReactions(message.reactions);

        // Publish reaction removed event
        await new MessageReactionRemovedPublisher(kafkaWrapper.producer).publish({
          roomId,
          messageId,
          userId,
          reactionsSummary,
        });

        console.log(`[Message Reaction Ingested] Removed reaction ${emoji} from message ${messageId}`);
      }
    } else {
      // Add or update reaction
      if (existingReactionIndex >= 0) {
        // Update existing reaction
        message.reactions[existingReactionIndex].emoji = emoji;
        message.reactions[existingReactionIndex].createdAt = new Date();
      } else {
        // Add new reaction
        message.reactions.push({
          userId,
          emoji,
          createdAt: new Date(),
        });
      }

      await message.save();

      // Aggregate reactions summary
      const reactionsSummary = this.aggregateReactions(message.reactions);

      // Publish reaction created event
      await new MessageReactionCreatedPublisher(kafkaWrapper.producer).publish({
        roomId,
        messageId,
        reaction: {
          userId,
          emoji,
        },
        reactionsSummary,
      });

      // MVP: do NOT publish feedback.* events.

      console.log(`[Message Reaction Ingested] Added/updated reaction ${emoji} to message ${messageId}`);
    }

    await this.ack();
  }

  private aggregateReactions(reactions: Array<{ userId: string; emoji: string; createdAt: Date }>): Array<{ emoji: string; count: number }> {
    const reactionMap = new Map<string, number>();
    
    reactions.forEach((r: any) => {
      const emoji = r.emoji;
      reactionMap.set(emoji, (reactionMap.get(emoji) || 0) + 1);
    });

    return Array.from(reactionMap.entries()).map(([emoji, count]) => ({
      emoji,
      count,
    }));
  }
}

