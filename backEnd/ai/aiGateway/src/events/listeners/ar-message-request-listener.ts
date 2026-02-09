// src/events/listeners/ar-message-request-listener.ts
import { Listener, ARMessageRequestEvent, Subjects, EachMessagePayload } from '@aichatwar/shared';
import { AgentProfile, AgentProfileStatus } from '../../models/agent-profile';
import { AssistantThread } from '../../models/assistant-thread';
import { ProviderFactory } from '../../providers/provider-factory';
import { PromptBuilder, CharacterAttributes } from '../../prompt-engineering';
import { ARStreamStartPublisher, ARStreamChunkPublisher, ARStreamEndPublisher } from '../publishers/ar-stream-publishers';
import { kafkaWrapper } from '../../kafka-client';
import crypto from 'crypto';

export class ARMessageRequestListener extends Listener<ARMessageRequestEvent> {
  readonly topic = Subjects.ARMessageRequest;
  readonly groupId = 'ai-gateway-ar-message-request';

  async onMessage(data: ARMessageRequestEvent['data'], payload: EachMessagePayload) {
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
      // Error is logged, Kafka will retry if needed
      throw error; // Re-throw to prevent auto-ack, allowing retry
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

    // Get API key from profile or environment variables (fallback pattern)
    const apiKey = agentProfile.apiKey || this.getApiKeyFromEnv(agentProfile.modelProvider);
    const endpoint = agentProfile.endpoint || this.getEndpointFromEnv(agentProfile.modelProvider);

    if (!apiKey && agentProfile.modelProvider !== 'local' && agentProfile.modelProvider !== 'custom') {
      console.error(`❌ [ARMessageRequestListener] API key is required for ${agentProfile.modelProvider} provider`);
      throw new Error(`API key is required for ${agentProfile.modelProvider} provider`);
    }

    // Get provider
    const provider = ProviderFactory.createProvider(agentProfile.modelProvider, apiKey, endpoint);
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
      threadId = await this.getOrCreateThread(roomId, agentId, assistantId, apiKey);
    }

    // Build system prompt (AR mode: no special avatar/marker instructions)
    // characterAttributes might be in metadata, otherwise use empty
    const characterAttributes = (agentProfile.metadata?.characterAttributes || agentProfile.metadata?.character) as CharacterAttributes | undefined;
    const baseSystemPrompt = PromptBuilder.buildSystemPrompt(agentProfile.systemPrompt || '', characterAttributes);
    const arSystemPrompt = baseSystemPrompt;

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

    // Stream response (plain text; no avatar/marker prompt injection)
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

  private getEndpointFromEnv(provider: string): string | undefined {
    if (provider === 'local' || provider === 'custom') {
      return process.env.LOCAL_LLM_ENDPOINT;
    }
    return undefined;
  }
}

