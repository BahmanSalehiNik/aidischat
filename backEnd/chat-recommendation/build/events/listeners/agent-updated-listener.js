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
exports.AgentUpdatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const feature_store_1 = require("../../services/feature-store");
/**
 * AgentUpdatedListener
 *
 * Updates agent feature projections when AgentUpdatedEvent is received.
 *
 * Note: AgentUpdatedEvent doesn't include profile/character data.
 * Options:
 * 1. Fetch profile from agents service (requires API call - not ideal)
 * 2. Wait for AgentIngestedEvent to be republished on updates (if implemented)
 * 3. For now, we'll just mark that an update occurred and rely on
 *    AgentIngestedEvent being published on profile updates
 *
 * TODO: Consider enhancing AgentUpdatedEvent to include profile data,
 *       or publish AgentIngestedEvent on profile updates.
 */
class AgentUpdatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentUpdated;
        this.groupId = 'recommendation-agent-updated';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, version } = data;
            console.log(`[AgentUpdatedListener] Processing agent update ${id} (version ${version})`);
            try {
                // Check if agent features exist
                const existing = yield feature_store_1.featureStore.getAgentFeatures(id);
                if (existing) {
                    // Update version timestamp to indicate update occurred
                    // Note: We don't have profile data here, so we can't update tags/skills/etc.
                    // This will be handled by AgentIngestedEvent if it's published on profile updates
                    // For now, we just acknowledge the update
                    console.log(`[AgentUpdatedListener] ✅ Agent ${id} updated (version ${version}) - features exist, profile update will come via AgentIngestedEvent if available`);
                }
                else {
                    // Agent doesn't exist in feature store yet
                    // This shouldn't happen if AgentCreatedListener ran first, but handle gracefully
                    console.log(`[AgentUpdatedListener] ⚠️ Agent ${id} updated but not in feature store yet - will be created by AgentCreatedListener`);
                }
            }
            catch (error) {
                console.error(`[AgentUpdatedListener] ❌ Error processing agent update ${id}:`, error);
                throw error; // Re-throw to trigger retry
            }
            yield this.ack();
        });
    }
}
exports.AgentUpdatedListener = AgentUpdatedListener;
