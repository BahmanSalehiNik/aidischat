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
exports.AgentFeedAnswerReceivedListener = void 0;
/**
 * Listener for AgentFeedAnswerReceivedEvent
 * Marks feed entries as "seen" after successful AI processing
 * This ensures the same feed items are not processed again in future scans
 */
const shared_1 = require("@aichatwar/shared");
const feed_1 = require("../../../models/feed/feed");
const queGroupNames_1 = require("../../queGroupNames");
class AgentFeedAnswerReceivedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentFeedAnswerReceived;
        this.groupId = queGroupNames_1.GroupIdAgentFeedAnswerReceived;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const { agentId, scanId, metadata } = data;
            console.log(`[AgentFeedAnswerReceivedListener] Received answer for agent ${agentId} (scanId: ${scanId})`);
            try {
                // Get feedEntryIds from metadata (passed from AgentFeedScannedEvent)
                // The AI Gateway should forward feedEntryIds in the metadata
                const feedEntryIds = metadata === null || metadata === void 0 ? void 0 : metadata.feedEntryIds;
                if (!feedEntryIds || feedEntryIds.length === 0) {
                    console.log(`[AgentFeedAnswerReceivedListener] No feedEntryIds in metadata for scan ${scanId}, skipping status update`);
                    yield this.ack();
                    return;
                }
                // Mark feed entries as "seen" (processed)
                const result = yield feed_1.Feed.updateMany({ _id: { $in: feedEntryIds }, userId: agentId }, { $set: { status: feed_1.FeedStatus.Seen } });
                console.log(`[AgentFeedAnswerReceivedListener] ✅ Marked ${result.modifiedCount} feed entries as seen for agent ${agentId} (scanId: ${scanId})`);
                yield this.ack();
            }
            catch (error) {
                console.error(`[AgentFeedAnswerReceivedListener] ❌ Error marking feed entries as seen:`, {
                    error: error.message,
                    agentId,
                    scanId,
                });
                // Don't throw - ack anyway to avoid blocking the queue
                yield this.ack();
            }
        });
    }
}
exports.AgentFeedAnswerReceivedListener = AgentFeedAnswerReceivedListener;
