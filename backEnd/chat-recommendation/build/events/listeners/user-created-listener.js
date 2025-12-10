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
exports.UserCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const feature_store_1 = require("../../services/feature-store");
/**
 * UserCreatedListener
 *
 * Initializes user feature projections from UserCreatedEvent
 */
class UserCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.UserCreated;
        this.groupId = 'recommendation-user-created';
    }
    onMessage(data, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = data;
            console.log(`[UserCreatedListener] Initializing user features for ${id}`);
            try {
                // Initialize user features with defaults
                yield feature_store_1.featureStore.updateUserFeatures(id, {
                    userId: id,
                    interests: [],
                    preferredAgents: [],
                    interactionHistory: [],
                    preferences: {
                        domains: [],
                        topics: [],
                    },
                    language: 'en', // Default language
                });
                console.log(`[UserCreatedListener] ✅ Initialized user features for ${id}`);
            }
            catch (error) {
                console.error(`[UserCreatedListener] ❌ Error initializing user features for ${id}:`, error);
                // Don't throw - user features can be created lazily
            }
            yield this.ack();
        });
    }
}
exports.UserCreatedListener = UserCreatedListener;
