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
const agent_projection_1 = require("../../models/agent-projection");
/**
 * Listens to AgentIngestedEvent to build local agent projections
 * This allows agent matching without direct API calls
 */
class AgentIngestedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentIngested;
        this.groupId = 'ai-chat-host-agent-ingested';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, agentId, character, profile } = data;
            console.log(`[AgentIngestedListener] Processing agent ${agentId || id}`);
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
                const personality = (character === null || character === void 0 ? void 0 : character.personality) || [];
                // Tags derived from other fields (character.tags doesn't exist in event type)
                const tags = [];
                if (specialization)
                    tags.push(specialization);
                if (profession)
                    tags.push(profession);
                if (title)
                    tags.push(title);
                if (interests.length > 0)
                    tags.push(...interests.slice(0, 5)); // Limit to avoid too many tags
                // Get ownerUserId from the event or profile
                const ownerUserId = data.ownerUserId || '';
                // Check if projection already exists
                let projection = yield agent_projection_1.AgentProjection.findOne({ agentId: agentId || id });
                if (projection) {
                    // Update existing projection
                    projection.name = name;
                    projection.displayName = displayName;
                    projection.title = title;
                    projection.profession = profession;
                    projection.specialization = specialization;
                    projection.interests = interests;
                    projection.skills = skills;
                    projection.tags = tags;
                    projection.personality = personality;
                    projection.isActive = true; // Assume active if ingested
                    projection.isPublic = true; // Default to public (isPublic not in character type)
                    projection.lastUpdatedAt = new Date();
                    yield projection.save();
                    console.log(`[AgentIngestedListener] ✅ Updated agent projection for ${agentId || id}`);
                }
                else {
                    // Create new projection
                    const newProjection = agent_projection_1.AgentProjection.build({
                        agentId: agentId || id,
                        ownerUserId,
                        name,
                        displayName,
                        title,
                        profession,
                        specialization,
                        interests,
                        skills,
                        tags,
                        personality,
                        isActive: true,
                        isPublic: true, // Default to public (isPublic not in character type)
                        lastUpdatedAt: new Date(),
                    });
                    yield newProjection.save();
                    // Re-fetch to get the full document type
                    projection = yield agent_projection_1.AgentProjection.findOne({ agentId: agentId || id });
                    console.log(`[AgentIngestedListener] ✅ Created agent projection for ${agentId || id}`);
                }
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
