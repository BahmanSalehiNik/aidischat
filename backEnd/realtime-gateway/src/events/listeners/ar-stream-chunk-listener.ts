import { redisPublisher } from '../../redis';
import { EachMessagePayload } from 'kafkajs';

// Temporary local type definition until ARStreamChunkEvent is added to shared package
interface ARStreamChunkEvent {
  subject: 'agent-chat.stream.chunk' | 'ar.stream.chunk';
  data: {
    streamId: string;
    messageId: string;
    roomId: string;
    chunk: string;
    chunkIndex: number;
    timestamp: string;
    isFinal: boolean;
  };
}

/**
 * ARStreamChunkListener
 * 
 * FAN-OUT ARCHITECTURE:
 * This listener runs on ONE Gateway pod (thanks to Kafka consumer group).
 * It receives ar.stream.chunk events from Kafka and triggers Redis pub/sub fan-out.
 * 
 * Flow:
 * 1. Kafka delivers ar.stream.chunk to exactly ONE pod (consumer group guarantees this)
 * 2. This pod publishes to Redis channel "ar-room:{roomId}" 
 * 3. Redis broadcasts to ALL Gateway pods subscribed to that channel
 * 4. Each pod checks local roomMembers map and sends to its connected sockets
 * 
 * Note: Uses separate channel "ar-room:{roomId}" to distinguish from regular "room:{roomId}"
 * All listeners use the same groupId 'realtime-gateway-group' to ensure
 * only one pod processes each message, then fans out via Redis.
 */

export class ARStreamChunkListener {
  // Renamed from AR → agent-chat, but keep AR for backward compatibility
  readonly topic = 'agent-chat.stream.chunk';
  readonly groupId = 'realtime-gateway-group';

  async onMessage(data: ARStreamChunkEvent['data'], kafkaPayload: EachMessagePayload) {
    console.log(`📥 [ARStreamChunkListener] onMessage called with data:`, {
      streamId: data.streamId,
      messageId: data.messageId,
      roomId: data.roomId,
      chunkIndex: data.chunkIndex,
      chunkLength: data.chunk?.length || 0,
      isFinal: data.isFinal,
      partition: kafkaPayload.partition,
      offset: kafkaPayload.message.offset,
    });
    
    // Validate required fields
    if (!data.streamId || !data.messageId || !data.roomId) {
      console.warn(`⚠️ [ARStreamChunkListener] Invalid ar.stream.chunk event, missing required fields:`, {
        hasStreamId: !!data.streamId,
        hasMessageId: !!data.messageId,
        hasRoomId: !!data.roomId,
      });
      return;
    }
    
    // Normalize roomId to ensure consistency (trim whitespace)
    const normalizedRoomId = data.roomId?.trim();
    if (!normalizedRoomId) {
      console.error(`❌ [ARStreamChunkListener] Invalid roomId in ar.stream.chunk event:`, data.roomId);
      throw new Error(`Invalid roomId: ${data.roomId}`);
    }
    
    // Use separate channel for AR rooms: "ar-room:{roomId}"
    const channel = `ar-room:${normalizedRoomId}`;
    const redisPayload = {
      type: 'ar-stream-chunk',
      streamId: data.streamId,
      messageId: data.messageId,
      roomId: normalizedRoomId, // Ensure roomId in payload is also normalized
      chunk: data.chunk,
      chunkIndex: data.chunkIndex,
      timestamp: data.timestamp,
      isFinal: data.isFinal,
    };
    
    // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
    const publishResult = await redisPublisher.publish(channel, JSON.stringify(redisPayload));
    
    console.log(`📤 [Kafka→Redis] Published ar.stream.chunk to channel "${channel}" (roomId: "${normalizedRoomId}") (fan-out trigger)`, {
      channel,
      roomId: normalizedRoomId,
      streamId: data.streamId,
      chunkIndex: data.chunkIndex,
      publishResult, // Number of subscribers that received the message
      payloadSize: JSON.stringify(redisPayload).length,
    });
    
    // Note: In the old pattern with shared consumer, ack is handled in index.ts
    // This method is kept for compatibility but won't be called in the old pattern
  }
}

