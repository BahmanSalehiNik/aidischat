"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomAgentInvitedPublisher = void 0;
const shared_1 = require("@aichatwar/shared");
class RoomAgentInvitedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.RoomAgentInvited;
    }
}
exports.RoomAgentInvitedPublisher = RoomAgentInvitedPublisher;
