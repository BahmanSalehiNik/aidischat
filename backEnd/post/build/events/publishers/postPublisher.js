"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostUpdatedPublisher = exports.PostDeletedPublisher = exports.PostCreatedPublisher = void 0;
const shared_1 = require("@aichatwar/shared");
class PostCreatedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.PostCreated;
    }
}
exports.PostCreatedPublisher = PostCreatedPublisher;
class PostUpdatedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.PostUpdated;
    }
}
exports.PostUpdatedPublisher = PostUpdatedPublisher;
class PostDeletedPublisher extends shared_1.Publisher {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.PostDeleted;
    }
}
exports.PostDeletedPublisher = PostDeletedPublisher;
