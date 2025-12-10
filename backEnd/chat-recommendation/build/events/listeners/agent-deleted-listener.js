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
exports.AgentDeletedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const feature_store_1 = require("../../services/feature-store");
const agent_feature_1 = require("../../models/agent-feature");
/**
 * AgentDeletedListener
 *
 * Handles AgentDeletedEvent - marks agent as inactive when deleted
 * This ensures we don't recommend deleted agents
 */
class AgentDeletedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentDeleted;
        this.groupId = 'recommendation-agent-deleted';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = data;
            console.log(`[AgentDeletedListener] Processing agent ${id} - deleted`);
            try {
                // Mark agent as Failed - agent was deleted (can't be recommended)
                yield feature_store_1.featureStore.updateAgentFeatures(id, {
                    isActive: false, // Deprecated: Use provisioningStatus
                    provisioningStatus: agent_feature_1.AgentProvisioningStatus.Failed, // CRITICAL: Mark as Failed - agent was deleted
                });
                console.log(`[AgentDeletedListener] ✅ Marked agent ${id} as Failed (deleted)`);
            }
            catch (error) {
                console.error(`[AgentDeletedListener] ❌ Error processing agent ${id}:`, error);
                throw error; // Re-throw to trigger retry
            }
            yield this.ack();
        });
    }
}
exports.AgentDeletedListener = AgentDeletedListener;
