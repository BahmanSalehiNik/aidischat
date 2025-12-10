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
exports.AgentIngestedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const feature_store_1 = require("../../services/feature-store");
const agent_feature_1 = require("../../models/agent-feature");
/**
 * AgentIngestedListener
 *
 * Builds agent feature projections from AgentIngestedEvent
 * This populates the feature store used for recommendations
 */
class AgentIngestedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentIngested;
        this.groupId = 'recommendation-agent-ingested';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, agentId, character, profile } = data;
            console.log(`[AgentIngestedListener] Processing agent ${agentId || id} for feature store`);
            try {
                // Extract character/profile data
                const name = (character === null || character === void 0 ? void 0 : character.name) || 'Unknown Agent';
                const displayName = character === null || character === void 0 ? void 0 : character.displayName;
                const title = character === null || character === void 0 ? void 0 : character.title;
                const profession = character === null || character === void 0 ? void 0 : character.profession;
                const specialization = character === null || character === void 0 ? void 0 : character.specialization;
                // Extract tags/interests from character data
                const interests = (character === null || character === void 0 ? void 0 : character.interests) || [];
                const skills = (character === null || character === void 0 ? void 0 : character.skills) || [];
                // Tags can be derived from other fields (character.tags doesn't exist in event)
                // We'll derive tags from specialization, profession, title, interests
                const tags = [];
                // Note: character.tags is not in AgentIngestedEvent interface
                // We derive tags from other fields
                if (specialization)
                    tags.push(specialization);
                if (profession)
                    tags.push(profession);
                if (title)
                    tags.push(title);
                if (interests.length > 0)
                    tags.push(...interests.slice(0, 5)); // Limit to avoid too many tags
                // Language from character (if available) - not in event, default to English
                const language = 'en'; // Default to English (language not in AgentIngestedEvent character)
                // Update agent features in feature store
                // IMPORTANT: Set provisioningStatus: Pending - agent is ingested but not yet provisioned
                // Agent will be marked Active when AgentCreatedEvent is received (after successful provisioning)
                yield feature_store_1.featureStore.updateAgentFeatures(agentId || id, {
                    agentId: agentId || id,
                    name,
                    displayName,
                    tags,
                    skills,
                    specialization,
                    profession,
                    popularity: 0, // Will be updated from interactions
                    rating: 0, // Will be updated from feedback
                    isActive: false, // Deprecated: Use provisioningStatus
                    provisioningStatus: agent_feature_1.AgentProvisioningStatus.Pending, // CRITICAL: Not provisioned yet
                    isPublic: true, // Default to true (isPublic not in AgentIngestedEvent character)
                    language,
                });
                console.log(`[AgentIngestedListener] ✅ Updated agent features for ${agentId || id}`);
            }
            catch (error) {
                console.error(`[AgentIngestedListener] ❌ Error processing agent ${agentId || id}:`, error);
                throw error; // Re-throw to trigger retry
            }
            yield this.ack();
        });
    }
}
exports.AgentIngestedListener = AgentIngestedListener;
