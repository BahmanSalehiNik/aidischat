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
exports.AgentCreationFailedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const feature_store_1 = require("../../services/feature-store");
const agent_feature_1 = require("../../models/agent-feature");
/**
 * AgentCreationFailedListener
 *
 * Handles AgentCreationFailedEvent - marks agent as inactive when provisioning fails
 * This ensures we don't recommend agents that failed to be created by the AI provider
 */
class AgentCreationFailedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentCreationFailed;
        this.groupId = 'recommendation-agent-creation-failed';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, agentId, reason } = data;
            console.log(`[AgentCreationFailedListener] Processing agent ${agentId || id} - provisioning failed: ${reason}`);
            try {
                // Mark agent as Failed - provisioning failed, so agent is not ready
                yield feature_store_1.featureStore.updateAgentFeatures(agentId || id, {
                    isActive: false, // Deprecated: Use provisioningStatus
                    provisioningStatus: agent_feature_1.AgentProvisioningStatus.Failed, // CRITICAL: Mark as Failed - agent provisioning failed
                });
                console.log(`[AgentCreationFailedListener] ✅ Marked agent ${agentId || id} as Failed (provisioning failed)`);
            }
            catch (error) {
                console.error(`[AgentCreationFailedListener] ❌ Error processing agent ${agentId || id}:`, error);
                throw error; // Re-throw to trigger retry
            }
            yield this.ack();
        });
    }
}
exports.AgentCreationFailedListener = AgentCreationFailedListener;
