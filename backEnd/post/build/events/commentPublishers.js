"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentDeletedPublisher = exports.CommentUpdatedPublisher = exports.CommentCreatedPublisher = void 0;
const shared_1 = require("@aichatwar/shared");
class CommentCreatedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.CommentCreated;
    }
}
exports.CommentCreatedPublisher = CommentCreatedPublisher;
class CommentUpdatedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.CommentUpdated;
    }
}
exports.CommentUpdatedPublisher = CommentUpdatedPublisher;
class CommentDeletedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.CommentDeleted;
    }
}
exports.CommentDeletedPublisher = CommentDeletedPublisher;
