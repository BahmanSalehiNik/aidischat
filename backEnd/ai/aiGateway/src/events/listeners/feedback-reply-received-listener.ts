// src/events/listeners/feedback-reply-received-listener.ts
import { EachMessagePayload } from 'kafkajs';
import { Listener, FeedbackReplyReceivedEvent, Subjects } from '@aichatwar/shared';
import { AgentProfile, AgentProfileStatus } from '../../models/agent-profile';
import { ProviderFactory } from '../../providers/provider-factory';
import { PromptBuilder, CharacterAttributes } from '../../prompt-engineering';
import { AiMessageReplyPublisher } from '../publishers/ai-message-reply-publisher';
import { kafkaWrapper } from '../../kafka-client';
import OpenAI from 'openai';
import { AssistantThread } from '../../models/assistant-thread';

function possessive(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "someone's";
  const lower = trimmed.toLowerCase();
  // James' vs Mary's
  return lower.endsWith('s') ? `${trimmed}'` : `${trimmed}'s`;
}

/**
 * Consumes RLHF reply feedback events and forwards them to the AI provider so the agent can respond.
 *
 * Template (requested):
 * - If replying to this agent: "John replied to your message <msg> with: <reply>"
 * - Else: "John replied to Marry's message <msg> with: <reply>"
 */
export class FeedbackReplyReceivedListener extends Listener<FeedbackReplyReceivedEvent> {
  readonly topic = Subjects.FeedbackReplyReceived;
  readonly groupId = 'ai-gateway-feedback-reply-received';

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
        console.log(`[Thread] Using existing thread ${existingThread.threadId} for agent ${agentId} in room ${roomId}`);
        return existingThread.threadId;
      }

      if (!apiKey) apiKey = this.getApiKeyFromEnv('openai');
      if (!apiKey) throw new Error('OpenAI API key is required to create thread');

      const openaiClient = new OpenAI({ apiKey });
      const thread = await openaiClient.beta.threads.create();
      console.log(`[Thread] ✅ Created new thread ${thread.id} for agent ${agentId} in room ${roomId} with assistant ${assistantId}`);

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
      console.error(`[Thread] ❌ Failed to get or create thread for agent ${agentId} in room ${roomId}:`, error?.message || error);
      return undefined;
    }
  }

  async onMessage(data: FeedbackReplyReceivedEvent['data'], payload: EachMessagePayload) {
    const {
      roomId,
      messageId, // this is the REPLY message id
      replyToMessageId,
      agentId,
      agentMessageContent,
      replySenderId,
      replySenderType,
      replySenderName,
      replyContent,
      replyToSenderId,
      replyToSenderName,
      replyToSenderType,
    } = data;

    console.log(`[FeedbackReplyReceived] Received feedback.reply.received:`, {
      roomId,
      messageId,
      replyToMessageId,
      agentId,
      replySenderId,
      replySenderType,
      hasReplySenderName: !!replySenderName,
    });

    // Load agent profile (AI Gateway DB) so we can call provider
    const agentProfile = await AgentProfile.findByAgentId(agentId);
    if (!agentProfile) {
      console.warn(`[FeedbackReplyReceived] No agent profile found for agentId=${agentId}. Skipping provider call.`);
      await this.ack();
      return;
    }

    if (agentProfile.status !== AgentProfileStatus.Active) {
      console.warn(`[FeedbackReplyReceived] Agent ${agentId} profile status is ${agentProfile.status}. Skipping until provisioning completes.`);
      await this.ack();
      return;
    }

    const apiKey = agentProfile.apiKey || this.getApiKeyFromEnv(agentProfile.modelProvider);
    const endpoint = agentProfile.endpoint || this.getEndpointFromEnv(agentProfile.modelProvider);

    // Build the reply-context template message
    const replierName = replySenderName || (replySenderType === 'agent' ? 'Agent' : 'User');
    const repliedToThisAgent = replyToSenderType === 'agent' && (!!replyToSenderId ? replyToSenderId === agentId : true);

    const replyToLabel = repliedToThisAgent
      ? 'your message'
      : `${possessive(replyToSenderName || 'someone')} message`;

    // Requested template (with pronoun switch based on who "owns" the original message)
    // We avoid duplicating the name twice by keeping the sentence starting after the "(human):" prefix.
    const replyTemplate = `replied to ${replyToLabel} "${agentMessageContent}" with: "${replyContent}"`;

    // Ensure provider sees a consistent chat-like line
    const senderLabel = replySenderType === 'agent' ? 'AI' : 'human';
    const formattedMessage = `${replierName}(${senderLabel}): ${replyTemplate}`;

    // Minimal dynamic context only (mirrors AiMessageCreatedListener strategy)
    const characterAttributes: CharacterAttributes | undefined = agentProfile.metadata?.character;
    const messageContext = PromptBuilder.buildMessageContext(characterAttributes, { includePersonality: false, style: 'minimal' });
    const messageWithContext = messageContext ? `${messageContext}${formattedMessage}` : formattedMessage;

    // System prompt: only needed for providers without persistent assistants
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
    let threadId: string | undefined = undefined;
    if (agentProfile.modelProvider === 'openai' && agentProfile.providerAgentId) {
      threadId = await this.getOrCreateThread(roomId, agentId, agentProfile.providerAgentId, apiKey);
      if (!threadId) {
        console.error(`[FeedbackReplyReceived] Failed to get/create thread for agent ${agentId} in room ${roomId}`);
        await this.ack();
        return;
      }
    }

    let provider;
    try {
      provider = ProviderFactory.createProvider(agentProfile.modelProvider, apiKey, endpoint);
    } catch (error: any) {
      console.error(`[FeedbackReplyReceived] Failed to create provider for agent ${agentId}:`, error?.message || error);
      await this.ack();
      return;
    }

    const assistantId = agentProfile.modelProvider === 'openai' ? agentProfile.providerAgentId : undefined;

    const response = await provider.generateResponse({
      message: messageWithContext,
      systemPrompt,
      modelName: agentProfile.modelName,
      temperature: 0.7,
      maxTokens: 1000,
      tools: agentProfile.tools,
      assistantId,
      threadId,
    });

    if (response.error || !response.content) {
      console.error(`[FeedbackReplyReceived] Failed to generate response for agent ${agentId}:`, response.error);
      await this.ack();
      return;
    }

    // Publish ai.message.reply so chat-service ingests/broadcasts the agent response.
    // Use the reply messageId as the "originalMessageId" to apply reply limiting per reply interaction.
    await new AiMessageReplyPublisher(kafkaWrapper.producer).publish({
      originalMessageId: messageId,
      roomId,
      agentId,
      ownerUserId: agentProfile.ownerUserId,
      content: response.content,
    });

    console.log(`[FeedbackReplyReceived] Published ai.message.reply for agent ${agentId} in room ${roomId} (triggered by reply ${messageId})`);

    await this.ack();
  }
}


