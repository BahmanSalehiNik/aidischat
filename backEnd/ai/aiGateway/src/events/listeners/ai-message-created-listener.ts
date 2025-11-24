// src/events/listeners/ai-message-created-listener.ts
import { Listener } from '@aichatwar/shared';
import { AiMessageCreatedEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { AgentProfile, AgentProfileStatus } from '../../models/agent-profile';
import { AssistantThread } from '../../models/assistant-thread';
import { ProviderFactory } from '../../providers/provider-factory';
import { AiMessageReplyPublisher } from '../publishers/ai-message-reply-publisher';
import { kafkaWrapper } from '../../kafka-client';
import { PromptBuilder, CharacterAttributes } from '../../prompt-engineering';
import OpenAI from 'openai';

export class AiMessageCreatedListener extends Listener<AiMessageCreatedEvent> {
  readonly topic = Subjects.AiMessageCreated;
  readonly groupId = 'ai-gateway-ai-message-created';

  async onMessage(data: AiMessageCreatedEvent['data'], payload: any) {
    const { messageId, roomId, content, aiReceivers, senderId, senderType } = data;

    console.log(`Received ai.message.created for message ${messageId} with ${aiReceivers.length} AI receivers`);

    // Process each AI receiver in parallel
    const promises = aiReceivers.map(async (receiver) => {
      try {
        await this.processAiReceiver(messageId, roomId, content, receiver, senderId, senderType);
      } catch (error: any) {
        console.error(`Error processing AI receiver ${receiver.agentId}:`, error);
        // Continue processing other receivers even if one fails
      }
    });

    await Promise.allSettled(promises);
    await this.ack();
  }

  private async processAiReceiver(
    originalMessageId: string,
    roomId: string,
    messageContent: string,
    receiver: { agentId: string; ownerUserId: string },
    senderId: string,
    senderType: 'human' | 'agent'
  ) {
    const { agentId, ownerUserId } = receiver;

    // Fetch agent profile to get model configuration
    const agentProfile = await AgentProfile.findByAgentId(agentId);
    
    if (!agentProfile) {
      console.warn(`Agent profile not found for agent ${agentId}, skipping`);
      return;
    }

    if (agentProfile.status !== AgentProfileStatus.Active) {
      console.warn(`Agent ${agentId} profile status is ${agentProfile.status}. Skipping message processing until provisioning completes.`);
      return;
    }

    // Extract character attributes from metadata
    const characterAttributes: CharacterAttributes | undefined = agentProfile.metadata?.character;

    // For system prompt:
    // - OpenAI: System prompt is already in the assistant, use base prompt
    // - Anthropic/Local: Need to send system prompt with each message
    // Since we can't know which provider here, we'll use the base system prompt
    // The enhanced prompt with all character details was already used during agent creation
    // and is stored in the provider's assistant (for OpenAI) or we'll enhance it minimally here
    let systemPrompt = agentProfile.systemPrompt;
    
    // Only enhance system prompt for providers that don't support persistent assistants
    // (Anthropic, local) - they need character context in each message
    if (
      agentProfile.modelProvider === 'anthropic' ||
      agentProfile.modelProvider === 'cohere' ||
      agentProfile.modelProvider === 'local' ||
      agentProfile.modelProvider === 'custom'
    ) {
      // For these providers, enhance with character attributes since they don't have persistent assistants
      systemPrompt = PromptBuilder.buildSystemPrompt(
        agentProfile.systemPrompt,
        characterAttributes,
        {
          includeAppearance: true,
          includePersonality: true,
          includeBackground: true,
          includeGoals: true,
          style: 'detailed',
        }
      );
    }
    // For OpenAI, the system prompt is already in the assistant, so base prompt is sufficient

    // Build MINIMAL message context - only dynamic attributes
    // Static attributes (appearance, personality, background) are already in:
    // - OpenAI: Stored in assistant instructions
    // - Anthropic/Local: Included in system prompt above
    const messageContext = PromptBuilder.buildMessageContext(
      characterAttributes,
      {
        includePersonality: false, // Already in system prompt/assistant
        style: 'minimal', // Only dynamic attributes
      }
    );

    // Prepend minimal context to message (only if there's dynamic content)
    const messageWithContext = messageContext 
      ? `${messageContext}User message: ${messageContent}`
      : messageContent;

    // Get API key from profile or environment variables (same logic as agent creation)
    const apiKey = agentProfile.apiKey || this.getApiKeyFromEnv(agentProfile.modelProvider);
    const endpoint = agentProfile.endpoint || this.getEndpointFromEnv(agentProfile.modelProvider);

    // For OpenAI Assistants API: Get or create thread for this room+agent combination
    let threadId: string | undefined = undefined;
    if (agentProfile.modelProvider === 'openai' && agentProfile.providerAgentId) {
      console.log(`[AI Message] Agent ${agentId} is OpenAI, providerAgentId: ${agentProfile.providerAgentId}`);
      const thread = await this.getOrCreateThread(roomId, agentId, agentProfile.providerAgentId, apiKey);
      if (!thread) {
        console.error(`[AI Message] ❌ Failed to get or create thread for agent ${agentId} in room ${roomId}`);
        return;
      }
      threadId = thread;
      console.log(`[AI Message] ✅ Thread ID for agent ${agentId} in room ${roomId}: ${threadId}`);
    } else {
      console.log(`[AI Message] Agent ${agentId} is NOT using OpenAI Assistants API (provider: ${agentProfile.modelProvider}, providerAgentId: ${agentProfile.providerAgentId})`);
    }

    // Create provider instance
    let provider;
    try {
      provider = ProviderFactory.createProvider(
        agentProfile.modelProvider,
        apiKey,
        endpoint
      );
    } catch (error: any) {
      console.error(`Failed to create provider for agent ${agentId}:`, error);
      return;
    }

    // Generate response using the provider with optimized prompts
    // For OpenAI, pass the assistant ID (providerAgentId) and thread ID to use Assistants API
    const assistantId = agentProfile.modelProvider === 'openai' ? agentProfile.providerAgentId : undefined;
    console.log(`[AI Message] Calling provider.generateResponse for agent ${agentId}:`, {
      modelProvider: agentProfile.modelProvider,
      assistantId: assistantId,
      threadId: threadId,
      hasAssistantId: !!assistantId,
      hasThreadId: !!threadId,
      willUseAssistantsAPI: agentProfile.modelProvider === 'openai' && !!assistantId && !!threadId,
    });
    
    const response = await provider.generateResponse({
      message: messageWithContext,
      systemPrompt: systemPrompt,
      modelName: agentProfile.modelName,
      temperature: 0.7,
      maxTokens: 1000,
      tools: agentProfile.tools,
      assistantId: assistantId,
      threadId: threadId,
    });

    if (response.error || !response.content) {
      console.error(`Failed to generate response for agent ${agentId}:`, response.error);
      return;
    }

    // Publish ai.message.reply event
    await new AiMessageReplyPublisher(kafkaWrapper.producer).publish({
      originalMessageId,
      roomId,
      agentId,
      ownerUserId,
      content: response.content,
    });

    console.log(`Published ai.message.reply for agent ${agentId} (message ${originalMessageId})`);
  }

  private async getOrCreateThread(
    roomId: string,
    agentId: string,
    assistantId: string,
    apiKey?: string
  ): Promise<string | undefined> {
    try {
      // Check if thread already exists for this room+agent
      const existingThread = await AssistantThread.findByRoomAndAgent(roomId, agentId);
      if (existingThread) {
        // Update last used timestamp
        existingThread.lastUsedAt = new Date();
        await existingThread.save();
        console.log(`[Thread] Using existing thread ${existingThread.threadId} for agent ${agentId} in room ${roomId}`);
        return existingThread.threadId;
      }

      // Create new thread via OpenAI API
      if (!apiKey) {
        apiKey = this.getApiKeyFromEnv('openai');
      }
      if (!apiKey) {
        throw new Error('OpenAI API key is required to create thread');
      }

      const openaiClient = new OpenAI({ apiKey });
      const thread = await openaiClient.beta.threads.create();
      console.log(`[Thread] ✅ Created new thread ${thread.id} for agent ${agentId} in room ${roomId} with assistant ${assistantId}`);

      // Store thread mapping in database
      const threadRecord = AssistantThread.build({
        roomId,
        agentId,
        threadId: thread.id,
        assistantId,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      });
      await threadRecord.save();

      return thread.id;
    } catch (error: any) {
      console.error(`[Thread] Failed to get or create thread for agent ${agentId} in room ${roomId}:`, error);
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

