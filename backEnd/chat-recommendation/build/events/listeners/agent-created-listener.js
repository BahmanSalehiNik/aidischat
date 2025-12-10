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
exports.AgentCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const feature_store_1 = require("../../services/feature-store");
const agent_feature_1 = require("../../models/agent-feature");
/**
 * AgentCreatedListener
 *
 * Builds agent feature projections from AgentCreatedEvent
 * Note: AgentCreatedEvent doesn't include profile/character data,
 * so we initialize with minimal data and wait for AgentIngestedEvent
 * or fetch profile data separately.
 *
 * For now, we'll create a placeholder entry that will be updated
 * when AgentIngestedEvent arrives (which has full profile data).
 */
class AgentCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentCreated;
        this.groupId = 'recommendation-agent-created';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, ownerUserId, version } = data;
            console.log(`[AgentCreatedListener] Processing agent ${id} for feature store`);
            try {
                // AgentCreatedEvent doesn't have profile/character data
                // We'll create a minimal entry that will be updated by AgentIngestedEvent
                // or we could fetch from agents service (but that requires API call)
                // For now, check if agent features already exist (from AgentIngestedEvent)
                // If not, create minimal entry
                const existing = yield feature_store_1.featureStore.getAgentFeatures(id);
                // AgentCreatedEvent is published AFTER successful provisioning
                // This means the agent is now Active and ready to be recommended
                if (!existing) {
                    // Create minimal entry - will be updated by AgentIngestedEvent
                    yield feature_store_1.featureStore.updateAgentFeatures(id, {
                        agentId: id,
                        name: 'Unknown Agent',
                        tags: [],
                        skills: [],
                        popularity: 0,
                        rating: 0,
                        isActive: true, // Deprecated: Use provisioningStatus
                        provisioningStatus: agent_feature_1.AgentProvisioningStatus.Active, // CRITICAL: Successfully provisioned
                        isPublic: false, // Default to false until we know
                        language: 'en',
                    });
                    console.log(`[AgentCreatedListener] ✅ Created minimal agent features for ${id} (will be updated by AgentIngestedEvent)`);
                }
                else {
                    // Update existing entry to mark as Active (provisioning succeeded)
                    yield feature_store_1.featureStore.updateAgentFeatures(id, {
                        isActive: true, // Deprecated: Use provisioningStatus
                        provisioningStatus: agent_feature_1.AgentProvisioningStatus.Active, // CRITICAL: Mark as Active now that provisioning succeeded
                    });
                    console.log(`[AgentCreatedListener] ✅ Marked agent ${id} as Active (provisioning succeeded)`);
                }
            }
            catch (error) {
                console.error(`[AgentCreatedListener] ❌ Error processing agent ${id}:`, error);
                throw error; // Re-throw to trigger retry
            }
            yield this.ack();
        });
    }
}
exports.AgentCreatedListener = AgentCreatedListener;
