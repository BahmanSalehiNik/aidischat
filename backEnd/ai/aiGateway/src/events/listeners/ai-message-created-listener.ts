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
import { costTrackingService } from '../../services/cost';

export class AiMessageCreatedListener extends Listener<AiMessageCreatedEvent> {
  readonly topic = Subjects.AiMessageCreated;
  readonly groupId = 'ai-gateway-ai-message-created';

  async onMessage(data: AiMessageCreatedEvent['data'], payload: any) {
    const { messageId, roomId, content, aiReceivers, senderId, senderType, senderName } = data;

    console.log(`Received ai.message.created for message ${messageId} with ${aiReceivers.length} AI receivers`);

    // Process each AI receiver in parallel
    const promises = aiReceivers.map(async (receiver) => {
      try {
        await this.processAiReceiver(messageId, roomId, content, receiver, senderId, senderType, senderName);
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
    senderType: 'human' | 'agent',
    senderName?: string
  ) {
    const { agentId, ownerUserId } = receiver;

    // Defense in depth: Prevent agent from responding to itself
    // This check should be redundant (chat service should filter this out),
    // but it's a good safety measure in case of bugs or edge cases
    if (senderType === 'agent' && senderId === agentId) {
      console.log(`[AI Message] Agent ${agentId} is trying to respond to its own message (${originalMessageId}), skipping. This should not happen - chat service should filter this out.`);
      return;
    }

    // For OpenAI Assistants API, we'll add the message to the thread but skip creating a run (which would generate a reply)
    if (senderType === 'agent') {
      console.log(`[AI Message] Sender is an agent (${senderId}), adding message to thread for agent ${agentId} but skipping reply generation.`);
      
      // Fetch agent profile to get OpenAI configuration
      const agentProfile = await AgentProfile.findByAgentId(agentId);
      if (!agentProfile || agentProfile.status !== AgentProfileStatus.Active) {
        console.log(`[AI Message] Agent ${agentId} profile not found or not active, skipping thread update`);
        return;
      }

      // Only add to thread for OpenAI Assistants API (other providers don't use threads)
      if (agentProfile.modelProvider === 'openai' && agentProfile.providerAgentId) {
        const apiKey = agentProfile.apiKey || this.getApiKeyFromEnv('openai');
        if (!apiKey) {
          console.warn(`[AI Message] No API key for agent ${agentId}, skipping thread update`);
          return;
        }

        // Get or create thread for this agent
        const threadId = await this.getOrCreateThread(roomId, agentId, agentProfile.providerAgentId, apiKey);
        if (!threadId) {
          console.warn(`[AI Message] Failed to get thread for agent ${agentId}, skipping thread update`);
          return;
        }

        // Format message with sender name
        const senderDisplayName = senderName || 'Agent';
        const formattedMessage = `${senderDisplayName}(AI): ${messageContent}`;

        // Add message to thread (but don't create a run - this just adds it to context)
        try {
          const openaiClient = new OpenAI({ apiKey });
          await openaiClient.beta.threads.messages.create(threadId, {
            role: 'user',
            content: formattedMessage,
          });
          console.log(`[AI Message] ✅ Added agent message from ${senderId} to thread ${threadId} for agent ${agentId} (no reply will be generated)`);
        } catch (error: any) {
          console.error(`[AI Message] Failed to add agent message to thread:`, error);
          // Continue - message is still in database for context
        }
      } else {
        // For non-OpenAI providers, the message is already in the database and will be in context
        // when the next human message arrives
        console.log(`[AI Message] Agent ${agentId} uses ${agentProfile.modelProvider}, message will be in context from database`);
      }
      
      return; // Don't generate a reply
    }

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

    // Format message with sender name and type: "username(user type): message text"
    // At this point, senderType is guaranteed to be 'human' (we return early for 'agent')
    const senderDisplayName = senderName || 'User';
    const userTypeLabel = 'human';
    const formattedMessage = `${senderDisplayName}(${userTypeLabel}): ${messageContent}`;

    // Prepend minimal context to message (only if there's dynamic content)
    const messageWithContext = messageContext 
      ? `${messageContext}${formattedMessage}`
      : formattedMessage;

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
    
    const providerRequest = {
      message: messageWithContext,
      systemPrompt: systemPrompt,
      modelName: agentProfile.modelName,
      temperature: 0.7,
      maxTokens: 1000,
      tools: agentProfile.tools,
      assistantId: assistantId,
      threadId: threadId,
    };

    const limit = await costTrackingService.assertWithinLimits(ownerUserId);
    if (!limit.ok) {
      await new AiMessageReplyPublisher(kafkaWrapper.producer).publish({
        originalMessageId,
        roomId,
        agentId,
        ownerUserId,
        content: limit.message,
      });
      return;
    }

    const response = await costTrackingService.trackGenerateResponse(
      {
        idempotencyKey: `ai:chat_reply:${originalMessageId}:${agentId}`,
        ownerUserId,
        agentId,
        feature: 'chat_reply',
        provider: agentProfile.modelProvider,
        modelName: agentProfile.modelName,
        request: providerRequest,
        metadata: {
          roomId,
          originalMessageId,
          senderId,
          senderType,
        },
      },
      () => provider.generateResponse(providerRequest)
    );

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

