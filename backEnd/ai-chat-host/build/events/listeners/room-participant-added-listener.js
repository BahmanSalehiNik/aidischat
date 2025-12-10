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
exports.RoomParticipantAddedListener = void 0;
const shared_1 = require("@aichatwar/shared");
/**
 * Listens to RoomParticipantAddedEvent to track when agents join rooms
 * This helps prevent inviting agents that are already in the room
 */
class RoomParticipantAddedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.RoomParticipantAdded;
        this.groupId = 'ai-chat-host-room-participant-added';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { roomId, participantId, participantType } = data;
            // Only care about agents joining
            if (participantType !== 'agent') {
                yield this.ack();
                return;
            }
            console.log(`[RoomParticipantAddedListener] Agent ${participantId} joined room ${roomId}`);
            // Note: We could maintain a local cache of room participants here
            // For now, we rely on checking recent analysis results for invited agents
            // This is handled in InvitationCoordinator.getRecentlyInvitedAgents()
            yield this.ack();
        });
    }
}
exports.RoomParticipantAddedListener = RoomParticipantAddedListener;
