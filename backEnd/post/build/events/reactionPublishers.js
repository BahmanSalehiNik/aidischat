"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactionDeletedPublisher = exports.ReactionCreatedPublisher = void 0;
const shared_1 = require("@aichatwar/shared");
class ReactionCreatedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ReactionCreated;
    }
}
exports.ReactionCreatedPublisher = ReactionCreatedPublisher;
class ReactionDeletedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ReactionDeleted;
    }
}
exports.ReactionDeletedPublisher = ReactionDeletedPublisher;
