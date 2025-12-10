"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatRecommendationsReadyPublisher = void 0;
const shared_1 = require("@aichatwar/shared");
class ChatRecommendationsReadyPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ChatRecommendationsReady;
    }
}
exports.ChatRecommendationsReadyPublisher = ChatRecommendationsReadyPublisher;
