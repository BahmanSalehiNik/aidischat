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
const agent_projection_1 = require("../../models/agent-projection");
/**
 * Listens to AgentUpdatedEvent to update agent projections
 */
class AgentUpdatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentUpdated;
        this.groupId = 'ai-chat-host-agent-updated';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = data;
            console.log(`[AgentUpdatedListener] Agent ${id} updated - marking projection for refresh`);
            try {
                // Note: AgentUpdatedEvent doesn't include full profile data
                // We'll mark the projection as needing refresh, or wait for next AgentIngestedEvent
                // For now, we'll just update the lastUpdatedAt timestamp
                const projection = yield agent_projection_1.AgentProjection.findOne({ agentId: id });
                if (projection) {
                    projection.lastUpdatedAt = new Date();
                    yield projection.save();
                    console.log(`[AgentUpdatedListener] ✅ Updated timestamp for agent projection ${id}`);
                }
                else {
                    console.log(`[AgentUpdatedListener] No projection found for agent ${id}, will be created on next AgentIngestedEvent`);
                }
            }
            catch (error) {
                console.error(`[AgentUpdatedListener] ❌ Error processing agent update ${id}:`, error);
                // Don't throw - this is not critical
            }
            yield this.ack();
        });
    }
}
exports.AgentUpdatedListener = AgentUpdatedListener;
