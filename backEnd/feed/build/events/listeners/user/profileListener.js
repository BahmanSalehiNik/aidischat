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
exports.ProfileDeletedListener = exports.ProfileUpdatedListener = exports.ProfileCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const queGroupNames_1 = require("./../../queGroupNames");
const profile_1 = require("../../../models/user/profile");
const user_1 = require("../../../models/user/user");
const user_status_1 = require("../../../models/user-status");
class ProfileCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ProfileCreated;
        this.groupId = queGroupNames_1.GroupIdProfileCreated;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            console.log('Profile created event received:', processedMessage);
            const user = yield user_1.User.findById(processedMessage.user);
            if (!user) {
                throw new shared_1.NotFoundError();
            }
            const profile = yield profile_1.Profile.build({
                id: processedMessage.id,
                userId: user.id,
                username: processedMessage.username,
                avatarUrl: (_a = processedMessage.profilePicture) === null || _a === void 0 ? void 0 : _a.url,
                privacy: {
                    profileVisibility: ((_b = processedMessage.privacy) === null || _b === void 0 ? void 0 : _b.profileVisibility) || shared_1.Visibility.Public,
                    postDefault: ((_c = processedMessage.privacy) === null || _c === void 0 ? void 0 : _c.postDefault) || shared_1.Visibility.Friends
                },
                version: processedMessage.version
            });
            yield profile.save();
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.ProfileCreatedListener = ProfileCreatedListener;
class ProfileUpdatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ProfileUpdated;
        this.groupId = queGroupNames_1.GroupIdProfileUpdated;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            console.log('Profile updated event received:', processedMessage);
            const profile = yield profile_1.Profile.findById(processedMessage.id);
            if (!profile) {
                throw new shared_1.NotFoundError();
            }
            profile.username = processedMessage.username;
            profile.avatarUrl = (_a = processedMessage.profilePicture) === null || _a === void 0 ? void 0 : _a.url;
            profile.privacy = {
                profileVisibility: ((_b = processedMessage.privacy) === null || _b === void 0 ? void 0 : _b.profileVisibility) || shared_1.Visibility.Public,
                postDefault: ((_c = processedMessage.privacy) === null || _c === void 0 ? void 0 : _c.postDefault) || shared_1.Visibility.Friends
            };
            yield profile.save();
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.ProfileUpdatedListener = ProfileUpdatedListener;
class ProfileDeletedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ProfileDeleted;
        this.groupId = "feed-profile-deleted";
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Profile deleted event received:', processedMessage);
            // Mark user as non-suggestible when profile is deleted
            yield user_status_1.UserStatus.updateOne({ userId: processedMessage.id }, {
                $set: {
                    isSuggestible: false,
                    updatedAt: new Date(),
                },
            }, { upsert: true });
            // Manual acknowledgment
            yield this.ack();
        });
    }
}
exports.ProfileDeletedListener = ProfileDeletedListener;
