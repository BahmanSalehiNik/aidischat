"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const message_window_manager_1 = require("../../services/message-window-manager");
const analysis_trigger_1 = require("../../services/analysis-trigger");
const nlp_analyzer_1 = require("../../services/nlp-analyzer");
const agent_matcher_1 = require("../../services/agent-matcher");
const invitation_coordinator_1 = require("../../services/invitation-coordinator");
const room_analysis_state_1 = require("../../models/room-analysis-state");
const room_analysis_result_1 = require("../../models/room-analysis-result");
class MessageCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.MessageCreated;
        this.groupId = 'ai-chat-host-message-created';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id, roomId, content, senderId, senderType, createdAt } = data;
            // Only process human messages (agents don't need analysis)
            if (senderType !== 'human') {
                yield this.ack();
                return;
            }
            console.log(`[MessageCreatedListener] Processing human message ${id} in room ${roomId}`);
            try {
                // 1. Add message to window
                const window = yield message_window_manager_1.messageWindowManager.addMessage(roomId, {
                    id,
                    content: content || '',
                    senderId,
                    senderType,
                    createdAt: createdAt || new Date().toISOString(),
                });
                // 2. Get or create room analysis state
                let state = yield room_analysis_state_1.RoomAnalysisState.findOne({ roomId });
                if (!state) {
                    const newState = room_analysis_state_1.RoomAnalysisState.build({ roomId });
                    yield newState.save();
                    state = yield room_analysis_state_1.RoomAnalysisState.findOne({ roomId });
                }
                // Ensure state is not null (TypeScript guard)
                if (!state) {
                    console.error(`[MessageCreatedListener] Failed to create state for room ${roomId}`);
                    yield this.ack();
                    return;
                }
                // 3. Check if analysis should be triggered
                const shouldAnalyze = yield analysis_trigger_1.analysisTrigger.shouldAnalyze(window, state);
                if (!shouldAnalyze) {
                    console.log(`[MessageCreatedListener] Analysis not triggered for room ${roomId}`);
                    yield this.ack();
                    return;
                }
                // 4. Check rate limiting
                const rateLimitOk = yield analysis_trigger_1.analysisTrigger.checkRateLimit(state);
                if (!rateLimitOk) {
                    console.log(`[MessageCreatedListener] Rate limit exceeded for room ${roomId}`);
                    yield this.ack();
                    return;
                }
                console.log(`[MessageCreatedListener] 🔍 Triggering analysis for room ${roomId}`);
                // 5. Perform NLP analysis
                const analysis = yield nlp_analyzer_1.nlpAnalyzer.analyze(window);
                console.log(`[MessageCreatedListener] Analysis complete for room ${roomId}:`, {
                    topics: analysis.topics,
                    sentiment: analysis.sentiment.overall,
                    intent: analysis.context.intent,
                    domain: analysis.context.domain,
                    confidence: analysis.confidence,
                });
                // 6. Find relevant agents
                const agentMatches = yield agent_matcher_1.agentMatcher.findRelevantAgents(analysis, roomId);
                console.log(`[MessageCreatedListener] Found ${agentMatches.length} agent matches for room ${roomId}`);
                // 7. Invite agents
                if (agentMatches.length > 0) {
                    yield invitation_coordinator_1.invitationCoordinator.inviteAgents(agentMatches, roomId, analysis);
                }
                // 8. Save analysis result
                const analysisResult = room_analysis_result_1.RoomAnalysisResult.build({
                    roomId,
                    analyzedAt: new Date(),
                    messageWindowSize: window.messages.length,
                    topics: analysis.topics,
                    sentiment: analysis.sentiment,
                    context: analysis.context,
                    matchedAgentIds: agentMatches.map(m => m.agentId),
                    invitedAgentIds: agentMatches.slice(0, 2).map(m => m.agentId), // Top 2
                    invitationReason: ((_a = agentMatches[0]) === null || _a === void 0 ? void 0 : _a.matchReasons.join(', ')) || 'no_match',
                    confidence: analysis.confidence,
                });
                yield analysisResult.save();
                // 9. Update room analysis state
                state.lastAnalysisAt = new Date();
                state.totalAnalyses += 1;
                state.activeWindowSize = window.messages.length;
                yield analysis_trigger_1.analysisTrigger.setCooldown(roomId, state);
                yield state.save();
                console.log(`[MessageCreatedListener] ✅ Analysis and invitation complete for room ${roomId}`);
            }
            catch (error) {
                console.error(`[MessageCreatedListener] ❌ Error processing message ${id} for room ${roomId}:`, error);
                // Don't throw - acknowledge to prevent infinite retries
                // Log error for monitoring
            }
            yield this.ack();
        });
    }
}
exports.MessageCreatedListener = MessageCreatedListener;
