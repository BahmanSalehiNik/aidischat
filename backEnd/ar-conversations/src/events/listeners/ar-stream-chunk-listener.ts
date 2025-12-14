// src/events/listeners/ar-stream-chunk-listener.ts
import { Listener, Subjects, ARStreamChunkEvent } from '@aichatwar/shared';
import { ARMessage } from '../../models/ar-message';

export class ARStreamChunkListener extends Listener<ARStreamChunkEvent> {
  readonly topic = Subjects.ARStreamChunk;
  readonly groupId = 'ar-conversations-service';

  async onMessage(data: ARStreamChunkEvent['data'], payload: any) {
    console.log(`📥 [ARStreamChunkListener] Received chunk ${data.chunkIndex} for message ${data.messageId}`);

    // Update AR message with chunk content
    const arMessage = await ARMessage.findById(data.messageId);
    
    if (!arMessage) {
      console.warn(`⚠️ [ARStreamChunkListener] AR message ${data.messageId} not found`);
      await this.ack();
      return;
    }

    // Append chunk to message content
    if (data.chunkIndex === 0) {
      // First chunk - replace content
      arMessage.content = data.chunk;
    } else {
      // Subsequent chunks - append
      arMessage.content += data.chunk;
    }

    // Update status if final
    if (data.isFinal) {
      arMessage.status = 'completed';
    }

    await arMessage.save();

    console.log(`✅ [ARStreamChunkListener] Updated AR message ${data.messageId} with chunk ${data.chunkIndex}`);
    await this.ack();
  }
}

