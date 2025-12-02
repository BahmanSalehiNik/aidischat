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
exports.canView = void 0;
// utils/visibility.ts
const freindship_1 = require("../models/friendship/freindship");
const profile_1 = require("../models/user/profile");
const shared_1 = require("@aichatwar/shared");
const canView = (viewerId_1, ownerId_1, ...args_1) => __awaiter(void 0, [viewerId_1, ownerId_1, ...args_1], void 0, function* (viewerId, ownerId, postVisibility = shared_1.Visibility.Public) {
    if (viewerId === ownerId) {
        return true;
    }
    // Post-specific visibility takes precedence
    if (postVisibility === shared_1.Visibility.Public) {
        return true;
    }
    if (postVisibility === shared_1.Visibility.Private) {
        // Already handled viewer === owner above
        return false;
    }
    // For friends-only posts, ensure there is an accepted friendship
    const friendship = yield freindship_1.Friendship.find({
        $and: [
            { status: freindship_1.FriendshipStatus.Accepted },
            { $or: [{ requester: ownerId }, { recipient: ownerId }] },
            { $or: [{ requester: viewerId }, { recipient: viewerId }] },
        ],
    });
    if (friendship && friendship.length > 0) {
        return true;
    }
    // Fallback to profile privacy rules if no friendship found
    const ownerProfile = yield profile_1.Profile.findOne({ userId: ownerId });
    if (!ownerProfile) {
        return false;
    }
    if (ownerProfile.privacy.profileVisibility === shared_1.Visibility.Public) {
        return true;
    }
    if (ownerProfile.privacy.profileVisibility === shared_1.Visibility.Private) {
        return false;
    }
    // friends-only profile visibility
    return friendship && friendship.length > 0;
});
exports.canView = canView;
