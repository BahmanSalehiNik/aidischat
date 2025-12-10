import { Listener, Subjects, MessageCreatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { messageWindowManager } from '../../services/message-window-manager';
import { analysisTrigger } from '../../services/analysis-trigger';
import { nlpAnalyzer } from '../../services/nlp-analyzer';
import { agentMatcher } from '../../services/agent-matcher';
import { invitationCoordinator } from '../../services/invitation-coordinator';
import { RoomAnalysisState } from '../../models/room-analysis-state';
import { RoomAnalysisResult } from '../../models/room-analysis-result';

export class MessageCreatedListener extends Listener<MessageCreatedEvent> {
  readonly topic = Subjects.MessageCreated;
  readonly groupId = 'ai-chat-host-message-created';

  async onMessage(data: MessageCreatedEvent['data'], payload: EachMessagePayload) {
    const { id, roomId, content, senderId, senderType, createdAt } = data;

    // Only process human messages (agents don't need analysis)
    if (senderType !== 'human') {
      await this.ack();
      return;
    }

    console.log(`[MessageCreatedListener] Processing human message ${id} in room ${roomId}`);

    try {
      // 1. Add message to window
      const window = await messageWindowManager.addMessage(roomId, {
        id,
        content: content || '',
        senderId,
        senderType,
        createdAt: createdAt || new Date().toISOString(),
      });

      // 2. Get or create room analysis state
      let state = await RoomAnalysisState.findOne({ roomId });
      if (!state) {
        const newState = RoomAnalysisState.build({ roomId });
        await newState.save();
        state = await RoomAnalysisState.findOne({ roomId });
      }

      // Ensure state is not null (TypeScript guard)
      if (!state) {
        console.error(`[MessageCreatedListener] Failed to create state for room ${roomId}`);
        await this.ack();
        return;
      }

      // 3. Check if analysis should be triggered
      const shouldAnalyze = await analysisTrigger.shouldAnalyze(window, state);
      
      if (!shouldAnalyze) {
        console.log(`[MessageCreatedListener] Analysis not triggered for room ${roomId}`);
        await this.ack();
        return;
      }

      // 4. Check rate limiting
      const rateLimitOk = await analysisTrigger.checkRateLimit(state);
      if (!rateLimitOk) {
        console.log(`[MessageCreatedListener] Rate limit exceeded for room ${roomId}`);
        await this.ack();
        return;
      }

      console.log(`[MessageCreatedListener] 🔍 Triggering analysis for room ${roomId}`);

      // 5. Perform NLP analysis
      const analysis = await nlpAnalyzer.analyze(window);
      console.log(`[MessageCreatedListener] Analysis complete for room ${roomId}:`, {
        topics: analysis.topics,
        sentiment: analysis.sentiment.overall,
        intent: analysis.context.intent,
        domain: analysis.context.domain,
        confidence: analysis.confidence,
      });

      // 6. Find relevant agents
      const agentMatches = await agentMatcher.findRelevantAgents(analysis, roomId);
      console.log(`[MessageCreatedListener] Found ${agentMatches.length} agent matches for room ${roomId}`);

      // 7. Invite agents
      if (agentMatches.length > 0) {
        await invitationCoordinator.inviteAgents(agentMatches, roomId, analysis);
      }

      // 8. Save analysis result
      const analysisResult = RoomAnalysisResult.build({
        roomId,
        analyzedAt: new Date(),
        messageWindowSize: window.messages.length,
        topics: analysis.topics,
        sentiment: analysis.sentiment,
        context: analysis.context,
        matchedAgentIds: agentMatches.map(m => m.agentId),
        invitedAgentIds: agentMatches.slice(0, 2).map(m => m.agentId), // Top 2
        invitationReason: agentMatches[0]?.matchReasons.join(', ') || 'no_match',
        confidence: analysis.confidence,
      });
      await analysisResult.save();

      // 9. Update room analysis state
      state.lastAnalysisAt = new Date();
      state.totalAnalyses += 1;
      state.activeWindowSize = window.messages.length;
      await analysisTrigger.setCooldown(roomId, state);
      await state.save();

      console.log(`[MessageCreatedListener] ✅ Analysis and invitation complete for room ${roomId}`);

    } catch (error: any) {
      console.error(`[MessageCreatedListener] ❌ Error processing message ${id} for room ${roomId}:`, error);
      // Don't throw - acknowledge to prevent infinite retries
      // Log error for monitoring
    }

    await this.ack();
  }
}

