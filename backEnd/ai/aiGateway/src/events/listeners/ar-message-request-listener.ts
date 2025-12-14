// src/events/listeners/ar-message-request-listener.ts
import { Listener, Subjects, ARMessageRequestEvent } from '@aichatwar/shared';
import { AgentProfile, AgentProfileStatus } from '../../models/agent-profile';
import { AssistantThread } from '../../models/assistant-thread';
import { ProviderFactory } from '../../providers/provider-factory';
import { kafkaWrapper } from '../../kafka-client';
import { PromptBuilder, CharacterAttributes } from '../../prompt-engineering';
import { ARStreamStartPublisher, ARStreamChunkPublisher, ARStreamEndPublisher } from '../publishers/ar-stream-publishers';
import crypto from 'crypto';

export class ARMessageRequestListener extends Listener<ARMessageRequestEvent> {
  readonly topic = Subjects.ARMessageRequest;
  readonly groupId = 'ai-gateway-ar-message-request';

  async onMessage(data: ARMessageRequestEvent['data'], payload: any) {
    const { messageId, roomId, agentId, userId, content } = data;

    console.log(`📥 [ARMessageRequestListener] Received AR message request:`, {
      messageId,
      roomId,
      agentId,
      userId,
      contentLength: content.length,
    });

    try {
      await this.processARMessage(messageId, roomId, agentId, userId, content);
    } catch (error: any) {
      console.error(`❌ [ARMessageRequestListener] Error processing AR message:`, error);
      // Don't throw - ack the message to prevent retries
      await this.ack();
    }
  }

  private async processARMessage(
    messageId: string,
    roomId: string,
    agentId: string,
    userId: string,
    userMessage: string
  ) {
    // Fetch agent profile
    const agentProfile = await AgentProfile.findByAgentId(agentId);
    if (!agentProfile || agentProfile.status !== AgentProfileStatus.Active) {
      console.warn(`⚠️ [ARMessageRequestListener] Agent ${agentId} not found or not active`);
      return;
    }

    // Get provider
    const provider = ProviderFactory.create(agentProfile.modelProvider, agentProfile.apiKey);
    if (!provider) {
      console.error(`❌ [ARMessageRequestListener] Failed to create provider for ${agentProfile.modelProvider}`);
      return;
    }

    // Generate stream ID
    const streamId = `stream-${messageId}`;

    // Get or create thread (for OpenAI Assistants API)
    let threadId: string | undefined;
    const assistantId = agentProfile.modelProvider === 'openai' ? agentProfile.providerAgentId : undefined;
    if (assistantId) {
      threadId = await this.getOrCreateThread(roomId, agentId, assistantId, agentProfile.apiKey);
    }

    // Build system prompt with AR marker instructions
    const characterAttributes = agentProfile.characterAttributes as CharacterAttributes | undefined;
    const baseSystemPrompt = PromptBuilder.buildSystemPrompt(characterAttributes, agentProfile.systemPrompt);
    
    const arSystemPrompt = `${baseSystemPrompt}

IMPORTANT: You are in an AR conversation. Use emotion and gesture markers to express yourself naturally.

Marker Format:
- [emotion:<type>] - Change emotion/expression
- [gesture:<type>] - Trigger gesture animation
- [pose:<type>] - Change body pose
- [tone:<type>] - Change voice tone

Available emotions: neutral, happy, sad, angry, surprised, calm, excited, thoughtful, concerned
Available gestures: wave, nod, shake_head, point, hand_raise, thumbs_up, shrug
Available poses: idle, talking, listening, thinking
Available tones: neutral, excited, calm, serious, friendly, concerned, playful

Place markers:
- At the start of phrases that need emotion
- When your tone or emotion changes
- Before important gestures

Example: [emotion:happy,gesture:wave]Hello! [emotion:thoughtful]Let me think about that...`;

    // Publish stream start event
    await new ARStreamStartPublisher(kafkaWrapper.producer).publish({
      streamId,
      messageId,
      roomId,
      agentId,
      userId,
      startedAt: new Date().toISOString(),
    });

    console.log(`✅ [ARMessageRequestListener] Published AR stream start for message ${messageId}`);

    // Stream response with markers
    let chunkIndex = 0;
    let fullContent = '';

    try {
      // Check if provider supports streaming
      if (typeof (provider as any).streamResponse === 'function') {
        // Use streaming method
        await (provider as any).streamResponse(
          {
            message: userMessage,
            systemPrompt: arSystemPrompt,
            modelName: agentProfile.modelName,
            temperature: 0.7,
            maxTokens: 1000,
            assistantId,
            threadId,
          },
          async (chunk: string) => {
            if (chunk) {
              fullContent += chunk;
              
              // Publish chunk event
              await new ARStreamChunkPublisher(kafkaWrapper.producer).publish({
                streamId,
                messageId,
                roomId,
                chunk,
                chunkIndex,
                timestamp: new Date().toISOString(),
                isFinal: false,
              });

              chunkIndex++;
            }
          }
        );
      } else {
        // Fallback: Generate full response and split into chunks
        const response = await provider.generateResponse({
          message: userMessage,
          systemPrompt: arSystemPrompt,
          modelName: agentProfile.modelName,
          temperature: 0.7,
          maxTokens: 1000,
          assistantId,
          threadId,
        });

        if (response.error || !response.content) {
          console.error(`❌ [ARMessageRequestListener] Failed to generate response:`, response.error);
          return;
        }

        fullContent = response.content;

        // Split into chunks (simulate streaming)
        const chunkSize = 50; // Characters per chunk
        for (let i = 0; i < fullContent.length; i += chunkSize) {
          const chunk = fullContent.substring(i, i + chunkSize);
          
          await new ARStreamChunkPublisher(kafkaWrapper.producer).publish({
            streamId,
            messageId,
            roomId,
            chunk,
            chunkIndex,
            timestamp: new Date().toISOString(),
            isFinal: i + chunkSize >= fullContent.length,
          });

          chunkIndex++;
          
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Publish stream end event
      await new ARStreamEndPublisher(kafkaWrapper.producer).publish({
        streamId,
        messageId,
        roomId,
        totalChunks: chunkIndex,
        endedAt: new Date().toISOString(),
      });

      console.log(`✅ [ARMessageRequestListener] Published AR stream end for message ${messageId} (${chunkIndex} chunks)`);
    } catch (error: any) {
      console.error(`❌ [ARMessageRequestListener] Error during streaming:`, error);
      throw error;
    }
  }

  private async getOrCreateThread(
    roomId: string,
    agentId: string,
    assistantId: string,
    apiKey?: string
  ): Promise<string | undefined> {
    // Use same logic as AiMessageCreatedListener
    try {
      const existingThread = await AssistantThread.findByRoomAndAgent(roomId, agentId);
      if (existingThread) {
        // Update last used timestamp
        existingThread.lastUsedAt = new Date();
        await existingThread.save();
        console.log(`[ARMessageRequestListener] Using existing thread ${existingThread.threadId} for agent ${agentId} in AR room ${roomId}`);
        return existingThread.threadId;
      }

      // Create new thread for AR room
      if (!apiKey) {
        apiKey = this.getApiKeyFromEnv('openai');
      }
      if (!apiKey) {
        console.warn(`[ARMessageRequestListener] No API key provided, cannot create thread`);
        return undefined;
      }

      const OpenAI = (await import('openai')).default;
      const openaiClient = new OpenAI({ apiKey });
      const thread = await openaiClient.beta.threads.create();
      
      // Save thread to database
      const threadRecord = AssistantThread.build({
        roomId,
        agentId,
        threadId: thread.id,
        assistantId,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      });
      await threadRecord.save();

      console.log(`[ARMessageRequestListener] ✅ Created new thread ${thread.id} for agent ${agentId} in AR room ${roomId}`);
      return thread.id;
    } catch (error: any) {
      console.error(`[ARMessageRequestListener] Error getting/creating thread:`, error);
      return undefined;
    }
  }

  private getApiKeyFromEnv(provider: string): string | undefined {
    switch (provider.toLowerCase()) {
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      case 'cohere':
        return process.env.COHERE_API_KEY;
      default:
        return undefined;
    }
  }
}

