// src/events/listeners/agent-feed-scanned-listener.ts
import { Listener, Subjects, AgentFeedScannedEvent, EachMessagePayload } from '@aichatwar/shared';
import { AgentProfile, AgentProfileStatus } from '../../models/agent-profile';
import { ProviderFactory } from '../../providers/provider-factory';
import { PromptBuilder, CharacterAttributes } from '../../prompt-engineering';
import { AgentFeedDigestedPublisher, AgentFeedAnswerReceivedPublisher } from '../publishers/agent-feed-publishers';
import { kafkaWrapper } from '../../kafka-client';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// In-memory storage for feed analysis thread IDs (TODO: Move to database)
// Key: agentId, Value: threadId
const feedAnalysisThreads = new Map<string, string>();

export class AgentFeedScannedListener extends Listener<AgentFeedScannedEvent> {
  readonly topic = Subjects.AgentFeedScanned;
  readonly groupId = 'ai-gateway-agent-feed-scanned';
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentFeedScannedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, ownerUserId, scanId, feedData, scanTimestamp, scanInterval } = data;
    const correlationId = uuidv4();
    const startTime = Date.now();

    console.log(`[AgentFeedScannedListener] Received feed scan for agent ${agentId} (scanId: ${scanId})`);

    // Check if URLs are signed (have SAS tokens) - if not, skip (Agent-manager will sign and republish)
    const hasUnsignedUrls = feedData.posts.some(post => 
      post.media?.some(mediaItem => {
        const url = mediaItem.url || '';
        // Check if it's an Azure blob URL without SAS token (no ?sig= or ?sv=)
        return url.includes('.blob.core.windows.net') && !url.includes('?sig=') && !url.includes('&sig=');
      })
    );

    if (hasUnsignedUrls) {
      console.log(`[AgentFeedScannedListener] ⏭️  Skipping event with unsigned URLs - waiting for Agent-manager to sign and republish (scanId: ${scanId})`);
      await this.ack();
      return;
    }

    try {
      // Publish digested event (status: processing)
      await new AgentFeedDigestedPublisher(kafkaWrapper.producer).publish({
        scanId,
        agentId,
        digestedAt: new Date().toISOString(),
        status: 'processing',
      });

      // Fetch agent profile to get model configuration
      const agentProfile = await AgentProfile.findByAgentId(agentId);

      if (!agentProfile) {
        console.warn(`[AgentFeedScannedListener] Agent profile not found for agent ${agentId}, skipping`);
        await new AgentFeedDigestedPublisher(kafkaWrapper.producer).publish({
          scanId,
          agentId,
          digestedAt: new Date().toISOString(),
          status: 'error',
          error: 'Agent profile not found',
        });
        await this.ack();
        return;
      }

      if (agentProfile.status !== AgentProfileStatus.Active) {
        console.warn(`[AgentFeedScannedListener] Agent ${agentId} profile status is ${agentProfile.status}. Skipping feed processing.`);
        await new AgentFeedDigestedPublisher(kafkaWrapper.producer).publish({
          scanId,
          agentId,
          digestedAt: new Date().toISOString(),
          status: 'error',
          error: `Agent status is ${agentProfile.status}, not active`,
        });
        await this.ack();
        return;
      }

      // Extract character attributes from metadata
      const characterAttributes: CharacterAttributes | undefined = agentProfile.metadata?.character;

      // Build feed analysis prompt
      const feedAnalysisPrompt = this.buildFeedAnalysisPrompt(
        agentProfile.systemPrompt,
        characterAttributes,
        feedData
      );

      // Get API key and endpoint
      const apiKey = agentProfile.apiKey || this.getApiKeyFromEnv(agentProfile.modelProvider);
      const endpoint = agentProfile.endpoint || this.getEndpointFromEnv(agentProfile.modelProvider);

      // Create provider instance
      let provider;
      try {
        provider = ProviderFactory.createProvider(
          agentProfile.modelProvider,
          apiKey,
          endpoint
        );
      } catch (error: any) {
        console.error(`[AgentFeedScannedListener] Failed to create provider for agent ${agentId}:`, error);
        await new AgentFeedDigestedPublisher(kafkaWrapper.producer).publish({
          scanId,
          agentId,
          digestedAt: new Date().toISOString(),
          status: 'error',
          error: `Failed to create provider: ${error.message}`,
        });
        await this.ack();
        return;
      }

      // For OpenAI, use the same assistant (providerAgentId) with a dedicated analysis thread
      const assistantId = agentProfile.modelProvider === 'openai' ? agentProfile.providerAgentId : undefined;

      // Get or create analysis thread for this agent
      let analysisThreadId: string | undefined;
      if (assistantId && agentProfile.modelProvider === 'openai') {
        analysisThreadId = await this.getOrCreateAnalysisThread(
          agentId,
          assistantId,
          apiKey
        );
        if (!analysisThreadId) {
          throw new Error('Failed to get or create analysis thread');
        }
      }

      console.log(`[AgentFeedScannedListener] Calling provider.generateResponse for agent ${agentId} feed analysis:`, {
        modelProvider: agentProfile.modelProvider,
        modelName: agentProfile.modelName,
        assistantId: assistantId,
        hasAssistantId: !!assistantId,
        threadId: analysisThreadId,
        willUseAssistantsAPI: agentProfile.modelProvider === 'openai' && !!assistantId && !!analysisThreadId,
      });

      // Generate response using the provider
      // Use same assistant/model as chat to ensure consistency
      const response = await provider.generateResponse({
        message: feedAnalysisPrompt,
        systemPrompt: agentProfile.systemPrompt, // Base system prompt (character details already in assistant for OpenAI)
        modelName: agentProfile.modelName,
        temperature: 0.7,
        maxTokens: 2000, // Higher limit for JSON response
        tools: agentProfile.tools,
        assistantId: assistantId, // Use same assistant as chat
        threadId: analysisThreadId, // Use dedicated analysis thread
      });

      if (response.error || !response.content) {
        console.error(`[AgentFeedScannedListener] Failed to generate response for agent ${agentId}:`, response.error);
        await new AgentFeedDigestedPublisher(kafkaWrapper.producer).publish({
          scanId,
          agentId,
          digestedAt: new Date().toISOString(),
          status: 'error',
          error: response.error || 'No response content',
        });
        await this.ack();
        return;
      }

      // Parse JSON response
      let parsedResponse: any;
      try {
        // Try to extract JSON from response (might be wrapped in markdown code blocks)
        const jsonMatch = response.content.match(/```json\s*([\s\S]*?)\s*```/) || response.content.match(/```\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : response.content;
        parsedResponse = JSON.parse(jsonString.trim());
      } catch (parseError: any) {
        console.error(`[AgentFeedScannedListener] Failed to parse JSON response for agent ${agentId}:`, {
          error: parseError.message,
          response: response.content.substring(0, 500), // Log first 500 chars
        });
        await new AgentFeedDigestedPublisher(kafkaWrapper.producer).publish({
          scanId,
          agentId,
          digestedAt: new Date().toISOString(),
          status: 'error',
          error: `Failed to parse JSON response: ${parseError.message}`,
        });
        await this.ack();
        return;
      }

      // Validate response structure
      if (!this.validateFeedResponse(parsedResponse)) {
        console.error(`[AgentFeedScannedListener] Invalid response structure for agent ${agentId}:`, parsedResponse);
        await new AgentFeedDigestedPublisher(kafkaWrapper.producer).publish({
          scanId,
          agentId,
          digestedAt: new Date().toISOString(),
          status: 'error',
          error: 'Invalid response structure',
        });
        await this.ack();
        return;
      }

      const processingTimeMs = Date.now() - startTime;

      // Publish agent.feed.answer.received event
      // Note: The event structure matches AgentFeedAnswerReceivedEvent from shared package
      // Include feedEntryIds in metadata so feed service can mark them as seen
      await new AgentFeedAnswerReceivedPublisher(kafkaWrapper.producer).publish({
        scanId,
        agentId,
        ownerUserId,
        correlationId,
        response: parsedResponse, // Use parsed response directly (matches event interface)
        metadata: {
          modelProvider: agentProfile.modelProvider,
          modelName: agentProfile.modelName,
          tokensUsed: response.usage?.totalTokens,
          processingTimeMs,
          feedEntryIds: data.feedEntryIds, // Forward feedEntryIds so feed service can mark as seen
        },
        timestamp: new Date().toISOString(),
      });

      // Publish digested event (status: completed) - Note: event interface doesn't have 'completed', use 'processing' or omit
      // Actually, the event interface only has 'processing' | 'queued' | 'error', so we'll skip publishing completed status

      console.log(`[AgentFeedScannedListener] ✅ Published agent.feed.answer.received for agent ${agentId} (scanId: ${scanId}, processingTime: ${processingTimeMs}ms)`);

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentFeedScannedListener] ❌ Error processing feed scan for agent ${agentId}:`, {
        error: error.message,
        stack: error.stack,
        scanId,
      });

      // Publish error event
      await new AgentFeedDigestedPublisher(kafkaWrapper.producer).publish({
        scanId,
        agentId,
        digestedAt: new Date().toISOString(),
        status: 'error',
        error: error.message || 'Unknown error',
      }).catch((publishError) => {
        console.error(`[AgentFeedScannedListener] Failed to publish error event:`, publishError);
      });

      // Don't ack on error - let Kafka retry
      throw error;
    }
  }

  /**
   * Get or create a dedicated analysis thread for feed analysis
   * For now, stores thread ID in memory (TODO: Move to database)
   */
  private async getOrCreateAnalysisThread(
    agentId: string,
    assistantId: string,
    apiKey?: string
  ): Promise<string | undefined> {
    try {
      // Check if thread already exists in memory
      const existingThreadId = feedAnalysisThreads.get(agentId);
      if (existingThreadId) {
        console.log(`[AnalysisThread] Using existing analysis thread ${existingThreadId} for agent ${agentId}`);
        return existingThreadId;
      }

      // Create new thread via OpenAI API
      if (!apiKey) {
        apiKey = this.getApiKeyFromEnv('openai');
      }
      if (!apiKey) {
        throw new Error('OpenAI API key is required to create analysis thread');
      }

      const openaiClient = new OpenAI({ apiKey });
      const thread = await openaiClient.beta.threads.create();
      console.log(`[AnalysisThread] ✅ Created new analysis thread ${thread.id} for agent ${agentId} with assistant ${assistantId}`);

      // Store thread ID in memory (TODO: Move to database - see todo file)
      feedAnalysisThreads.set(agentId, thread.id);

      return thread.id;
    } catch (error: any) {
      console.error(`[AnalysisThread] Failed to get or create analysis thread for agent ${agentId}:`, error);
      return undefined;
    }
  }

  /**
   * Build feed analysis prompt with character context
   */
  private buildFeedAnalysisPrompt(
    baseSystemPrompt: string,
    characterAttributes: CharacterAttributes | undefined,
    feedData: AgentFeedScannedEvent['data']['feedData']
  ): string {
    // Build character context (same as chat messages)
    let systemPrompt = baseSystemPrompt;

    // Enhance system prompt for non-OpenAI providers (OpenAI already has it in assistant)
    // For feed analysis, we want full character context
    if (characterAttributes) {
      systemPrompt = PromptBuilder.buildSystemPrompt(
        baseSystemPrompt,
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

    // Format feed data as JSON
    const feedDataJson = JSON.stringify(feedData, null, 2);

    // Calculate limits based on batch size
    const numPosts = feedData.posts.length;
    // Random between 1 and 2 posts
    const maxNewPosts = Math.floor(Math.random() * 2) + 1; // Random: 1 or 2
    const maxComments = numPosts; // Max comments = number of posts in batch
    const maxReactions = numPosts; // Max reactions = number of posts in batch

    // Build the feed analysis prompt
    const prompt = `You are analyzing your social media feed to generate appropriate responses.

Here is recent activity from your feed (as JSON):

${feedDataJson}

CRITICAL REQUIREMENTS:
1. **IMAGES AND MEDIA**: 
   - Each post in the feed data may contain a "media" array with image URLs
   - These URLs are publicly accessible signed URLs that you CAN and MUST open/view
   - You MUST examine the images in posts to understand the full context
   - When a post has images, your responses (comments, reactions, new posts) MUST reference and relate to what you see in those images
   - Example: If a post shows a cat photo, your comment should mention the cat, its appearance, or something specific about the image
   - You can access these URLs directly - they are valid and accessible for the next 2 hours

2. **Content must be directly related to the feed batch**: All generated content MUST relate to the topics, themes, and content in the feed posts above. For example:
   - If the feed contains posts about cats, generate cat-related posts, comments, and reactions
   - If the feed contains posts about technology, generate technology-related content
   - Your responses should show you've read and understood the feed content, INCLUDING any images

2. **Strict limits** (based on ${numPosts} posts in this batch):
   - Generate ${maxNewPosts} new post(s) maximum (1-2 posts)
   - Generate up to ${maxComments} comment(s) maximum (one per post in batch)
   - Generate up to ${maxReactions} reaction(s) maximum (one per post in batch)
   - Generate 0-2 connection requests maximum

3. **Comment requirements**:
   - Comments MUST reference specific posts from the feed using their exact postId
   - Each comment's postId MUST be one of the post IDs from the feed data above
   - Comments should be relevant to the specific post they're commenting on
   - Example: If feed has post with id "abc123" about cats, your comment should reference "abc123" and be about cats

4. **Reaction requirements**:
   - Reactions MUST reference specific posts from the feed using their exact postId
   - Each reaction's postId MUST be one of the post IDs from the feed data above
   - Choose reaction types that make sense for the content (like, love, haha, sad, angry)

5. **Post requirements**:
   - New posts should be inspired by or related to the topics in the feed batch
   - If feed is about cats, create cat-related posts
   - If feed is about technology, create technology-related posts
   - Keep posts authentic to your character while staying relevant to feed themes

IMPORTANT:
- You can search the internet for images/media. If you want to include media in a post, provide the public URL.
- Media URLs must be publicly accessible (e.g., from Unsplash, Pexels, or other public image services).
- Keep responses authentic to your character.
- DO NOT generate more than the limits specified above.

Return your response as JSON in this exact format:
{
  "posts": [
    {
      "content": "Your post text here (related to feed topics)",
      "visibility": "public|friends|private",
      "mediaUrls": ["https://example.com/image.jpg"]
    }
  ],
  "comments": [
    {
      "postId": "MUST-BE-EXACT-POST-ID-FROM-FEED-ABOVE",
      "content": "Your comment here (relevant to that specific post)"
    }
  ],
  "reactions": [
    {
      "postId": "MUST-BE-EXACT-POST-ID-FROM-FEED-ABOVE",
      "type": "like|love|haha|sad|angry"
    }
  ],
  "connectionRequests": [
    {
      "userId": "user-id-from-feed",
      "message": "Optional message"
    }
  ]
}`;

    return prompt;
  }

  /**
   * Validate feed response structure
   */
  private validateFeedResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    // Validate posts
    if (response.posts) {
      if (!Array.isArray(response.posts)) return false;
      for (const post of response.posts) {
        if (!post.content || typeof post.content !== 'string') return false;
        if (post.visibility && !['public', 'friends', 'private'].includes(post.visibility)) return false;
        if (post.mediaUrls && !Array.isArray(post.mediaUrls)) return false;
      }
    }

    // Validate comments
    if (response.comments) {
      if (!Array.isArray(response.comments)) return false;
      for (const comment of response.comments) {
        if (!comment.postId || !comment.content) return false;
      }
    }

    // Validate reactions
    if (response.reactions) {
      if (!Array.isArray(response.reactions)) return false;
      for (const reaction of response.reactions) {
        if (!reaction.type || !['like', 'love', 'haha', 'sad', 'angry'].includes(reaction.type)) return false;
        if (!reaction.postId && !reaction.commentId) return false;
      }
    }

    // Validate connection requests
    if (response.connectionRequests) {
      if (!Array.isArray(response.connectionRequests)) return false;
      for (const request of response.connectionRequests) {
        if (!request.userId) return false;
      }
    }

    return true;
  }

  /**
   * Parse suggestions from parsed response
   */
  private parseSuggestions(parsedResponse: any): Array<{
    type: 'post' | 'comment' | 'reaction' | 'connection_request';
    content?: string;
    mediaUrls?: string[];
    targetId?: string;
    reactionType?: 'like' | 'love' | 'haha' | 'sad' | 'angry';
    targetUserId?: string;
    confidence?: number;
    reason?: string;
  }> {
    const suggestions: Array<{
      type: 'post' | 'comment' | 'reaction' | 'connection_request';
      content?: string;
      mediaUrls?: string[];
      targetId?: string;
      reactionType?: 'like' | 'love' | 'haha' | 'sad' | 'angry';
      targetUserId?: string;
      confidence?: number;
      reason?: string;
    }> = [];

    // Parse posts
    if (parsedResponse.posts && Array.isArray(parsedResponse.posts)) {
      for (const post of parsedResponse.posts) {
        suggestions.push({
          type: 'post',
          content: post.content,
          mediaUrls: post.mediaUrls || [],
        });
      }
    }

    // Parse comments
    if (parsedResponse.comments && Array.isArray(parsedResponse.comments)) {
      for (const comment of parsedResponse.comments) {
        suggestions.push({
          type: 'comment',
          content: comment.content,
          targetId: comment.postId,
        });
      }
    }

    // Parse reactions
    if (parsedResponse.reactions && Array.isArray(parsedResponse.reactions)) {
      for (const reaction of parsedResponse.reactions) {
        suggestions.push({
          type: 'reaction',
          reactionType: reaction.type,
          targetId: reaction.postId || reaction.commentId,
        });
      }
    }

    // Parse connection requests
    if (parsedResponse.connectionRequests && Array.isArray(parsedResponse.connectionRequests)) {
      for (const request of parsedResponse.connectionRequests) {
        suggestions.push({
          type: 'connection_request',
          targetUserId: request.userId,
          content: request.message,
        });
      }
    }

    return suggestions;
  }

  /**
   * Get API key from environment variables
   */
  private getApiKeyFromEnv(provider: string): string | undefined {
    switch (provider) {
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

  /**
   * Get endpoint from environment variables
   */
  private getEndpointFromEnv(provider: string): string | undefined {
    if (provider === 'local' || provider === 'custom') {
      return process.env.LOCAL_LLM_ENDPOINT;
    }
    return undefined;
  }
}

