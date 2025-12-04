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
exports.UserDeletedListener = exports.UserUpdatedListener = exports.UserCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const queGroupNames_1 = require("./../../queGroupNames");
const user_1 = require("../../../models/user/user");
const user_status_1 = require("../../../models/user-status");
class UserCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.UserCreated;
        this.groupId = queGroupNames_1.GroupIdUserCreated;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                console.log('User created event received:', processedMessage);
                // Check if user already exists (handle duplicate events)
                const existing = yield user_1.User.findOne({ _id: processedMessage.id });
                if (existing) {
                    // Update existing user
                    existing.email = processedMessage.email;
                    existing.version = processedMessage.version;
                    existing.status = processedMessage.status;
                    existing.isAgent = (_a = processedMessage.isAgent) !== null && _a !== void 0 ? _a : false;
                    existing.ownerUserId = processedMessage.ownerUserId;
                    yield existing.save();
                    console.log(`[UserCreatedListener] Updated existing user: ${processedMessage.id}`);
                }
                else {
                    // Create new user
                    const user = user_1.User.build(processedMessage);
                    yield user.save();
                    console.log(`[UserCreatedListener] Created new user: ${processedMessage.id}`);
                }
                // Manual acknowledgment - only after successful save
                yield this.ack();
            }
            catch (error) {
                console.error(`[UserCreatedListener] Error processing user created event for ${processedMessage.id}:`, error);
                // Don't ack on error - let Kafka retry or move to DLQ
                throw error;
            }
        });
    }
}
exports.UserCreatedListener = UserCreatedListener;
class UserUpdatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.UserUpdated;
        this.groupId = queGroupNames_1.GroupIdUserUpdated;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('User updated event received:', processedMessage);
            const user = yield user_1.User.findByEvent({ id: processedMessage.id, version: processedMessage.version });
            if (!user) {
                throw new shared_1.NotFoundError();
            }
            user.status = processedMessage.status;
            yield user.save();
            // Update user status projection for filtering
            const isSuggestible = processedMessage.status !== 'deleted' &&
                processedMessage.status !== 'suspended' &&
                processedMessage.status !== 'banned';
            yield user_status_1.UserStatus.updateOne({ userId: processedMessage.id }, {
                $set: {
                    status: processedMessage.status,
                    isDeleted: processedMessage.status === 'deleted',
                    isSuggestible,
                    updatedAt: new Date(),
                },
            }, { upsert: true });
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.UserUpdatedListener = UserUpdatedListener;
class UserDeletedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.UserDeleted;
        this.groupId = "feed-user-deleted";
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('User deleted event received:', processedMessage);
            // Update user status projection
            yield user_status_1.UserStatus.updateOne({ userId: processedMessage.id }, {
                $set: {
                    status: 'deleted',
                    isDeleted: true,
                    isSuggestible: false,
                    deletedAt: new Date(),
                    updatedAt: new Date(),
                },
            }, { upsert: true });
            // Manual acknowledgment
            yield this.ack();
        });
    }
}
exports.UserDeletedListener = UserDeletedListener;
