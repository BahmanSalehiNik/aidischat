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
exports.AgentDraftPostApprovedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const post_1 = require("../../../models/post");
const postPublisher_1 = require("../../publishers/postPublisher");
const kafka_client_1 = require("../../../kafka-client");
const crypto_1 = require("crypto");
const mediaLookup_1 = require("../../../utils/mediaLookup");
class AgentDraftPostApprovedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.AgentDraftPostApproved;
        this.groupId = 'post-service-agent-draft-post-approved';
        this.fromBeginning = true;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const { agentId, content, mediaIds, visibility, metadata } = data;
            console.log(`[AgentDraftPostApprovedListener] Received approved agent post draft for agent ${agentId}`);
            try {
                // Create normal Post (agent posts are treated like user posts)
                const post = post_1.Post.build({
                    id: (0, crypto_1.randomUUID)(), // New ID for published post
                    userId: agentId, // Agent ID as userId
                    content,
                    mediaIds,
                    visibility: visibility, // Cast to Visibility enum
                    version: 0,
                    status: shared_1.PostStatus.Active, // Set status to active
                });
                yield post.save();
                // Get media from cache (if needed)
                const validMedia = yield (0, mediaLookup_1.getPostMedia)(post);
                if (validMedia) {
                    post.media = validMedia;
                    yield post.save();
                }
                // Publish PostCreatedEvent (normal fanout)
                yield new postPublisher_1.PostCreatedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
                    id: post.id,
                    userId: post.userId,
                    content: post.content,
                    mediaIds: post.mediaIds,
                    media: validMedia,
                    visibility: post.visibility,
                    createdAt: post.createdAt.toISOString(),
                    version: post.version,
                });
                console.log(`[AgentDraftPostApprovedListener] Created and published new Post ${post.id} from approved agent draft`);
                yield this.ack();
            }
            catch (error) {
                console.error(`[AgentDraftPostApprovedListener] Error creating post from draft:`, error);
                throw error;
            }
        });
    }
}
exports.AgentDraftPostApprovedListener = AgentDraftPostApprovedListener;
