import { EachMessagePayload } from 'kafkajs';
import { Listener, MessageCreatedEvent, Subjects } from '@aichatwar/shared';
import { AgentProfile, AgentProfileStatus } from '../../models/agent-profile';
import { ProviderFactory } from '../../providers/provider-factory';
import { PromptBuilder, CharacterAttributes } from '../../prompt-engineering';
import { AiMessageReplyPublisher } from '../publishers/ai-message-reply-publisher';
import { kafkaWrapper } from '../../kafka-client';
import OpenAI from 'openai';
import { AssistantThread } from '../../models/assistant-thread';
import { costTrackingService } from '../../services/cost';

/**
 * MVP behavior:
 * - When a human replies to an agent message, trigger the AI provider to respond.
 * - This replaces the old flow that relied on feedback.* events + feedback service.
 */
export class AgentReplyMessageCreatedListener extends Listener<MessageCreatedEvent> {
  readonly topic = Subjects.MessageCreated;
  readonly groupId = 'ai-gateway-agent-reply-message-created';

  private getApiKeyFromEnv(modelProvider: string): string | undefined {
    if (modelProvider === 'openai') return process.env.OPENAI_API_KEY;
    if (modelProvider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
    if (modelProvider === 'cohere') return process.env.COHERE_API_KEY;
    return undefined;
  }

  private getEndpointFromEnv(modelProvider: string): string | undefined {
    if (modelProvider === 'openai') return process.env.OPENAI_ENDPOINT;
    if (modelProvider === 'anthropic') return process.env.ANTHROPIC_ENDPOINT;
    if (modelProvider === 'cohere') return process.env.COHERE_ENDPOINT;
    return undefined;
  }

  private async getOrCreateThread(
    roomId: string,
    agentId: string,
    assistantId: string,
    apiKey?: string
  ): Promise<string | undefined> {
    try {
      const existingThread = await AssistantThread.findByRoomAndAgent(roomId, agentId);
      if (existingThread) {
        existingThread.lastUsedAt = new Date();
        await existingThread.save();
        return existingThread.threadId;
      }

      if (!apiKey) apiKey = this.getApiKeyFromEnv('openai');
      if (!apiKey) throw new Error('OpenAI API key is required to create thread');

      const openaiClient = new OpenAI({ apiKey });
      const thread = await openaiClient.beta.threads.create();

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
      console.error(`[AgentReplyMessageCreated] Thread error:`, error?.message || error);
      return undefined;
    }
  }

  async onMessage(data: MessageCreatedEvent['data'], _payload: EachMessagePayload) {
    // Only trigger on replies from humans to agent messages.
    if (data.senderType !== 'human') {
      await this.ack();
      return;
    }
    if (!data.replyToMessageId || !data.replyTo) {
      await this.ack();
      return;
    }
    if (data.replyTo.senderType !== 'agent' || !data.replyTo.senderId) {
      await this.ack();
      return;
    }

    const roomId = data.roomId;
    const replyMessageId = data.id;
    const agentId = data.replyTo.senderId;

    // Load agent profile (AI Gateway DB) so we can call provider
    const agentProfile = await AgentProfile.findByAgentId(agentId);
    if (!agentProfile) {
      await this.ack();
      return;
    }
    if (agentProfile.status !== AgentProfileStatus.Active) {
      await this.ack();
      return;
    }

    const apiKey = agentProfile.apiKey || this.getApiKeyFromEnv(agentProfile.modelProvider);
    const endpoint = agentProfile.endpoint || this.getEndpointFromEnv(agentProfile.modelProvider);

    const replierName = data.senderName || 'User';
    const repliedToLabel = 'your message';

    const originalContent = data.replyTo.content;
    const replyContent = data.content;
    const replyTemplate = `replied to ${repliedToLabel} "${originalContent}" with: "${replyContent}"`;
    const formattedMessage = `${replierName}(human): ${replyTemplate}`;

    const characterAttributes: CharacterAttributes | undefined = agentProfile.metadata?.character;
    const messageContext = PromptBuilder.buildMessageContext(characterAttributes, {
      includePersonality: false,
      style: 'minimal',
    });
    const messageWithContext = messageContext ? `${messageContext}${formattedMessage}` : formattedMessage;

    let systemPrompt = agentProfile.systemPrompt;
    if (
      agentProfile.modelProvider === 'anthropic' ||
      agentProfile.modelProvider === 'cohere' ||
      agentProfile.modelProvider === 'local' ||
      agentProfile.modelProvider === 'custom'
    ) {
      systemPrompt = PromptBuilder.buildSystemPrompt(agentProfile.systemPrompt, characterAttributes);
    }

    // Thread + assistants API for OpenAI
    let threadId: string | undefined;
    if (agentProfile.modelProvider === 'openai' && agentProfile.providerAgentId) {
      threadId = await this.getOrCreateThread(roomId, agentId, agentProfile.providerAgentId, apiKey);
      if (!threadId) {
        await this.ack();
        return;
      }
    }

    let provider;
    try {
      provider = ProviderFactory.createProvider(agentProfile.modelProvider, apiKey, endpoint);
    } catch (error: any) {
      console.error(`[AgentReplyMessageCreated] Provider create error:`, error?.message || error);
      await this.ack();
      return;
    }

    const assistantId = agentProfile.modelProvider === 'openai' ? agentProfile.providerAgentId : undefined;
    const providerRequest = {
      message: messageWithContext,
      systemPrompt,
      modelName: agentProfile.modelName,
      temperature: 0.7,
      maxTokens: 1000,
      tools: agentProfile.tools,
      assistantId,
      threadId,
    };

    const limit = await costTrackingService.assertWithinLimits(agentProfile.ownerUserId);
    if (!limit.ok) {
      await new AiMessageReplyPublisher(kafkaWrapper.producer).publish({
        originalMessageId: replyMessageId,
        roomId,
        agentId,
        ownerUserId: agentProfile.ownerUserId,
        content: limit.message,
        replyToMessageId: data.replyToMessageId || undefined,
      });
      await this.ack();
      return;
    }

    const response = await costTrackingService.trackGenerateResponse(
      {
        idempotencyKey: `ai:reply_to_agent:${replyMessageId}:${agentId}`,
        ownerUserId: agentProfile.ownerUserId,
        agentId,
        feature: 'reply_to_agent',
        provider: agentProfile.modelProvider,
        modelName: agentProfile.modelName,
        request: providerRequest,
        metadata: {
          roomId,
          replyMessageId,
          replyToMessageId: data.replyToMessageId,
        },
      },
      () => provider.generateResponse(providerRequest)
    );

    if (response.error || !response.content) {
      console.error(`[AgentReplyMessageCreated] Provider response error:`, response.error);
      await this.ack();
      return;
    }

    await new AiMessageReplyPublisher(kafkaWrapper.producer).publish({
      originalMessageId: replyMessageId,
      roomId,
      agentId,
      ownerUserId: agentProfile.ownerUserId,
      content: response.content,
      replyToMessageId: data.replyToMessageId || undefined,
    });

    await this.ack();
  }
}


