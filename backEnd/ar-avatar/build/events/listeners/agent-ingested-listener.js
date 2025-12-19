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
const avatar_service_1 = require("../../services/avatar-service");
const avatar_1 = require("../../models/avatar");
class AgentIngestedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentIngested;
        this.groupId = 'ar-avatar-agent-ingested';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, agentId, character, profile } = data;
            console.log(`[AgentIngestedListener] Received AgentIngestedEvent for agent ${agentId || id}`);
            try {
                // Check if avatar already exists
                const existing = yield avatar_service_1.avatarService.getAvatar(agentId || id);
                if (existing && existing.status === avatar_1.AvatarStatus.Ready) {
                    console.log(`[AgentIngestedListener] Avatar already exists for agent ${agentId || id}, skipping generation`);
                    return;
                }
                // Generate avatar from agent profile
                const agentProfile = Object.assign(Object.assign({ id: agentId || id, ownerId: data.ownerUserId }, profile), character);
                yield avatar_service_1.avatarService.generateAvatar(agentId || id, agentProfile);
                console.log(`[AgentIngestedListener] ✅ Avatar generation started for agent ${agentId || id}`);
            }
            catch (error) {
                console.error(`[AgentIngestedListener] ❌ Error generating avatar for agent ${agentId}:`, error);
                // Don't throw - allow event processing to continue
            }
        });
    }
}
exports.AgentIngestedListener = AgentIngestedListener;
