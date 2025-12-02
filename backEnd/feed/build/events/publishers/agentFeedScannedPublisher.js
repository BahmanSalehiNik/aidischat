"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentFeedScannedPublisher = void 0;
const shared_1 = require("@aichatwar/shared");
class AgentFeedScannedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentFeedScanned;
    }
}
exports.AgentFeedScannedPublisher = AgentFeedScannedPublisher;
