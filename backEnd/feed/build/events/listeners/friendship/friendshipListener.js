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
exports.FriendshipUpdatedListener = exports.FriendshipRequestedListener = exports.FriendshipAcceptedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const queGroupNames_1 = require("../../queGroupNames");
const freindship_1 = require("../../../models/friendship/freindship");
const block_list_1 = require("../../../models/block-list");
class FriendshipAcceptedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.FriendshipAccepted;
        this.groupId = queGroupNames_1.GroupIdFreindshipAccepted;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Friendship accepted event received:', processedMessage);
            const friendship = yield freindship_1.Friendship.findOne({
                _id: processedMessage.id, version: processedMessage.version - 1
            });
            if (!friendship) {
                throw new shared_1.NotFoundError();
            }
            friendship.status = processedMessage.status;
            yield friendship.save();
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.FriendshipAcceptedListener = FriendshipAcceptedListener;
class FriendshipUpdatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.FriendshipUpdated;
        this.groupId = queGroupNames_1.GroupIdFreindshipUpdated;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Friendship updated event received:', processedMessage);
            const friendship = yield freindship_1.Friendship.findOne({
                _id: processedMessage.id, version: processedMessage.version - 1
            });
            if (!friendship) {
                throw new shared_1.NotFoundError();
            }
            friendship.status = processedMessage.status;
            yield friendship.save();
            // Update block list for filtering
            const status = processedMessage.status;
            if (status === 'blocked' || status === 'removed') {
                // Add to block list (bidirectional for safety)
                yield Promise.all([
                    block_list_1.BlockList.updateOne({ userId: processedMessage.requester, blockedUserId: processedMessage.recipient }, { $set: { blockedAt: new Date() } }, { upsert: true }),
                    block_list_1.BlockList.updateOne({ userId: processedMessage.recipient, blockedUserId: processedMessage.requester }, { $set: { blockedAt: new Date() } }, { upsert: true }),
                ]);
            }
            else if (status === 'accepted') {
                // Remove from block list if exists
                yield block_list_1.BlockList.deleteMany({
                    $or: [
                        { userId: processedMessage.requester, blockedUserId: processedMessage.recipient },
                        { userId: processedMessage.recipient, blockedUserId: processedMessage.requester },
                    ],
                });
            }
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.FriendshipUpdatedListener = FriendshipUpdatedListener;
class FriendshipRequestedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.FriendshipRequested;
        this.groupId = queGroupNames_1.GroupIdFreindshipRequested;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Friendship requested event received:', processedMessage);
            const friendship = yield freindship_1.Friendship.build(processedMessage);
            yield friendship.save();
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.FriendshipRequestedListener = FriendshipRequestedListener;
